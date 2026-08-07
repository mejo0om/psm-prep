let allQuestions = [];
let selectedElement = '1';
let mode = 'study';
let index = 0;
let current = [];
let selectedAnswer = null;
let answered = false;
let questionStarted = Date.now();
let sessionKey = '';
let practiceStartedAt = Date.now();
let sessionCorrect = 0;
let sessionWrong = 0;
let sessionSaved = false;
let practiceAttemptId = null;

const $ = (id) => document.getElementById(id);
const LETTERS = 'ABCDEF';

document.addEventListener('DOMContentLoaded', initializePractice);

async function initializePractice() {
  const groups = await Promise.all(
    [1, 2, 3, 4].map((n) => fetchJSON(`data/elements/element${n}.json`))
  );
  allQuestions = groups.flat();
  markCompletedPracticeSelections();

  const params = new URLSearchParams(location.search);
  const requestedMode = params.get('mode');
  const requestedSection = params.get('section');

  if (requestedSection) {
    current = allQuestions.filter((q) => q.bookSection === requestedSection);
    startSession();
  } else if (requestedMode === 'mistakes') {
    const stats = PSMStorage.get().questionStats;
    current = allQuestions.filter((q) => stats[q.id]?.lastResult === 'wrong');
    startSession();
  } else if (requestedMode === 'favorites') {
    const favorites = PSMStorage.get().favorites;
    current = allQuestions.filter((q) => favorites.includes(q.id));
    startSession();
  } else if (requestedMode === 'unanswered') {
    const stats = PSMStorage.get().questionStats;
    current = allQuestions.filter((q) => !stats[q.id]);
    startSession();
  }

  document.querySelectorAll('.selection-card').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.selection-card').forEach((x) => x.classList.remove('selected'));
      button.classList.add('selected');
      selectedElement = button.dataset.element;
    });
  });

  $('studyMode')?.addEventListener('click', startStudyMode);
  $('flashMode')?.addEventListener('click', startFlashMode);
  $('exitPractice')?.addEventListener('click', async () => { await savePracticeSummary(); location.reload(); });
  $('submitAnswer')?.addEventListener('click', submitAnswer);
  $('nextQuestion')?.addEventListener('click', nextQuestion);
  $('favoriteBtn')?.addEventListener('click', toggleFavorite);
}


function addPracticeCompletionMark(button) {
  if (!button || button.querySelector('.completion-mark')) return;
  button.classList.add('completed-item');
  button.insertAdjacentHTML('beforeend', '<span class="completion-mark" title="Completed" aria-label="Completed">✓</span>');
}

function markCompletedPracticeSelections() {
  const stats = PSMStorage.get().questionStats || {};
  document.querySelectorAll('.selection-card').forEach((button) => {
    const element = button.dataset.element;
    const bank = element === 'random' ? allQuestions : allQuestions.filter((q) => String(q.element) === element);
    const completed = bank.length > 0 && bank.every((q) => Number(stats[q.id]?.attempts || 0) > 0);
    if (completed) addPracticeCompletionMark(button);
  });
}

