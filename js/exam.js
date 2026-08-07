let questions = [];
let answers = {};
let flags = new Set();
let idx = 0;
let seconds = 3600;
let timerId = null;
let startedAt = null;
let paused = false;
let examType = 'official-1';
let officialExamNumber = 1;
let examFinished = false;
let examLabel = 'Official Mock Exam 1';
let examDurationSeconds = 3600;

const $ = (id) => document.getElementById(id);
const LETTERS = 'ABCDEF';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.official-exam-button').forEach((button) => {
    button.addEventListener('click', () => startOfficialExam(Number(button.dataset.exam)));
  });
  $('generateExam')?.addEventListener('click', startGeneratedExam);
  $('prevExam')?.addEventListener('click', previousQuestion);
  $('nextExam')?.addEventListener('click', nextQuestion);
  $('flagQuestion')?.addEventListener('click', toggleFlag);
  $('finishExam')?.addEventListener('click', finishExam);
  $('pauseExam')?.addEventListener('click', togglePause);
  loadReviewExamLibrary();
  markCompletedOfficialExams();
});


function completedExamTypes() {
  return new Set((PSMStorage.get().exams || []).map((attempt) => attempt.type).filter(Boolean));
}

function addCompletionMark(button) {
  if (!button || button.querySelector('.completion-mark')) return;
  button.classList.add('completed-item');
  button.insertAdjacentHTML('beforeend', '<span class="completion-mark" title="Completed" aria-label="Completed">✓</span>');
}

function markCompletedOfficialExams() {
  const completed = completedExamTypes();
  document.querySelectorAll('.official-exam-button').forEach((button) => {
    if (completed.has(`official-${Number(button.dataset.exam)}`)) addCompletionMark(button);
  });
}

function markCompletedReviewExams(container) {
  const completed = completedExamTypes();
  container.querySelectorAll('.review-exam-button').forEach((button) => {
    const type = `element-${Number(button.dataset.element)}-part-${Number(button.dataset.part)}`;
    if (completed.has(type)) addCompletionMark(button);
  });
}

async function startOfficialExam(examNumber) {
  officialExamNumber = Number(examNumber);
  examType = `official-${officialExamNumber}`;
  examLabel = `Official Mock Exam ${officialExamNumber}`;
  examDurationSeconds = 3600;

  try {
    const [examQuestions, examIndex] = await Promise.all([
      fetchJSON(`data/exams/exam${officialExamNumber}.json`),
      fetchJSON('data/exams/index.json')
    ]);

    questions = examQuestions;

    if (!Array.isArray(questions) || questions.length === 0) {
      alert(`Mock Exam ${officialExamNumber} does not contain any questions.`);
      return;
    }

    const metadata = Array.isArray(examIndex)
      ? examIndex.find((exam) => Number(exam.number) === officialExamNumber)
      : null;

    if (metadata && questions.length !== Number(metadata.questionCount)) {
      alert(
        `Mock Exam ${officialExamNumber} should contain ${metadata.questionCount} questions, ` +
        `but ${questions.length} were loaded.`
      );
      return;
    }
  } catch (error) {
    console.error(error);
    alert(`Mock Exam ${officialExamNumber} could not be loaded.`);
    return;
  }

  beginExam();
}

async function startGeneratedExam() {
  examType = 'generated';
  examLabel = 'Generated 40-question mock exam';
  examDurationSeconds = 3600;

  const groups = await Promise.all(
    [1, 2, 3, 4].map((n) => fetchJSON(`data/elements/element${n}.json`))
  );

  if (groups.some((group) => group.length < 10)) {
    alert('Each element must contain at least 10 questions.');
    return;
  }

  questions = shuffle(
    groups.flatMap((group) => shuffle([...group]).slice(0, 10))
  );

  beginExam();
}

async function fetchJSON(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }
  return response.json();
}

