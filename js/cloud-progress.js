(() => {
  'use strict';

  const PENDING_BASE = 'psm_cloud_pending_v3';
  const ACTIVE_USER_KEY = 'PSM_ACTIVE_USER_ID';
  let flushRunning = false;

  function uuid() {
    return window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 3 | 8);
          return v.toString(16);
        });
  }

  function activeUserId() {
    return window.PSM_AUTH?.getUser?.()?.id || localStorage.getItem(ACTIVE_USER_KEY) || null;
  }

  function pendingKey(userId = activeUserId()) {
    return `${PENDING_BASE}_${userId || 'guest'}`;
  }

  function trackingIds() {
    let visitorId = localStorage.getItem('psm_visitor_id');
    let sessionId = sessionStorage.getItem('psm_session_id');
    if (!visitorId) {
      visitorId = uuid();
      localStorage.setItem('psm_visitor_id', visitorId);
    }
    if (!sessionId) {
      sessionId = uuid();
      sessionStorage.setItem('psm_session_id', sessionId);
    }
    return { visitor_id: visitorId, session_id: sessionId };
  }

  async function context() {
    const auth = window.PSM_AUTH;
    if (!auth) throw new Error('PSM_AUTH is not loaded.');
    const user = await auth.waitForUser(15000);
    if (!auth.client) throw new Error('Supabase client is unavailable.');
    if (!user) throw new Error('No signed-in user was found.');
    return { client: auth.client, user };
  }

  function pendingItems(userId) {
    try { return JSON.parse(localStorage.getItem(pendingKey(userId)) || '[]'); }
    catch { return []; }
  }

  function setPending(items, userId) {
    const key = pendingKey(userId);
    if (items.length) localStorage.setItem(key, JSON.stringify(items.slice(-1000)));
    else localStorage.removeItem(key);
  }

  function enqueue(table, row, returnRow, userId) {
    if (!userId) {
      console.error(`[PSM Cloud] ${table} was not queued because no user is signed in.`);
      return;
    }
    const items = pendingItems(userId);
    items.push({ id: uuid(), table, row, returnRow, user_id: userId, queued_at: new Date().toISOString() });
    setPending(items, userId);
  }

  async function send(table, row, returnRow = false, expectedUserId = null) {
    const { client, user } = await context();
    if (expectedUserId && expectedUserId !== user.id) {
      throw new Error('Queued progress belongs to a different user account.');
    }
    const payload = { ...row, ...trackingIds(), user_id: user.id };
    let query = client.from(table).insert(payload);
    if (returnRow) query = query.select('id').single();
    const { data, error } = await query;
    if (error) throw error;
    console.info(`[PSM Cloud] Saved ${table} for user ${user.id}`, data || payload);
    window.dispatchEvent(new CustomEvent('psm-cloud-saved', { detail: { table, userId: user.id } }));
    return data || payload;
  }

  async function save(table, row, returnRow = false) {
    const userId = activeUserId();
    try {
      const result = await send(table, row, returnRow, userId);
      void flushPending();
      return result;
    } catch (error) {
      console.error(`[PSM Cloud] Save failed for ${table}:`, error);
      enqueue(table, row, returnRow, userId);
      return null;
    }
  }

  async function flushPending() {
    if (flushRunning || !navigator.onLine) return;
    const userId = activeUserId();
    if (!userId) return;
    flushRunning = true;
    try {
      const items = pendingItems(userId);
      if (!items.length) return;
      const remaining = [];
      for (const item of items) {
        try { await send(item.table, item.row, item.returnRow, item.user_id); }
        catch (error) {
          console.error(`[PSM Cloud] Retry failed for ${item.table}:`, error);
          remaining.push(item);
        }
      }
      setPending(remaining, userId);
    } finally {
      flushRunning = false;
    }
  }

  function saveQuestion(payload) {
    return save('question_attempts', {
      attempt_id: payload.attempt_id || null,
      question_id: String(payload.question_id ?? ''),
      element_number: payload.element == null || payload.element === 'random' ? null : Number(payload.element),
      selected_answer: payload.selected_answer == null ? null : String(payload.selected_answer),
      is_correct: Boolean(payload.is_correct),
      answer_time_seconds: Number(payload.answer_time_seconds) || 0,
      attempted_at: payload.attempted_at || new Date().toISOString()
    });
  }

  async function saveExam(result) {
    const total = Number(result.total) || 0;
    const score = Number(result.score) || 0;
    const duration = Number(result.duration) || 0;
    const exam = await save('exam_attempts', {
      attempt_id: result.attempt_id || uuid(),
      exam_code: String(result.type || 'mock'),
      total_questions: total,
      correct_answers: score,
      wrong_answers: Math.max(0, total - score),
      percentage: Number(result.percentage) || 0,
      duration_seconds: duration,
      started_at: result.started_at || new Date(Date.now() - duration * 1000).toISOString(),
      completed_at: result.date || new Date().toISOString()
    }, true);

    const linkId = exam?.id ? String(exam.id) : (result.attempt_id || null);
    if (linkId && Array.isArray(result.review)) {
      for (const q of result.review) {
        if (q.graded === false) continue;
        await saveQuestion({
          attempt_id: linkId,
          question_id: q.id,
          element: q.element,
          selected_answer: q.userAnswer,
          is_correct: q.correct,
          answer_time_seconds: 0,
          attempted_at: result.date
        });
      }
    }
    return exam;
  }

  function savePractice(summary) {
    const duration = Number(summary.duration) || 0;
    return save('practice_sessions', {
      attempt_id: summary.attempt_id || uuid(),
      practice_mode: String(summary.mode || 'study'),
      element_number: summary.element == null || summary.element === 'random' ? null : Number(summary.element),
      total_questions: Number(summary.total) || 0,
      correct_answers: Number(summary.correct) || 0,
      wrong_answers: Number(summary.wrong) || 0,
      duration_seconds: duration,
      started_at: summary.started_at || new Date(Date.now() - duration * 1000).toISOString(),
      completed_at: summary.completed_at || new Date().toISOString()
    });
  }

  async function loadProgress() {
    const { client, user } = await context();
    const [questionsResult, examsResult, practiceResult] = await Promise.all([
      client.from('question_attempts')
        .select('attempt_id,question_id,element_number,selected_answer,is_correct,answer_time_seconds,attempted_at')
        .eq('user_id', user.id).order('attempted_at', { ascending: false }).limit(1000),
      client.from('exam_attempts')
        .select('id,attempt_id,exam_code,total_questions,correct_answers,wrong_answers,percentage,duration_seconds,started_at,completed_at')
        .eq('user_id', user.id).order('completed_at', { ascending: false }).limit(100),
      client.from('practice_sessions')
        .select('id,attempt_id,practice_mode,element_number,total_questions,correct_answers,wrong_answers,duration_seconds,started_at,completed_at')
        .eq('user_id', user.id).order('completed_at', { ascending: false }).limit(100)
    ]);

    const error = questionsResult.error || examsResult.error || practiceResult.error;
    if (error) throw error;
    return {
      userId: user.id,
      questionAttempts: questionsResult.data || [],
      exams: examsResult.data || [],
      practiceSessions: practiceResult.data || [],
      pendingCount: pendingItems(user.id).length
    };
  }

  async function verifyConnection() {
    const data = await loadProgress();
    return {
      ok: true,
      userId: data.userId,
      questionAttempts: data.questionAttempts.length,
      exams: data.exams.length,
      practiceSessions: data.practiceSessions.length,
      pendingCount: data.pendingCount
    };
  }

  function patchStorage() {
    if (!window.PSMStorage || window.PSMStorage.__cloudPatched) return;
    const original = window.PSMStorage.saveExam.bind(window.PSMStorage);
    window.PSMStorage.saveExam = function(result) {
      const value = original(result);
      void saveExam(result);
      return value;
    };
    window.PSMStorage.__cloudPatched = true;
    console.info('[PSM Cloud] User-linked exam storage hook installed.');
  }

  window.PSM_CLOUD = { uuid, saveQuestion, savePractice, saveExam, loadProgress, verifyConnection, flushPending, context };
  patchStorage();
  window.addEventListener('online', flushPending);
  window.addEventListener('psm-auth-change', () => { patchStorage(); void flushPending(); });
  document.addEventListener('DOMContentLoaded', () => {
    patchStorage();
    setTimeout(flushPending, 1000);
  });
})();
