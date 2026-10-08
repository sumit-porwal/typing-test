/**
 * Academy Curriculum & Practice Modes Manager for KeyVibe Touch Typing Studio
 * Handles lesson navigation, progress persistence, category filtering, and custom text mode.
 */

import { LESSONS, getRandomWords, getRandomQuote } from './lessons.js';

export class AcademyManager {
  constructor(app) {
    this.app = app;

    // Active practice mode
    this.mode = 'words'; // 'words', 'academy', 'quotes', 'custom', 'zen'
    try {
      const savedMode = localStorage.getItem('keyvibe_mode');
      if (savedMode && ['words', 'academy', 'quotes', 'custom', 'zen'].includes(savedMode)) {
        this.mode = savedMode;
      }
    } catch (_) { }

    this.zenType = 'words'; // 'words', 'time', 'infinity'
    this.zenWords = 25;
    this.zenTime = 30;
    try {
      const savedZenType = localStorage.getItem('keyvibe_zen_type');
      if (savedZenType && ['words', 'time', 'infinity'].includes(savedZenType)) this.zenType = savedZenType;
      const savedZenWords = localStorage.getItem('keyvibe_zen_words');
      if (savedZenWords) this.zenWords = parseInt(savedZenWords, 10);
      const savedZenTime = localStorage.getItem('keyvibe_zen_time');
      if (savedZenTime) this.zenTime = parseInt(savedZenTime, 10);
    } catch (_) { }

    this.currentLessonIdx = 0;
    this.completedLessons = new Set();
    this.academyFilter = 'all';

    try {
      const savedComp = localStorage.getItem('keyvibe_completed_lessons');
      if (savedComp) {
        const arr = JSON.parse(savedComp);
        if (Array.isArray(arr)) this.completedLessons = new Set(arr);
      }
    } catch (_) { }
  }

  init() {
    this.renderLessonSelector();
    this.syncZenUI();
    this.attachListeners();
  }