async function loadReviewExamLibrary() {
  const container = $('reviewExamButtons');
  if (!container) return;

  try {
    const library = await fetchJSON('data/review-exams/index.json');
    if (!Array.isArray(library) || !library.length) {
      container.innerHTML = '<p class="muted">No additional review exams are available.</p>';
      return;
    }

    const grouped = library.reduce((map, item) => {
      const key = Number(item.element);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
      return map;
    }, new Map());

    container.innerHTML = [...grouped.entries()]
      .map(([element, items]) => `
        <section class="review-element-group">
          <h3>Element ${element}</h3>
          <div class="review-part-buttons">
            ${items.map((item) => `
              <button class="button secondary review-exam-button"
                      type="button"
                      data-element="${item.element}"
                      data-part="${item.part}"
                      data-file="${item.file}"
                      data-count="${item.questionCount}"
                      data-duration="${item.durationMinutes || 60}"
                      data-label="${item.label}">
                ${item.label} · ${item.questionCount} Question${Number(item.questionCount) === 1 ? '' : 's'}
              </button>`).join('')}
          </div>
        </section>`)
      .join('');

    markCompletedReviewExams(container);

    container.querySelectorAll('.review-exam-button').forEach((button) => {
      button.addEventListener('click', () => startReviewExam({
        element: Number(button.dataset.element),
        part: Number(button.dataset.part),
        file: button.dataset.file,
        questionCount: Number(button.dataset.count),
        durationMinutes: Number(button.dataset.duration || 60),
        label: button.dataset.label
      }));
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="muted">The review exam library could not be loaded.</p>';
  }
}

async function startReviewExam(metadata) {
  examType = `element-${metadata.element}-part-${metadata.part}`;
  examLabel = metadata.label || `Element ${metadata.element} – Part ${metadata.part}`;
  examDurationSeconds = Math.max(60, Number(metadata.durationMinutes || 60) * 60);

  try {
    questions = await fetchJSON(`data/review-exams/${metadata.file}`);
    if (!Array.isArray(questions) || questions.length === 0) {
      alert(`${examLabel} does not contain any questions.`);
      return;
    }
    if (metadata.questionCount && questions.length !== metadata.questionCount) {
      alert(`${examLabel} should contain ${metadata.questionCount} questions, but ${questions.length} were loaded.`);
      return;
    }
  } catch (error) {
    console.error(error);
    alert(`${examLabel} could not be loaded.`);
    return;
  }

  beginExam();
}

function beginExam() {
  answers = {};
  flags = new Set();
  idx = 0;
  seconds = examDurationSeconds;
  startedAt = Date.now();
  paused = false;
  examFinished = false;

  $('examSetup')?.classList.add('hidden');
  $('examResult')?.classList.add('hidden');
  $('examSession')?.classList.remove('hidden');

  const draftKey = `PSM_EXAM_DRAFT_${examType}`;
  const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');

  if (
    saved &&
    saved.questionIds &&
    saved.questionIds.length === questions.length &&
    confirm('Resume your saved exam?')
  ) {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const restored = saved.questionIds.map((id) => byId.get(id)).filter(Boolean);

    if (restored.length === questions.length) {
      questions = restored;
      answers = saved.answers || {};
      flags = new Set(saved.flags || []);
      idx = saved.idx || 0;
      seconds = Number.isFinite(saved.seconds) ? saved.seconds : examDurationSeconds;
      startedAt = saved.startedAt || startedAt;
    }
  }

  renderTimer();
  renderQuestion();
  clearInterval(timerId);
  timerId = setInterval(tick, 1000);
}

function saveDraft() {
  if (!questions.length) return;

  localStorage.setItem(
    `PSM_EXAM_DRAFT_${examType}`,
    JSON.stringify({
      questionIds: questions.map((q) => q.id),
      answers,
      flags: [...flags],
      idx,
      seconds,
      startedAt,
      savedAt: new Date().toISOString()
    })
  );
}

function renderTimer() {
  $('timer').textContent =
    `${String(Math.max(0, Math.floor(seconds / 60))).padStart(2, '0')}:` +
    `${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;
}

function tick() {
  if (paused || examFinished) return;

  seconds -= 1;
  renderTimer();

  saveDraft();

  if (seconds <= 0) finishExam();
}

function renderQuestion() {
  const q = questions[idx];
  if (!q) return;

  $('examProgress').textContent = `${idx + 1} / ${questions.length}`;
  $('examQuestion').textContent = q.question;

  $('examOptions').innerHTML = q.options
    .map(
      (option, i) => `
        <button class="option ${answers[idx] === LETTERS[i] ? 'selected' : ''}"
                type="button"
                data-value="${LETTERS[i]}">
          <b>${LETTERS[i]}.</b> ${option}
        </button>`
    )
    .join('');

  document.querySelectorAll('#examOptions .option').forEach((button) => {
    button.addEventListener('click', () => {
      answers[idx] = button.dataset.value;
      renderQuestion();
    });
  });

  $('flagQuestion').textContent = flags.has(idx) ? '★ Flagged' : '☆ Flag';
  renderNavigator();
  saveDraft();
}

function renderNavigator() {
  $('examNavigator').innerHTML = questions
    .map(
      (_, i) => `
        <button type="button"
                class="${answers[i] ? 'answered' : ''} ${flags.has(i) ? 'flagged' : ''}"
                data-index="${i}">
          ${i + 1}
        </button>`
    )
    .join('');

  document.querySelectorAll('#examNavigator button').forEach((button) => {
    button.addEventListener('click', () => {
      idx = Number(button.dataset.index);
      renderQuestion();
    });
  });
}

function previousQuestion() {
  if (idx > 0) {
    idx -= 1;
    renderQuestion();
  }
}

function nextQuestion() {
  if (idx < questions.length - 1) {
    idx += 1;
    renderQuestion();
  }
}

function toggleFlag() {
  flags.has(idx) ? flags.delete(idx) : flags.add(idx);
  renderQuestion();
}

function togglePause() {
  paused = !paused;
  $('pauseOverlay')?.classList.toggle('hidden', !paused);
  $('pauseExam').textContent = paused ? 'Resume' : 'Pause';
}

function getPerformanceRating(percentage) {
  if (percentage >= 90) return { label: 'Excellent', className: 'excellent' };
  if (percentage >= 80) return { label: 'Very Good', className: 'very-good' };
  if (percentage >= 60) return { label: 'Good', className: 'good' };
  return { label: 'Failed', className: 'failed' };
}

function finishExam() {
  if (!questions.length || examFinished) return;

  const unanswered = questions.length - Object.keys(answers).length;
  if (seconds > 0 && unanswered > 0 && !confirm(`You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Finish the exam now?`)) return;
  examFinished = true;

  clearInterval(timerId);
  localStorage.removeItem(`PSM_EXAM_DRAFT_${examType}`);

  let score = 0;
  let gradableTotal = 0;
  const duration = Math.max(0, Math.round((Date.now() - Number(startedAt || Date.now())) / 1000));

  const review = questions.map((q, i) => {
    const userAnswer = answers[i] || null;
    const graded = Boolean(q.correctAnswer);
    const correct = graded && userAnswer === q.correctAnswer;

    if (graded) {
      gradableTotal += 1;
      if (correct) score += 1;
      PSMStorage.recordAnswer(q, correct, 0, 'exam');
    }

    return {
      ...q,
      userAnswer,
      userAnswerText: userAnswer ? (q.options?.[LETTERS.indexOf(userAnswer)] || '') : '',
      correct,
      graded,
      flagged: flags.has(i)
    };
  });

  const percentage = gradableTotal ? Math.round((score / gradableTotal) * 100) : 0;
  const rating = getPerformanceRating(percentage);
  const ungradedCount = questions.length - gradableTotal;

  PSMStorage.saveExam({
    attempt_id: window.PSM_CLOUD?.uuid?.() || (window.crypto?.randomUUID?.() || String(Date.now())),
    type: examType,
    label: examLabel,
    score,
    total: gradableTotal,
    presentedTotal: questions.length,
    percentage,
    rating: rating.label,
    duration,
    started_at: new Date(Number(startedAt || Date.now())).toISOString(),
    flagged: flags.size,
    date: new Date().toISOString(),
    review
  });

  $('examSession').classList.add('hidden');
  $('examResult').classList.remove('hidden');

  $('examResult').innerHTML = `
    <span class="eyebrow">EXAM COMPLETE</span>
    <h1>${percentage}%</h1>
    <div class="result-rating ${rating.className}">${rating.label}</div>
    <h2>${score} / ${gradableTotal} correct</h2>
    <p>${examLabel}</p>
    ${ungradedCount ? `<p class="result-note">${ungradedCount} source question${ungradedCount === 1 ? '' : 's'} had no keyed answer and ${ungradedCount === 1 ? 'was' : 'were'} not counted in the score.</p>` : ''}
    <div class="hero-actions">
      <button class="button primary" id="showReview" type="button">Review Answers</button>
      <a class="button secondary" href="exam.html">Back to Exams</a>
      <a class="button secondary" href="progress.html">View Progress</a>
    </div>
    <div id="reviewList" class="review-list hidden"></div>`;

  $('showReview').addEventListener('click', () => renderReview(review));
}

function renderReview(review) {
  const list = $('reviewList');
  list.classList.remove('hidden');

  list.innerHTML = review
    .map(
      (item, i) => `
        <article class="review-item ${!item.graded ? 'review-ungraded' : (item.correct ? 'review-correct' : 'review-wrong')}">
          <header>
            <b>Question ${i + 1}</b>
            <span><span class="review-status-icon">${!item.graded ? '—' : (item.correct ? '✓' : '✕')}</span>${!item.graded ? 'Not graded' : (item.correct ? 'Correct' : 'Incorrect')}${item.flagged ? ' · Flagged' : ''}</span>
          </header>
          <p>${item.question}</p>
          <p><b>Your answer:</b> ${item.userAnswer ? `${item.userAnswer}. ${item.userAnswerText || ''} ${item.graded ? (item.correct ? '<span class="correct-answer-mark">✓</span>' : '<span class="wrong-answer-mark">✕</span>') : ''}` : 'Not answered'}</p>
          <p><b>Correct answer:</b> ${item.graded ? `${item.correctAnswer}. ${item.correctOptionText || ''} <span class="correct-answer-mark">✓</span>` : 'Not provided in the source workbook'}</p>
          ${(item.officialReference || item.bookReference) ? `<p><b>Book reference:</b> ${item.officialReference || item.bookReference}</p>` : ''}
          <div class="feedback-grid">
            ${item.element ? `<p><b>Element:</b><br>${item.element}</p>` : ''}
            ${item.bookSection ? `<p><b>Section:</b><br>${item.bookSection}</p>` : ''}
            ${item.bookTopic ? `<p><b>Topic:</b><br>${item.bookTopic}</p>` : ''}
            ${item.primaryConcept ? `<p><b>Primary concept:</b><br>${item.primaryConcept}</p>` : ''}
            ${item.relatedConcepts?.length ? `<p><b>Related concepts:</b><br>${item.relatedConcepts.join(', ')}</p>` : ''}
            ${item.keywords?.length ? `<p><b>Keywords:</b><br>${item.keywords.join(', ')}</p>` : ''}
          </div>
        </article>`
    )
    .join('');
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
