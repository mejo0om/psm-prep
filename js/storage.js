(() => {
  'use strict';

  const BASE_KEY = 'PSM_PREP_PROGRESS_V4';
  const ACTIVE_USER_KEY = 'PSM_ACTIVE_USER_ID';

  const clone = value => JSON.parse(JSON.stringify(value));

  const defaults = {
    favorites: [],
    questionStats: {},
    history: [],
    exams: [],
    sessions: [],
    achievements: [],
    settings: { theme: 'light', dailyGoal: 20 },
    streak: { current: 0, longest: 0, lastStudyDate: null }
  };

  function currentUserId() {
    return window.PSM_AUTH?.getUser?.()?.id || localStorage.getItem(ACTIVE_USER_KEY) || null;
  }

  function storageKey() {
    const userId = currentUserId();
    return userId ? `${BASE_KEY}_${userId}` : `${BASE_KEY}_guest`;
  }

  const PSMStorage = {
    defaults,

    get key() { return storageKey(); },

    setActiveUser(userId) {
      if (userId) localStorage.setItem(ACTIVE_USER_KEY, String(userId));
      else localStorage.removeItem(ACTIVE_USER_KEY);
      window.dispatchEvent(new CustomEvent('psm-storage-scope-change', { detail: { userId: userId || null } }));
    },

    getActiveUserId() { return currentUserId(); },

    get() {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey()) || '{}');
        return {
          ...clone(defaults),
          ...stored,
          settings: { ...defaults.settings, ...(stored.settings || {}) },
          streak: { ...defaults.streak, ...(stored.streak || {}) },
          favorites: Array.isArray(stored.favorites) ? stored.favorites : [],
          history: Array.isArray(stored.history) ? stored.history : [],
          exams: Array.isArray(stored.exams) ? stored.exams : [],
          sessions: Array.isArray(stored.sessions) ? stored.sessions : [],
          achievements: Array.isArray(stored.achievements) ? stored.achievements : [],
          questionStats: stored.questionStats || {}
        };
      } catch (error) {
        console.error('[PSM Storage] Could not read progress:', error);
        return clone(defaults);
      }
    },

    save(data) {
      localStorage.setItem(storageKey(), JSON.stringify(data));
    },

    clearCurrentUserProgress() {
      localStorage.removeItem(storageKey());
    },

    getQuestionStat(id) {
      const data = this.get();
      return data.questionStats[id] || {
        attempts: 0, correctCount: 0, wrongCount: 0, totalTime: 0,
        averageTime: 0, lastAnswered: null, lastResult: null,
        mastered: false, reviewPriority: 0
      };
    },

    recordAnswer(question, isCorrect, timeSeconds = 0, mode = 'practice') {
      const data = this.get();
      const id = question.id;
      const stat = data.questionStats[id] || {
        attempts: 0, correctCount: 0, wrongCount: 0, totalTime: 0,
        averageTime: 0, lastAnswered: null, lastResult: null,
        mastered: false, reviewPriority: 0
      };
      stat.attempts++;
      if (isCorrect) stat.correctCount++; else stat.wrongCount++;
      stat.totalTime += Number(timeSeconds) || 0;
      stat.averageTime = stat.attempts ? Math.round(stat.totalTime / stat.attempts) : 0;
      stat.lastAnswered = new Date().toISOString();
      stat.lastResult = isCorrect ? 'correct' : 'wrong';
      stat.mastered = stat.correctCount >= 2 && stat.correctCount > stat.wrongCount && isCorrect;
      stat.reviewPriority = Math.max(0, (stat.wrongCount * 3) - stat.correctCount + (isCorrect ? -1 : 2));
      data.questionStats[id] = stat;

      data.history.unshift({
        id,
        element: question.element || null,
        topic: question.bookTopic || question.topic || 'Unmapped',
        correct: isCorrect,
        time: Number(timeSeconds) || 0,
        mode,
        date: new Date().toISOString()
      });
      data.history = data.history.slice(0, 500);

      this.updateStreak(data);
      this.unlockAchievements(data);
      this.save(data);
      return stat;
    },

    updateStreak(data) {
      const today = new Date().toISOString().slice(0, 10);
      const last = data.streak.lastStudyDate;
      if (last === today) return;
      if (last) {
        const d1 = new Date(`${last}T00:00:00`);
        const d2 = new Date(`${today}T00:00:00`);
        const diff = Math.round((d2 - d1) / 86400000);
        data.streak.current = diff === 1 ? data.streak.current + 1 : 1;
      } else data.streak.current = 1;
      data.streak.longest = Math.max(data.streak.longest, data.streak.current);
      data.streak.lastStudyDate = today;
    },

    unlockAchievements(data) {
      const stats = Object.values(data.questionStats);
      const attempts = stats.reduce((sum, item) => sum + item.attempts, 0);
      const correct = stats.reduce((sum, item) => sum + item.correctCount, 0);
      const accuracy = attempts ? Math.round(correct / attempts * 100) : 0;
      const candidates = [
        ['first-question', 'First Step', attempts >= 1],
        ['ten-questions', 'Getting Started', attempts >= 10],
        ['fifty-questions', 'Focused Learner', attempts >= 50],
        ['hundred-questions', 'Century Club', attempts >= 100],
        ['accuracy-90', 'High Accuracy', attempts >= 20 && accuracy >= 90],
        ['streak-7', 'Seven-Day Streak', data.streak.current >= 7]
      ];
      candidates.forEach(([id, name, ok]) => {
        if (ok && !data.achievements.some(item => item.id === id)) {
          data.achievements.push({ id, name, date: new Date().toISOString() });
        }
      });
    },

    toggleFavorite(id) {
      const data = this.get();
      const index = data.favorites.indexOf(id);
      if (index >= 0) data.favorites.splice(index, 1); else data.favorites.push(id);
      this.save(data);
      return index < 0;
    },

    isFavorite(id) { return this.get().favorites.includes(id); },

    saveExam(result) {
      const data = this.get();
      data.exams.unshift(result);
      data.exams = data.exams.slice(0, 30);
      this.save(data);
    },

    getSummary() {
      const data = this.get();
      const stats = Object.values(data.questionStats);
      const attempts = stats.reduce((sum, item) => sum + item.attempts, 0);
      const correct = stats.reduce((sum, item) => sum + item.correctCount, 0);
      const wrong = stats.reduce((sum, item) => sum + item.wrongCount, 0);
      return {
        attempts, correct, wrong,
        accuracy: attempts ? Math.round(correct / attempts * 100) : 0,
        uniqueSolved: stats.filter(item => item.attempts > 0).length,
        mastered: stats.filter(item => item.mastered).length,
        favorites: data.favorites.length,
        currentStreak: data.streak.current,
        longestStreak: data.streak.longest
      };
    }
  };

  window.PSMStorage = PSMStorage;
})();