async function fetchJSON(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

function getSelectedQuestions() {
  return selectedElement === 'random'
    ? [...allQuestions]
    : allQuestions.filter((q) => String(q.element) === selectedElement);
}

function startStudyMode() {
  mode = 'study';
  current = shuffle(getSelectedQuestions());
  index = 0;
  startSession();
}

function startFlashMode() {
  mode = 'flash';
  current = getSelectedQuestions();
  sessionKey = `PSM_FLASH_${selectedElement}`;

  const saved = JSON.parse(localStorage.getItem(sessionKey) || 'null');

  if (saved && saved.index > 0 && saved.index < current.length) {
    const shouldContinue = confirm(
      `Continue from question ${saved.index + 1}?\n\n` +
      `Press OK to continue or Cancel to restart.`
    );

    index = shouldContinue ? saved.index : 0;
    if (!shouldContinue) localStorage.removeItem(sessionKey);
  } else {
    index = 0;
  }

  startSession();
}

function startSession() {
  if (!current.length) {
    alert('No questions are available for this selection.');
    return;
  }

  $('practiceSetup')?.classList.add('hidden');
  $('smartPracticePanel')?.classList.add('hidden');
  $('practiceSession')?.classList.remove('hidden');
  practiceStartedAt = Date.now();
  sessionCorrect = 0;
  sessionWrong = 0;
  sessionSaved = false;
  practiceAttemptId = window.PSM_CLOUD?.uuid?.() || (window.crypto?.randomUUID?.() || String(Date.now()));
  renderQuestion();
}

function renderQuestion() {
  const q = current[index];
  selectedAnswer = null;
  answered = false;
  questionStarted = Date.now();

  $('questionCounter').textContent = `Question ${index + 1} of ${current.length}`;
  $('questionElement').textContent = `Element ${q.element}`;
  $('questionDifficulty').textContent = q.bookSection
    ? `${q.bookSection} · ${q.bookTopic}`
    : 'Official question bank';
  $('questionText').textContent = q.question;

  $('optionsList').innerHTML = q.options
    .map(
      (option, i) => `
        <label class="option" data-value="${LETTERS[i]}">
          <input type="radio" name="answer">
          <span><b>${LETTERS[i]}.</b> ${option}</span>
        </label>`
    )
    .join('');

  document.querySelectorAll('.option').forEach((option) => {
    option.addEventListener('click', () => {
      if (answered) return;

      document.querySelectorAll('.option').forEach((x) => x.classList.remove('selected'));
      option.classList.add('selected');
      selectedAnswer = option.dataset.value;

      if (mode === 'flash') submitAnswer();
    });
  });

  $('feedbackPanel').classList.add('hidden');
  $('nextQuestion').classList.add('hidden');
  $('submitAnswer').classList.toggle('hidden', mode === 'flash');
  $('favoriteBtn').textContent = PSMStorage.isFavorite(q.id) ? '★' : '☆';
}

function submitAnswer() {
  if (answered || !selectedAnswer) return;

  answered = true;
  const q = current[index];
  const correct = selectedAnswer === q.correctAnswer;
  const elapsed = Math.max(1, Math.round((Date.now() - questionStarted) / 1000));

  PSMStorage.recordAnswer(q, correct, elapsed, mode);
  if (correct) sessionCorrect += 1; else sessionWrong += 1;
  window.PSM_CLOUD?.saveQuestion({attempt_id:practiceAttemptId, question_id:q.id, element:q.element, selected_answer:selectedAnswer, is_correct:correct, answer_time_seconds:elapsed});

  document.querySelectorAll('.option').forEach((option) => {
    if (option.dataset.value === q.correctAnswer) option.classList.add('correct');
    if (option.dataset.value === selectedAnswer && !correct) option.classList.add('wrong');
  });

  const conceptRows = [
    q.primaryConcept ? `<p><b>Primary concept:</b><br>${q.primaryConcept}</p>` : '',
    q.relatedConcepts?.length ? `<p><b>Related concepts:</b><br>${q.relatedConcepts.join(', ')}</p>` : '',
    q.keywords?.length ? `<p><b>Keywords:</b><br>${q.keywords.join(', ')}</p>` : ''
  ].filter(Boolean).join('');

  const referenceText = q.officialReference || q.bookReference || [
    q.element ? `Element ${q.element}` : null,
    q.bookSection ? `Section ${q.bookSection}` : null,
    q.bookPageStart ? `Page ${q.bookPageStart}${q.bookPageEnd && q.bookPageEnd !== q.bookPageStart ? `-${q.bookPageEnd}` : ''}` : null
  ].filter(Boolean).join(' · ');

  $('feedbackPanel').classList.remove('hidden');
  $('feedbackPanel').innerHTML = `
    <h3>${correct ? '✅ Correct' : '❌ Incorrect'}</h3>
    <p><b>Correct answer:</b> ${q.correctAnswer}. ${q.correctOptionText || ''}</p>
    ${referenceText ? `<p><b>Book reference:</b> ${referenceText}</p>` : ''}
    <div class="feedback-grid">
      ${q.element ? `<p><b>Element:</b><br>${q.element}</p>` : ''}
      ${q.bookSection ? `<p><b>Section:</b><br>${q.bookSection}</p>` : ''}
      ${q.bookTopic ? `<p><b>Topic:</b><br>${q.bookTopic}</p>` : ''}
      ${conceptRows}
    </div>`;

  if (mode === 'flash') {
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        index: index + 1,
        total: current.length,
        updatedAt: new Date().toISOString()
      })
    );
    setTimeout(nextQuestion, 1100);
  } else {
    $('nextQuestion').classList.remove('hidden');
  }
}

function nextQuestion() {
  if (index >= current.length - 1) {
    if (mode === 'flash') {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          index: current.length,
          total: current.length,
          completed: true
        })
      );
      savePracticeSummary().finally(() => { alert('Flash Mode completed.'); location.reload(); });
      return;
    }

    index = 0;
  } else {
    index += 1;
  }

  renderQuestion();
}

function toggleFavorite() {
  const q = current[index];
  const active = PSMStorage.toggleFavorite(q.id);
  $('favoriteBtn').textContent = active ? '★' : '☆';
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


async function savePracticeSummary() {
  if (sessionSaved || sessionCorrect + sessionWrong === 0) return;
  sessionSaved = true;
  await window.PSM_CLOUD?.savePractice({
    attempt_id: practiceAttemptId,
    mode,
    element: selectedElement,
    total: sessionCorrect + sessionWrong,
    correct: sessionCorrect,
    wrong: sessionWrong,
    duration: Math.max(0, Math.round((Date.now() - practiceStartedAt) / 1000)),
    started_at: new Date(practiceStartedAt).toISOString(),
    completed_at: new Date().toISOString()
  });
}
