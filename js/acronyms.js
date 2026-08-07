'use strict';

const AcronymApp = {
  items: [],
  filtered: [],
  current: null,
  currentOptions: [],
  selectedLength: 20,
  challengePool: [],
  challengeIndex: 0,
  score: 0,
  mode: 'random',

  async init() {
    const response = await fetch('data/acronyms.json?v=3.2.4', { cache: 'no-store' });
    this.items = (await response.json()).filter(item => item.verification?.status !== 'Rejected');
    this.filtered = [...this.items];
    this.bind();
    this.renderStats();
    this.renderCards();
  },

  bind() {
    const search = document.getElementById('acronymSearch');
    const elementFilter = document.getElementById('elementFilter');
    const statusFilter = document.getElementById('statusFilter');
    [search, elementFilter, statusFilter].forEach(el => el.addEventListener('input', () => this.applyFilters()));
    document.getElementById('learnTab').addEventListener('click', () => this.showView('learn'));
    document.getElementById('challengeTab').addEventListener('click', () => this.showView('challenge'));
    document.getElementById('mistakesTab').addEventListener('click', () => this.showView('mistakes'));
    document.getElementById('startChallenge').addEventListener('click', () => this.startChallenge());
    document.getElementById('nextAcronym').addEventListener('click', () => this.nextQuestion());
    document.getElementById('challengeLength').addEventListener('change', e => { this.selectedLength = e.target.value === 'all' ? this.items.length : Number(e.target.value); });
    document.getElementById('challengeMode').addEventListener('change', e => { this.mode = e.target.value; });
  },

  getStore() {
    try { return JSON.parse(localStorage.getItem('PSM_ACRONYM_PROGRESS_V2') || '{}'); }
    catch { return {}; }
  },

  saveStore(store) { localStorage.setItem('PSM_ACRONYM_PROGRESS_V2', JSON.stringify(store)); },

  getStat(key) {
    const store = this.getStore();
    return store[key] || { attempts: 0, correct: 0, wrongCount: 0, selectedWrongOption: '', correctOption: '', lastAttempt: null, status: 'Needs Review', confusions: {} };
  },

  record(item, selectedOption, isCorrect) {
    const store = this.getStore();
    const stat = store[item.key] || this.getStat(item.key);
    stat.attempts += 1;
    stat.lastAttempt = new Date().toISOString();
    stat.correctOption = item.fullName;
    if (isCorrect) {
      stat.correct += 1;
      stat.status = stat.correct >= 2 && stat.correct > stat.wrongCount ? 'Mastered' : 'Needs Review';
    } else {
      stat.wrongCount += 1;
      stat.selectedWrongOption = selectedOption?.text || '';
      stat.status = 'Needs Review';
      if (selectedOption?.sourceKey) {
        stat.confusions[selectedOption.sourceKey] = (stat.confusions[selectedOption.sourceKey] || 0) + 1;
      }
    }
    store[item.key] = stat;
    this.saveStore(store);
    this.renderStats();
  },

  renderStats() {
    const store = this.getStore();
    const stats = Object.values(store);
    const mastered = stats.filter(x => x.status === 'Mastered').length;
    const mistakes = stats.reduce((sum, x) => sum + (x.wrongCount || 0), 0);
    document.getElementById('totalAcronyms').textContent = this.items.length;
    document.getElementById('masteredAcronyms').textContent = mastered;
    document.getElementById('mistakeCount').textContent = mistakes;
  },

  applyFilters() {
    const query = document.getElementById('acronymSearch').value.trim().toLowerCase();
    const element = document.getElementById('elementFilter').value;
    const status = document.getElementById('statusFilter').value;
    this.filtered = this.items.filter(item => {
      const haystack = [item.acronym, item.fullName, item.officialDescription, item.category, ...(item.keywords || [])].join(' ').toLowerCase();
      const stat = this.getStat(item.key);
      return (!query || haystack.includes(query)) && (!element || String(item.element) === element) && (!status || stat.status === status);
    });
    this.renderCards();
  },

  renderCards() {
    const grid = document.getElementById('acronymGrid');
    if (!this.filtered.length) {
      grid.innerHTML = '<article class="panel empty-state"><h3>No matching acronyms</h3><p>Try another keyword or filter.</p></article>';
      return;
    }
    grid.innerHTML = this.filtered.map(item => {
      const stat = this.getStat(item.key);
      const approach = item.approach?.value ? `<span class="badge badge-proactive">${item.approach.value}</span>` : '';
      const conflicts = (item.commonConfusions || []).map(c => `<li><strong>${this.escape(c.with.replace('_PROCESS_FLOW',''))}</strong>: ${this.escape(c.note)}</li>`).join('');
      const meanings = (item.meanings || []).map(m => `<li>${this.escape(m.fullName)} - Element ${m.element}, page ${m.bookPage ?? 'pending'}</li>`).join('');
      return `<article class="acronym-card">
        <header><div><span class="badge">Element ${item.element}</span>${approach}</div><span class="verification ${item.verification.status.toLowerCase()}">${item.verification.status}</span></header>
        <div class="acronym-title"><h2>${this.escape(item.acronym)}</h2><span>${this.escape(item.category || '')}</span></div>
        <h3>${this.escape(item.fullName)}</h3>
        <p>${this.escape(item.officialDescription || '')}</p>
        <dl class="trace-grid"><div><dt>Section</dt><dd>${this.escape(item.section || 'Book context')}</dd></div><div><dt>Book page</dt><dd>${item.bookPage ?? 'Pending'}</dd></div><div><dt>Knowledge</dt><dd>${this.escape(item.knowledgeLevel)}</dd></div><div><dt>Status</dt><dd>${this.escape(stat.status)}</dd></div></dl>
        ${meanings ? `<details><summary>Multiple meanings</summary><ul>${meanings}</ul></details>` : ''}
        ${conflicts ? `<details><summary>Confusions and conflicts</summary><ul>${conflicts}</ul></details>` : ''}
      </article>`;
    }).join('');
  },

  showView(view) {
    ['learn', 'challenge', 'mistakes'].forEach(name => document.getElementById(`${name}View`).classList.toggle('hidden', name !== view));
    document.querySelectorAll('.mode-buttons button').forEach(btn => btn.classList.remove('primary'));
    document.getElementById(`${view}Tab`).classList.add('primary');
    if (view === 'mistakes') this.renderMistakes();
  },

  startChallenge() {
    const pool = this.mode === 'weak'
      ? this.items.filter(item => this.getStat(item.key).wrongCount > 0)
      : [...this.items];
    const source = pool.length >= 4 ? pool : [...this.items];
    this.challengePool = this.mode === 'sequential' ? source.slice(0, this.selectedLength) : this.shuffle(source).slice(0, this.selectedLength);
    this.challengeIndex = 0;
    this.score = 0;
    document.getElementById('challengeSetup').classList.add('hidden');
    document.getElementById('challengeCard').classList.remove('hidden');
    this.nextQuestion(true);
  },

  nextQuestion(initial = false) {
    if (!initial) this.challengeIndex += 1;
    if (this.challengeIndex >= this.challengePool.length) return this.finishChallenge();
    this.current = this.challengePool[this.challengeIndex];
    this.currentOptions = this.buildSmartOptions(this.current);
    document.getElementById('challengeProgress').textContent = `${this.challengeIndex + 1} / ${this.challengePool.length}`;
    document.getElementById('challengeQuestion').textContent = `What does ${this.current.acronym} stand for?`;
    document.getElementById('challengeFeedback').textContent = '';
    document.getElementById('nextAcronym').disabled = true;
    document.getElementById('challengeOptions').innerHTML = this.currentOptions.map((option, index) => `<button class="option" data-option-index="${index}">${this.escape(option.text)}</button>`).join('');
    document.querySelectorAll('#challengeOptions .option').forEach(button => button.addEventListener('click', () => this.answer(button)));
  },

  answer(button) {
    if (document.getElementById('nextAcronym').disabled === false) return;
    const selectedIndex = Number(button.dataset.optionIndex);
    const selectedOption = this.currentOptions[selectedIndex];
    const isCorrect = Boolean(selectedOption?.isCorrect);
    if (isCorrect) this.score += 1;
    this.record(this.current, selectedOption, isCorrect);
    document.querySelectorAll('#challengeOptions .option').forEach(option => {
      option.disabled = true;
      const optionData = this.currentOptions[Number(option.dataset.optionIndex)];
      if (optionData?.isCorrect) option.classList.add('correct');
      else if (option === button) option.classList.add('wrong');
    });
    const ref = `Element ${this.current.element}, book page ${this.current.bookPage ?? 'pending'}`;
    document.getElementById('challengeFeedback').textContent = isCorrect ? `Correct - ${ref}` : `Incorrect - ${this.current.fullName}. ${ref}`;
    document.getElementById('nextAcronym').disabled = false;
  },

  finishChallenge() {
    document.getElementById('challengeQuestion').textContent = `Challenge complete: ${this.score} / ${this.challengePool.length}`;
    document.getElementById('challengeOptions').innerHTML = '';
    document.getElementById('challengeFeedback').textContent = 'Your mistakes and confusion pairs have been saved locally.';
    document.getElementById('nextAcronym').disabled = true;
    document.getElementById('challengeSetup').classList.remove('hidden');
    document.getElementById('challengeCard').classList.add('hidden');
  },


  buildSmartOptions(item) {
    const correct = item.fullName.trim();
    const candidates = [];
    const seen = new Set([correct.toLowerCase()]);
    const add = (text, sourceKey = '') => {
      const clean = String(text || '').replace(/\s+/g, ' ').trim();
      const key = clean.toLowerCase();
      if (!clean || seen.has(key)) return;
      seen.add(key);
      candidates.push({ text: clean, sourceKey, isCorrect: false });
    };

    // Prefer real terms that are linguistically close to the correct expansion.
    this.items
      .filter(other => other.key !== item.key)
      .map(other => ({ other, score: this.phraseSimilarity(correct, other.fullName) + (other.category === item.category ? 0.12 : 0) }))
      .sort((a, b) => b.score - a.score)
      .filter(entry => entry.score >= 0.28)
      .slice(0, 6)
      .forEach(entry => add(entry.other.fullName, entry.other.key));

    // Generate plausible near-miss expansions by changing one important word.
    this.generateNearMisses(correct).forEach(text => add(text));

    // Guaranteed fallback: use the closest real expansions available.
    if (candidates.length < 3) {
      this.items
        .filter(other => other.key !== item.key)
        .map(other => ({ other, score: this.phraseSimilarity(correct, other.fullName) }))
        .sort((a, b) => b.score - a.score)
        .forEach(entry => add(entry.other.fullName, entry.other.key));
    }

    const wrong = candidates.slice(0, 3);
    return this.shuffle([
      { text: correct, sourceKey: item.key, isCorrect: true },
      ...wrong
    ]);
  },

  generateNearMisses(fullName) {
    const replacements = {
      analysis: ['assessment', 'approach', 'audit'],
      assessment: ['analysis', 'evaluation', 'review'],
      safety: ['security', 'system', 'standard'],
      process: ['procedure', 'production', 'protection'],
      protection: ['prevention', 'process', 'performance'],
      management: ['monitoring', 'method', 'maintenance'],
      hazard: ['harm', 'hazardous', 'health'],
      risk: ['reliability', 'response', 'reduction'],
      operational: ['operability', 'operation', 'organisational'],
      operability: ['operational', 'operation', 'operating'],
      study: ['system', 'survey', 'standard'],
      equipment: ['engineering', 'environmental', 'emergency'],
      emergency: ['environmental', 'engineering', 'equipment'],
      control: ['containment', 'coordination', 'condition'],
      integrity: ['inspection', 'integration', 'incident'],
      inspection: ['integrity', 'investigation', 'installation'],
      incident: ['inspection', 'integrity', 'information'],
      information: ['inspection', 'investigation', 'instruction'],
      personal: ['personnel', 'process', 'preventive'],
      executive: ['examination', 'engineering', 'evaluation'],
      board: ['body', 'bureau', 'branch'],
      occupational: ['operational', 'organisational', 'official'],
      health: ['hazard', 'human', 'handling'],
      layer: ['level', 'line', 'limit'],
      failure: ['fault', 'function', 'facility'],
      mode: ['method', 'model', 'measure'],
      effect: ['event', 'evaluation', 'exposure'],
      criticality: ['criteria', 'control', 'classification'],
      permit: ['permission', 'procedure', 'process'],
      work: ['working', 'workplace', 'workflow'],
      change: ['control', 'check', 'condition'],
      reasonably: ['realistically', 'reliably', 'rationally'],
      practicable: ['practical', 'possible', 'permissible']
    };
    const words = fullName.split(/\s+/);
    const results = [];
    words.forEach((word, index) => {
      const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
      (replacements[normalized] || []).forEach(replacement => {
        const changed = [...words];
        changed[index] = this.matchCase(word, replacement);
        results.push(changed.join(' '));
      });
    });

    // A small word-order change creates another convincing distractor for long names.
    if (words.length >= 4) {
      const swapped = [...words];
      [swapped[words.length - 2], swapped[words.length - 1]] = [swapped[words.length - 1], swapped[words.length - 2]];
      results.push(swapped.join(' '));
    }
    return results;
  },

  phraseSimilarity(left, right) {
    const a = this.normalizedWords(left);
    const b = this.normalizedWords(right);
    if (!a.length || !b.length) return 0;
    const aSet = new Set(a);
    const bSet = new Set(b);
    const intersection = [...aSet].filter(word => bSet.has(word)).length;
    const union = new Set([...aSet, ...bSet]).size;
    const tokenScore = union ? intersection / union : 0;
    const initialA = a.map(word => word[0]).join('');
    const initialB = b.map(word => word[0]).join('');
    const initialScore = initialA === initialB ? 0.35 : 0;
    return tokenScore + initialScore;
  },

  normalizedWords(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  },

  matchCase(original, replacement) {
    return /^[A-Z]/.test(original) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
  },

  renderMistakes() {
    const store = this.getStore();
    const rows = this.items.map(item => ({ item, stat: store[item.key] })).filter(x => x.stat?.wrongCount > 0).sort((a, b) => b.stat.wrongCount - a.stat.wrongCount);
    const target = document.getElementById('mistakeList');
    if (!rows.length) {
      target.innerHTML = '<article class="panel empty-state"><h3>No acronym mistakes yet</h3><p>Complete a challenge to build your review list.</p></article>';
      return;
    }
    target.innerHTML = rows.map(({item, stat}) => `<article class="mistake-row"><div><strong>${this.escape(item.acronym)}</strong><span>${this.escape(item.fullName)}</span></div><div><b>${stat.wrongCount}</b><small>wrong</small></div><div><span>${this.escape(stat.selectedWrongOption || 'Not recorded')}</span><small>last selected</small></div><div><span>${this.escape(stat.status)}</span><small>status</small></div></article>`).join('');
  },

  shuffle(values) { return [...values].sort(() => Math.random() - 0.5); },
  escape(value = '') { return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
};

document.addEventListener('DOMContentLoaded', () => AcronymApp.init().catch(error => {
  document.getElementById('acronymGrid').innerHTML = `<article class="panel"><h3>Unable to load acronym data</h3><p>${error.message}</p></article>`;
}));
