(async () => {
  'use strict';

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  function localModel(questions) {
    const data = PSMStorage.get();
    const summary = PSMStorage.getSummary();
    return { source: 'local', questions, data, summary, stats: data.questionStats };
  }

  function cloudModel(questions, cloud) {
    const lookup = new Map(questions.map(q => [String(q.id), q]));
    const questionStats = {};
    const history = [];

    [...cloud.questionAttempts].reverse().forEach(row => {
      const id = String(row.question_id);
      const q = lookup.get(id) || {};
      const stat = questionStats[id] || {
        attempts: 0, correctCount: 0, wrongCount: 0, totalTime: 0,
        averageTime: 0, lastAnswered: null, lastResult: null,
        mastered: false, reviewPriority: 0
      };
      stat.attempts += 1;
      if (row.is_correct) stat.correctCount += 1; else stat.wrongCount += 1;
      stat.totalTime += Number(row.answer_time_seconds) || 0;
      stat.averageTime = stat.attempts ? Math.round(stat.totalTime / stat.attempts) : 0;
      stat.lastAnswered = row.attempted_at;
      stat.lastResult = row.is_correct ? 'correct' : 'wrong';
      stat.mastered = stat.correctCount >= 2 && stat.correctCount > stat.wrongCount && Boolean(row.is_correct);
      stat.reviewPriority = Math.max(0, stat.wrongCount * 3 - stat.correctCount + (row.is_correct ? -1 : 2));
      questionStats[id] = stat;
      history.unshift({
        id,
        element: row.element_number || q.element || null,
        topic: q.bookTopic || q.topic || 'Unmapped',
        correct: Boolean(row.is_correct),
        time: Number(row.answer_time_seconds) || 0,
        date: row.attempted_at
      });
    });

    const statsArray = Object.values(questionStats);
    const attempts = statsArray.reduce((sum, item) => sum + item.attempts, 0);
    const correct = statsArray.reduce((sum, item) => sum + item.correctCount, 0);
    const wrong = statsArray.reduce((sum, item) => sum + item.wrongCount, 0);
    const local = PSMStorage.get();
    const data = {
      ...local,
      questionStats,
      history: history.sort((a, b) => new Date(b.date) - new Date(a.date)),
      exams: cloud.exams.map(x => ({
        type: x.exam_code,
        score: x.correct_answers,
        total: x.total_questions,
        percentage: Number(x.percentage) || 0,
        duration: x.duration_seconds,
        date: x.completed_at
      }))
    };
    return {
      source: 'cloud', questions, data, stats: questionStats,
      summary: {
        attempts, correct, wrong,
        accuracy: attempts ? Math.round(correct / attempts * 100) : 0,
        uniqueSolved: statsArray.filter(item => item.attempts > 0).length,
        mastered: statsArray.filter(item => item.mastered).length,
        favorites: local.favorites.length,
        currentStreak: local.streak.current,
        longestStreak: local.streak.longest
      },
      pendingCount: cloud.pendingCount
    };
  }

  function render(model) {
    const { questions, data, summary, stats } = model;
    set('accuracyStat', `${summary.accuracy}%`);
    set('solvedStat', summary.uniqueSolved);
    set('correctStat', summary.correct);
    set('wrongStat', summary.wrong);
    set('masteredStat', summary.mastered);
    set('streakStat', `${summary.currentStreak} days`);

    const byElement = {1:{c:0,w:0,a:0},2:{c:0,w:0,a:0},3:{c:0,w:0,a:0},4:{c:0,w:0,a:0}};
    const byTopic = {};
    data.history.forEach(h => {
      if (h.element && byElement[h.element]) {
        byElement[h.element].a += 1;
        h.correct ? byElement[h.element].c += 1 : byElement[h.element].w += 1;
      }
      const topic = h.topic || 'Unmapped';
      byTopic[topic] ||= {c:0,w:0,a:0};
      byTopic[topic].a += 1;
      h.correct ? byTopic[topic].c += 1 : byTopic[topic].w += 1;
    });

    document.getElementById('elementStats').innerHTML = Object.entries(byElement).map(([element, value]) => {
      const percentage = value.a ? Math.round(value.c / value.a * 100) : 0;
      return `<div class="element-row"><header><span>Element ${element}</span><b>${percentage}% · ${value.a} attempts</b></header><div class="progress-track"><span style="width:${percentage}%"></span></div></div>`;
    }).join('');

    const weak = Object.entries(byTopic).filter(([,v]) => v.a >= 2)
      .map(([topic,v]) => ({topic,accuracy:Math.round(v.c/v.a*100),attempts:v.a}))
      .sort((a,b) => a.accuracy-b.accuracy || b.attempts-a.attempts).slice(0,6);
    document.getElementById('weakAreas').innerHTML = weak.length
      ? weak.map(x => `<div class="weak-row"><span>${x.topic}</span><b>${x.accuracy}%</b></div>`).join('')
      : '<p class="muted">Complete more questions to identify weak areas.</p>';

    const wrongQuestions = questions.filter(q => stats[q.id]?.lastResult === 'wrong')
      .sort((a,b) => (stats[b.id].reviewPriority||0)-(stats[a.id].reviewPriority||0));
    set('mistakeCount', wrongQuestions.length);
    set('favoriteCount', data.favorites.length);

    document.getElementById('historyList').innerHTML = data.history.length
      ? data.history.slice(0,12).map(h => `<div class="history-item"><span>${h.id} · ${h.topic}</span><b>${h.correct?'Correct':'Wrong'} · ${h.time||0}s</b></div>`).join('')
      : '<p class="muted">No activity yet.</p>';

    document.getElementById('achievementList').innerHTML = data.achievements.length
      ? data.achievements.map(a => `<span class="achievement">🏅 ${a.name}</span>`).join('')
      : '<p class="muted">Achievements will appear as you study.</p>';

    const last = data.exams[0];
    document.getElementById('lastExam').innerHTML = last
      ? `<h3>${last.percentage}%</h3><p>${last.score}/${last.total} correct${last.flagged != null ? ` · ${last.flagged} flagged` : ''}</p>`
      : '<p class="muted">No mock exam completed yet.</p>';

    console.info(`[PSM Progress] Loaded from ${model.source}${model.pendingCount ? `; ${model.pendingCount} pending upload(s)` : ''}.`);
  }

  try {
    const groups = await Promise.all([1,2,3,4].map(n => fetch(`data/elements/element${n}.json`, {cache:'no-store'}).then(r => {
      if (!r.ok) throw new Error(`Could not load element ${n}`);
      return r.json();
    })));
    const questions = groups.flat();
    let model;
    try {
      await window.PSM_CLOUD?.flushPending?.();
      const cloud = await window.PSM_CLOUD?.loadProgress?.();
      model = cloud ? cloudModel(questions, cloud) : localModel(questions);
    } catch (error) {
      console.warn('[PSM Progress] Cloud load failed; using this device data:', error);
      model = localModel(questions);
    }
    render(model);
  } catch (error) {
    console.error('[PSM Progress] Could not load progress:', error);
  }
})();