  attachListeners() {
    // Mode Navigation Tabs
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.setMode(mode);
      });
    });

    // Zen Mode Subbar listeners
    document.querySelectorAll('[data-zen-type]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.zenType;
        this.setZenType(type);
      });
    });

    document.querySelectorAll('[data-zen-words]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.zenWords = parseInt(e.currentTarget.dataset.zenWords, 10);
        try { localStorage.setItem('keyvibe_zen_words', this.zenWords); } catch (_) { }
        this.syncZenUI();
        if (this.mode === 'zen') {
          this.setMode('zen');
        }
      });
    });

    document.querySelectorAll('[data-zen-time]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.zenTime = parseInt(e.currentTarget.dataset.zenTime, 10);
        try { localStorage.setItem('keyvibe_zen_time', this.zenTime); } catch (_) { }
        this.syncZenUI();
        if (this.mode === 'zen') {
          this.setMode('zen');
        }
      });
    });

    // Sub-mode options (Words count, countdown timer)
    document.querySelectorAll('.words-subbar:not(.zen-subbar) .sub-opt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const wordsBar = document.getElementById('words-subbar');
        if (wordsBar) {
          wordsBar.querySelectorAll('.sub-opt-btn').forEach(b => b.classList.remove('active'));
        }
        e.currentTarget.classList.add('active');

        if (e.currentTarget.dataset.words) {
          this.app.settings.wordCount = parseInt(e.currentTarget.dataset.words, 10);
          this.app.settings.timeLimit = 0;
          try {
            localStorage.setItem('keyvibe_words', this.app.settings.wordCount);
            localStorage.setItem('keyvibe_time', 0);
          } catch (_) { }
          this.app.resetTest();
        } else if (e.currentTarget.dataset.time) {
          this.app.settings.timeLimit = parseInt(e.currentTarget.dataset.time, 10);
          try {
            localStorage.setItem('keyvibe_time', this.app.settings.timeLimit);
          } catch (_) { }
          this.app.resetTest();
        }
      });
    });

    // Punctuation & Numbers Toggles
    const togglePunctBtn = document.getElementById('toggle-punct');
    if (togglePunctBtn) {
      togglePunctBtn.addEventListener('click', () => {
        this.app.settings.punctuation = !this.app.settings.punctuation;
        try { localStorage.setItem('keyvibe_punct', this.app.settings.punctuation); } catch (_) { }
        togglePunctBtn.classList.toggle('active', this.app.settings.punctuation);
        this.app.resetTest();
      });
    }

    const toggleNumBtn = document.getElementById('toggle-numbers');
    if (toggleNumBtn) {
      toggleNumBtn.addEventListener('click', () => {
        this.app.settings.numbers = !this.app.settings.numbers;
        try { localStorage.setItem('keyvibe_num', this.app.settings.numbers); } catch (_) { }
        toggleNumBtn.classList.toggle('active', this.app.settings.numbers);
        this.app.resetTest();
      });
    }

    // Dictionary selection
    const dictSelect = document.getElementById('select-dictionary');
    if (dictSelect) {
      dictSelect.addEventListener('change', (e) => {
        this.app.settings.dictionary = e.target.value;
        try { localStorage.setItem('keyvibe_dict', this.app.settings.dictionary); } catch (_) { }
        this.app.resetTest();
      });
    }

    // Academy Prev/Next & Category Filter
    const academyPrevBtn = document.getElementById('btn-academy-prev');
    if (academyPrevBtn) {
      academyPrevBtn.addEventListener('click', () => this.prevLesson());
    }

    const academyNextBtn = document.getElementById('btn-academy-next');
    if (academyNextBtn) {
      academyNextBtn.addEventListener('click', () => this.nextLesson());
    }

    const academyCatSelect = document.getElementById('select-academy-cat');
    if (academyCatSelect) {
      academyCatSelect.addEventListener('change', (e) => {
        this.filterLessons(e.target.value);
      });
    }

    const academyScrollWrapper = document.querySelector('.academy-lessons-scroll-wrapper');
    if (academyScrollWrapper) {
      academyScrollWrapper.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          academyScrollWrapper.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    // Custom text input modal handlers
    const customApplyBtn = document.getElementById('btn-apply-custom');
    const customTextarea = document.getElementById('custom-input-text');
    if (customApplyBtn && customTextarea) {
      customApplyBtn.addEventListener('click', () => {
        const text = customTextarea.value.trim();
        if (text) {
          this.app.targetText = text.replace(/\r\n/g, '\n');
          this.app.resetTest(false);
          document.getElementById('custom-modal')?.classList.remove('open');
        }
      });
    }

    const openCustomBtn = document.getElementById('btn-open-custom');
    if (openCustomBtn) {
      openCustomBtn.addEventListener('click', () => {
        document.getElementById('custom-modal')?.classList.add('open');
      });
    }

    const closeCustomBtn = document.getElementById('btn-close-custom');
    if (closeCustomBtn) {
      closeCustomBtn.addEventListener('click', () => {
        document.getElementById('custom-modal')?.classList.remove('open');
      });
    }
  }

  setZenType(type) {
    this.zenType = type;
    try { localStorage.setItem('keyvibe_zen_type', type); } catch (_) { }
    this.syncZenUI();
    this.setMode('zen');
  }

  syncZenUI() {
    const zenBar = document.getElementById('zen-subbar');
    if (!zenBar) return;

    zenBar.querySelectorAll('[data-zen-type]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.zenType === this.zenType);
    });

    const wordsGroup = document.getElementById('zen-group-words');
    const timeGroup = document.getElementById('zen-group-time');
    const infGroup = document.getElementById('zen-group-infinity');

    if (wordsGroup) wordsGroup.style.display = this.zenType === 'words' ? 'inline-flex' : 'none';
    if (timeGroup) timeGroup.style.display = this.zenType === 'time' ? 'inline-flex' : 'none';
    if (infGroup) infGroup.style.display = this.zenType === 'infinity' ? 'inline-flex' : 'none';

    zenBar.querySelectorAll('[data-zen-words]').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.zenWords, 10) === this.zenWords);
    });

    zenBar.querySelectorAll('[data-zen-time]').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.zenTime, 10) === this.zenTime);
    });
  }

  setMode(mode, lessonIdx = 0) {
    this.mode = mode;
    this.currentLessonIdx = lessonIdx;
    try { localStorage.setItem('keyvibe_mode', mode); } catch (_) { }

    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    const academyBar = document.getElementById('academy-subbar');
    const wordsBar = document.getElementById('words-subbar');
    const zenBar = document.getElementById('zen-subbar');
    if (academyBar) academyBar.style.display = mode === 'academy' ? 'flex' : 'none';
    if (wordsBar) wordsBar.style.display = mode === 'words' ? 'flex' : 'none';
    if (zenBar) zenBar.style.display = mode === 'zen' ? 'flex' : 'none';

    document.body.classList.toggle('zen-mode', mode === 'zen');

    const modeTitle = document.getElementById('current-mode-title');
    const modeDesc = document.getElementById('current-mode-desc');
    const catPill = document.getElementById('academy-cat-pill');
    const targetBadges = document.getElementById('target-keys-badges');
    const shortcutHint = document.getElementById('shortcut-mode-hint');

    if (mode === 'zen') {
      if (catPill) catPill.style.display = 'none';
      if (targetBadges) targetBadges.style.display = 'none';

      let zenTitle = 'Zen Flow';
      let zenDesc = 'Gaze locked at center • Moving conveyor belt • Zero distraction.';

      if (this.zenType === 'words') {
        const words = Math.max(10, parseInt(this.zenWords, 10) || 25);
        zenTitle = `Zen Flow (${words} Words)`;
        this.app.targetText = getRandomWords(words, {
          punctuation: this.app.settings.punctuation,
          numbers: this.app.settings.numbers,
          dictionary: this.app.settings.dictionary
        });
      } else if (this.zenType === 'time') {
        const time = Math.max(10, parseInt(this.zenTime, 10) || 30);
        zenTitle = `Zen Flow (${time}s Countdown)`;
        this.app.targetText = getRandomWords(Math.max(60, time * 2.5), {
          punctuation: this.app.settings.punctuation,
          numbers: this.app.settings.numbers,
          dictionary: this.app.settings.dictionary
        });
      } else if (this.zenType === 'infinity') {
        zenTitle = 'Zen Flow (∞ Infinite Stream)';
        zenDesc = 'Endless fluid typing • Eyes centered on target • Press Esc to finish.';
        this.app.targetText = getRandomWords(80, {
          punctuation: this.app.settings.punctuation,
          numbers: this.app.settings.numbers,
          dictionary: this.app.settings.dictionary
        });
      }

      if (modeTitle) modeTitle.textContent = zenTitle;
      if (modeDesc) modeDesc.textContent = zenDesc;
      if (shortcutHint) shortcutHint.innerHTML = `<kbd>☯ Zen</kbd> Center Cursor &bull; Esc to Stop`;

      this.syncZenUI();
    } else if (mode === 'academy') {
      const l = LESSONS[lessonIdx];
      if (modeTitle) modeTitle.textContent = l.title;
      if (modeDesc) modeDesc.textContent = l.description;

      if (catPill) {
        catPill.style.display = 'inline-block';
        catPill.textContent = l.category;
        catPill.className = 'academy-cat-pill ' + (
          l.category === 'Home Row' ? 'cat-home' :
            l.category === 'Top Row' ? 'cat-top' :
              l.category === 'Bottom Row' ? 'cat-bottom' : 'cat-advanced'
        );
      }

      if (targetBadges) {
        targetBadges.style.display = 'flex';
        targetBadges.innerHTML = l.keys
          .filter(k => k.trim().length > 0 && k !== 'ShiftLeft' && k !== 'ShiftRight')
          .slice(0, 5)
          .map(k => `<span class="target-key-cap">${k.toUpperCase()}</span>`)
          .join('');
      }

      if (shortcutHint) shortcutHint.innerHTML = `<kbd>🎓 Academy</kbd> L${l.level}: ${l.category}`;
      this.app.targetText = l.text;

      if (this.academyFilter !== 'all' && l.category !== this.academyFilter) {
        this.academyFilter = 'all';
        this.renderLessonSelector();
      } else {
        this.updateAcademyNavUI();
      }
    } else {
      if (catPill) catPill.style.display = 'none';
      if (targetBadges) targetBadges.style.display = 'none';

      if (mode === 'words') {
        // Guarantee valid word count (never 0 or NaN)
        let wordCount = parseInt(this.app.settings.wordCount, 10);
        if (isNaN(wordCount) || wordCount < 10) {
          wordCount = 25;
          this.app.settings.wordCount = 25;
        }
        const timeLimit = parseInt(this.app.settings.timeLimit, 10) || 0;
        const modeLabel = timeLimit > 0 ? `${timeLimit}s Countdown` : `${wordCount} Words`;
        if (modeTitle) modeTitle.textContent = `Word Sprint (${modeLabel})`;
        if (modeDesc) {
          const dict = (this.app.settings.dictionary || 'standard').toUpperCase();
          const p = this.app.settings.punctuation ? 'ON' : 'OFF';
          const n = this.app.settings.numbers ? 'ON' : 'OFF';
          modeDesc.textContent = `Type with rhythm and flow. Pool: ${dict}. Punctuation: ${p}, Numbers: ${n}.`;
        }
        if (shortcutHint) shortcutHint.innerHTML = `<kbd>⚡ Words Mode</kbd> ${modeLabel}`;

        const count = timeLimit > 0 ? Math.max(50, timeLimit * 2) : wordCount;
        this.app.targetText = getRandomWords(count, {
          punctuation: this.app.settings.punctuation,
          numbers: this.app.settings.numbers,
          dictionary: this.app.settings.dictionary
        });
      } else if (mode === 'quotes') {
        if (modeTitle) modeTitle.textContent = 'Philosophical & Tech Quotes';
        if (modeDesc) modeDesc.textContent = 'Type inspirational wisdom with proper punctuation and capitalization.';
        if (shortcutHint) shortcutHint.innerHTML = `<kbd>💬 Quotes</kbd> Wisdom`;
        this.app.targetText = getRandomQuote();
      }
    }

    this.app.settings.syncWordsSettingsUI();
    this.app.resetTest(false);
  }

  getActiveTimeLimit() {
    if (this.mode === 'zen') {
      return this.zenType === 'time' ? Math.max(10, parseInt(this.zenTime, 10) || 30) : 0;
    }
    if (this.mode === 'words') {
      return parseInt(this.app.settings.timeLimit, 10) || 0;
    }
    return 0;
  }

  generateModeText() {
    if (this.mode === 'zen') {
      if (this.zenType === 'words') {
        const words = Math.max(10, parseInt(this.zenWords, 10) || 25);
        return getRandomWords(words, {
          punctuation: this.app.settings.punctuation,
          numbers: this.app.settings.numbers,
          dictionary: this.app.settings.dictionary
        });
      } else if (this.zenType === 'time') {
        const time = Math.max(10, parseInt(this.zenTime, 10) || 30);
        return getRandomWords(Math.max(60, time * 2.5), {
          punctuation: this.app.settings.punctuation,
          numbers: this.app.settings.numbers,
          dictionary: this.app.settings.dictionary
        });
      } else {
        return getRandomWords(80, {
          punctuation: this.app.settings.punctuation,
          numbers: this.app.settings.numbers,
          dictionary: this.app.settings.dictionary
        });
      }
    } else if (this.mode === 'words') {
      let wordCount = parseInt(this.app.settings.wordCount, 10);
      if (isNaN(wordCount) || wordCount < 10) {
        wordCount = 25;
        this.app.settings.wordCount = 25;
      }
      const timeLimit = parseInt(this.app.settings.timeLimit, 10) || 0;
      const count = timeLimit > 0 ? Math.max(50, timeLimit * 2) : wordCount;
      return getRandomWords(count, {
        punctuation: this.app.settings.punctuation,
        numbers: this.app.settings.numbers,
        dictionary: this.app.settings.dictionary
      });
    } else if (this.mode === 'quotes') {
      return getRandomQuote();
    } else if (this.mode === 'academy') {
      return LESSONS[this.currentLessonIdx]?.text || LESSONS[0]?.text || '';
    }
    return getRandomWords(25, {
      punctuation: false,
      numbers: false,
      dictionary: 'standard'
    });
  }

  prevLesson() {
    let candidateIndices = [];
    LESSONS.forEach((l, i) => {
      if (this.academyFilter === 'all' || l.category === this.academyFilter) {
        candidateIndices.push(i);
      }
    });
    if (candidateIndices.length === 0) return;
    const pos = candidateIndices.indexOf(this.currentLessonIdx);
    const prevIdx = (pos <= 0) ? candidateIndices[candidateIndices.length - 1] : candidateIndices[pos - 1];
    this.setMode('academy', prevIdx);
  }

  nextLesson() {
    let candidateIndices = [];
    LESSONS.forEach((l, i) => {
      if (this.academyFilter === 'all' || l.category === this.academyFilter) {
        candidateIndices.push(i);
      }
    });
    if (candidateIndices.length === 0) return;
    const pos = candidateIndices.indexOf(this.currentLessonIdx);
    const nextIdx = (pos >= candidateIndices.length - 1 || pos === -1) ? candidateIndices[0] : candidateIndices[pos + 1];
    this.setMode('academy', nextIdx);
  }

  filterLessons(category) {
    this.academyFilter = category;
    if (category !== 'all') {
      const cur = LESSONS[this.currentLessonIdx];
      if (!cur || cur.category !== category) {
        const firstIdx = LESSONS.findIndex(l => l.category === category);
        if (firstIdx !== -1) {
          this.setMode('academy', firstIdx);
          return;
        }
      }
    }
    this.renderLessonSelector();
  }

  renderLessonSelector() {
    const listEl = document.getElementById('academy-lessons-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const catSelect = document.getElementById('select-academy-cat');
    if (catSelect && catSelect.value !== this.academyFilter) {
      catSelect.value = this.academyFilter;
    }

    const badge = document.getElementById('academy-progress-badge');
    if (badge) {
      badge.textContent = `${this.completedLessons.size}/${LESSONS.length} Done`;
    }

    LESSONS.forEach((lesson, idx) => {
      if (this.academyFilter !== 'all' && lesson.category !== this.academyFilter) {
        return;
      }

      const isCompleted = this.completedLessons.has(lesson.id);
      const isActive = (idx === this.currentLessonIdx && this.mode === 'academy');
      const card = document.createElement('div');
      card.className = `lesson-chip ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
      card.dataset.idx = idx;

      // Only show key badges for the active lesson to keep chips clean & legible
      const keysClean = isActive ? lesson.keys
        .filter(k => k.trim() && k !== 'ShiftLeft' && k !== 'ShiftRight')
        .slice(0, 3)
        .map(k => k.toUpperCase())
        .join(' ') : '';

      card.innerHTML = `
        <span class="lesson-chip-num">L${lesson.level}</span>
        <span class="lesson-chip-title">${lesson.title.replace(/^Level \d+:\s*/, '')}</span>
        ${keysClean ? `<span class="lesson-chip-keys">${keysClean}</span>` : ''}
        ${isCompleted ? `<span class="lesson-chip-check" title="Completed">✓</span>` : ''}
      `;

      card.addEventListener('click', () => {
        this.setMode('academy', idx);
      });

      listEl.appendChild(card);

      if (isActive) {
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 80);
      }
    });

    this.updateAcademyNavUI();
  }

  updateAcademyNavUI() {
    const prevBtn = document.getElementById('btn-academy-prev');
    const nextBtn = document.getElementById('btn-academy-next');
    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;

    const badge = document.getElementById('academy-progress-badge');
    if (badge) {
      badge.textContent = `${this.completedLessons.size}/${LESSONS.length} Done`;
    }

    const listEl = document.getElementById('academy-lessons-list');
    if (listEl) {
      listEl.querySelectorAll('.lesson-chip').forEach(c => {
        const isAct = parseInt(c.dataset.idx, 10) === this.currentLessonIdx;
        c.classList.toggle('active', isAct);
        if (isAct) {
          c.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      });
    }
  }

  markLessonComplete(lesson) {
    if (!lesson) return;
    this.completedLessons.add(lesson.id);
    try {
      localStorage.setItem('keyvibe_completed_lessons', JSON.stringify([...this.completedLessons]));
    } catch (_) { }
    this.renderLessonSelector();
  }
}
