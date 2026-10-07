/**
 * Main Application Controller for KeyVibe Touch Typing Studio
 */

import { CHAR_MAP, FINGERS } from './fingerMap.js';
import { sound } from './audio.js';
import { tts } from './tts.js';
import { VirtualKeyboard } from './keyboard.js';
import { VirtualHands } from './hands.js';
import { HandOverlay } from './handOverlay.js';
import { LESSONS, getRandomWords, getRandomQuote, generateWeakKeyDrill } from './lessons.js';

class TypingApp {
  constructor() {
    this.keyboard = new VirtualKeyboard('keyboard-container');
    this.hands = new VirtualHands('hands-container');

    this.overlay = new HandOverlay('keyboard-container');

    // App State - Default to 'words' mode
    this.mode = 'words'; // 'words', 'academy', 'quotes', 'custom'
    try {
      const savedMode = localStorage.getItem('keyvibe_mode');
      if (savedMode && ['words', 'academy', 'quotes', 'custom'].includes(savedMode)) {
        this.mode = savedMode;
      }
    } catch (_) { }

    this.currentLessonIdx = 0;
    this.wordCount = 25;
    this.timeLimit = 0; // 0 for word count mode, or 15/30/60 for timed mode
    this.punctuation = false;
    this.numbers = false;
    this.dictionary = 'standard'; // 'standard', 'expanded', 'code'

    try {
      const savedWords = localStorage.getItem('keyvibe_words');
      if (savedWords) this.wordCount = parseInt(savedWords, 10);
      const savedTime = localStorage.getItem('keyvibe_time');
      if (savedTime) this.timeLimit = parseInt(savedTime, 10);
      if (localStorage.getItem('keyvibe_punct') === 'true') this.punctuation = true;
      if (localStorage.getItem('keyvibe_num') === 'true') this.numbers = true;
      const savedDict = localStorage.getItem('keyvibe_dict');
      if (savedDict) this.dictionary = savedDict;
    } catch (_) { }

    this.targetText = '';
    this.charIndex = 0;
    this.typedChars = []; // Array of { char, expected, isCorrect, timestamp, finger }
    this.fingerStats = {
      LP: { total: 0, errors: 0 },
      LR: { total: 0, errors: 0 },
      LM: { total: 0, errors: 0 },
      LI: { total: 0, errors: 0 },
      LT: { total: 0, errors: 0 },
      RT: { total: 0, errors: 0 },
      RI: { total: 0, errors: 0 },
      RM: { total: 0, errors: 0 },
      RR: { total: 0, errors: 0 },
      RP: { total: 0, errors: 0 }
    };
    this.missedKeys = {};

    this.startTime = null;
    this.timerInterval = null;
    this.streak = 0;
    this.maxStreak = 0;
    this.isFinished = false;
    this.totalKeyStrokes = 0;
    this.correctKeyStrokes = 0;

    // Timeline Graph & Rhythm Metrics
    this.wpmHistory = []; // [ { time, wpm, rawWpm, errors } ]
    this.keystrokeIntervals = []; // ms between consecutive keystrokes
    this.lastKeystrokeTime = null;
    this.currentSecondErrors = 0;
    this.lastTabTime = 0;

    // Elements
    this.textDisplayEl = document.getElementById('text-display');
    this.caretEl = document.getElementById('typing-caret');
    this.statWpmEl = document.getElementById('stat-wpm');
    this.statAccEl = document.getElementById('stat-acc');
    this.statStreakEl = document.getElementById('stat-streak');
    this.statTimeEl = document.getElementById('stat-time');
    this.modalEl = document.getElementById('result-modal');
    this.toastEl = document.getElementById('toast-notification');
    this.confettiCanvas = document.getElementById('celebration-canvas');
    this.typingActiveTimeout = null;

    // Cursor Style: 'line', 'block', 'underline', 'outline'
    this.cursorStyle = 'line';
    try {
      const savedCursor = localStorage.getItem('keyvibe_cursor_style');
      if (savedCursor && ['line', 'block', 'underline', 'outline'].includes(savedCursor)) {
        this.cursorStyle = savedCursor;
      }
    } catch (_) { }

    // Keyboard Layout Theme and Dimensions
    this.kbTheme = 'cyber-dark';
    this.kbWidth = 100;
    this.kbHeight = 35;
    try {
      const savedTheme = localStorage.getItem('keyvibe_kb_theme');
      if (savedTheme) this.kbTheme = savedTheme;
      const savedWidth = localStorage.getItem('keyvibe_kb_width');
      if (savedWidth) this.kbWidth = parseInt(savedWidth, 10);
      const savedHeight = localStorage.getItem('keyvibe_kb_height');
      if (savedHeight) this.kbHeight = parseInt(savedHeight, 10);
    } catch (_) { }

    // Keyboard Visibility State
    this.showKeyboard = true;
    try {
      const savedKb = localStorage.getItem('keyvibe_show_keyboard');
      if (savedKb !== null) this.showKeyboard = (savedKb === 'true');
    } catch (_) { }

    // Academy Completed Lessons State
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
    // Render Components
    this.keyboard.render();
    this.hands.render();
    this.overlay.init();

    // Hook TTS status wave
    tts.onSpeakingChange = (isSpeaking) => {
      this.hands.setTTSActive(isSpeaking);
    };

    // Attach Event Listeners
    this._attachEventListeners();
    this._populateVoiceList();
    this._renderLessonSelector();
    this._syncSoundUI();
    this._syncCursorUI();
    this._applyKeyboardSettings();
    this._syncHandSettingsUI();
    this._syncWordsSettingsUI();
    this._syncKeyboardVisibilityUI();

    // Caret update on resize or font load
    window.addEventListener('resize', () => {
      this._updateCaretPosition();
      if (this.overlay) this.overlay.updatePositions(true);
    });
    if (document.fonts) {
      document.fonts.ready.then(() => this._updateCaretPosition());
    }

    // Load initial mode (defaults to 'words')
    this.setMode(this.mode, this.currentLessonIdx);
  }



  _attachEventListeners() {
    // Global keyboard listener
    window.addEventListener('keydown', (e) => this._handleKeyDown(e));
    window.addEventListener('keyup', (e) => this._handleKeyUp(e));

    // Mode Buttons
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.setMode(mode);
      });
    });

    // Sub-mode options (Words count, timed)
    document.querySelectorAll('.sub-opt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const wordsBar = document.getElementById('words-subbar');
        if (wordsBar) {
          wordsBar.querySelectorAll('.sub-opt-btn').forEach(b => b.classList.remove('active'));
        }
        e.currentTarget.classList.add('active');

        if (e.currentTarget.dataset.words) {
          this.wordCount = parseInt(e.currentTarget.dataset.words, 10);
          this.timeLimit = 0;
          try {
            localStorage.setItem('keyvibe_words', this.wordCount);
            localStorage.setItem('keyvibe_time', 0);
          } catch (_) { }
          this.resetTest();
        } else if (e.currentTarget.dataset.time) {
          this.timeLimit = parseInt(e.currentTarget.dataset.time, 10);
          try {
            localStorage.setItem('keyvibe_time', this.timeLimit);
          } catch (_) { }
          this.resetTest();
        }
      });
    });

    // Punctuation & Numbers Toggles
    const togglePunctBtn = document.getElementById('toggle-punct');
    if (togglePunctBtn) {
      togglePunctBtn.addEventListener('click', () => {
        this.punctuation = !this.punctuation;
        try { localStorage.setItem('keyvibe_punct', this.punctuation); } catch (_) { }
        togglePunctBtn.classList.toggle('active', this.punctuation);
        this.resetTest();
      });
    }

    const toggleNumBtn = document.getElementById('toggle-numbers');
    if (toggleNumBtn) {
      toggleNumBtn.addEventListener('click', () => {
        this.numbers = !this.numbers;
        try { localStorage.setItem('keyvibe_num', this.numbers); } catch (_) { }
        toggleNumBtn.classList.toggle('active', this.numbers);
        this.resetTest();
      });
    }

    // Dictionary selection
    const dictSelect = document.getElementById('select-dictionary');
    if (dictSelect) {
      dictSelect.addEventListener('change', (e) => {
        this.dictionary = e.target.value;
        try { localStorage.setItem('keyvibe_dict', this.dictionary); } catch (_) { }
        this.resetTest();
      });
    }

    // Modal buttons & actions
    const modalCloseBtn = document.getElementById('btn-modal-close');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => this._hideModal());

    const modalRetryBtn = document.getElementById('btn-modal-retry');
    if (modalRetryBtn) {
      modalRetryBtn.addEventListener('click', () => {
        this._hideModal();
        this.resetTest(false);
      });
    }

    const modalNextBtn = document.getElementById('btn-modal-next');
    if (modalNextBtn) {
      modalNextBtn.addEventListener('click', () => {
        this._hideModal();
        if (this.mode === 'academy') {
          this.nextLesson();
        } else {
          this.resetTest(true);
        }
      });
    }

    const modalCopyBtn = document.getElementById('btn-modal-copy');
    if (modalCopyBtn) modalCopyBtn.addEventListener('click', () => this._copyStatsSummary());

    const modalWeakBtn = document.getElementById('btn-practice-weak');
    if (modalWeakBtn) modalWeakBtn.addEventListener('click', () => this._startWeakKeysDrill());

    // Text Display Focus & Blur Handling
    if (this.textDisplayEl) {
      this.textDisplayEl.addEventListener('focus', () => {
        this.textDisplayEl.classList.remove('blurred');
      });
      this.textDisplayEl.addEventListener('blur', () => {
        if (!this.isFinished && !document.getElementById('custom-modal').classList.contains('open') && !document.getElementById('settings-drawer').classList.contains('open')) {
          this.textDisplayEl.classList.add('blurred');
        }
      });
      this.textDisplayEl.addEventListener('click', () => {
        this.textDisplayEl.focus();
        this.textDisplayEl.classList.remove('blurred');
      });
    }

    const focusNotice = document.getElementById('focus-notice');
    if (focusNotice) {
      focusNotice.addEventListener('click', () => {
        if (this.textDisplayEl) {
          this.textDisplayEl.focus();
          this.textDisplayEl.classList.remove('blurred');
        }
      });
    }

    // Restart button
    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) restartBtn.addEventListener('click', () => this.resetTest());

    // Header Sound Toggle Button
    const toggleSoundBtn = document.getElementById('btn-toggle-sound');
    if (toggleSoundBtn) {
      toggleSoundBtn.addEventListener('click', (e) => {
        if (e.shiftKey) {
          sound.toggleMute();
        } else {
          sound.cycleProfile();
        }
        this._syncSoundUI();
      });
    }

    // Header Cursor Style Toggle Button
    const toggleCursorBtn = document.getElementById('btn-toggle-cursor');
    if (toggleCursorBtn) {
      toggleCursorBtn.addEventListener('click', () => {
        this.cycleCursorStyle();
      });
    }

    // Cursor Presets in Settings Drawer
    const cursorPresets = document.getElementById('cursor-presets');
    if (cursorPresets) {
      cursorPresets.querySelectorAll('.sub-opt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const style = e.currentTarget.dataset.cursor;
          if (style) this.setCursorStyle(style);
        });
      });
    }

    // Hand Overlay Transparency Slider
    const handOpacitySlider = document.getElementById('slider-hand-opacity');
    if (handOpacitySlider) {
      handOpacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.overlay) this.overlay.setOpacity(val / 100);
        const badge = document.getElementById('val-hand-opacity');
        if (badge) badge.textContent = `${val}%`;
      });
    }

    // Hand Overlay Thickness Slider
    const handThicknessSlider = document.getElementById('slider-hand-thickness');
    if (handThicknessSlider) {
      handThicknessSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.overlay) this.overlay.setThickness(val / 100);
        const badge = document.getElementById('val-hand-thickness');
        if (badge) badge.textContent = `${val}%`;
      });
    }

    // Keyboard Color Theme Select (Dropdown fallback)
    const kbThemeSelect = document.getElementById('select-kb-theme');
    if (kbThemeSelect) {
      kbThemeSelect.addEventListener('change', (e) => {
        this.setKeyboardTheme(e.target.value);
      });
    }

    // Keyboard Visual Theme Cards (Interactive Swatches)
    const themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.dataset.theme;
        if (theme) {
          this.setKeyboardTheme(theme);
        }
      });
    });

    // Keyboard Width Slider
    const kbWidthSlider = document.getElementById('slider-kb-width');
    if (kbWidthSlider) {
      kbWidthSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setKeyboardSize(val, undefined);
        const badge = document.getElementById('val-kb-width');
        if (badge) badge.textContent = `${val}%`;
      });
    }

    // Key Cap Height Slider
    const kbHeightSlider = document.getElementById('slider-kb-height');
    if (kbHeightSlider) {
      kbHeightSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setKeyboardSize(undefined, val);
        const badge = document.getElementById('val-kb-height');
        if (badge) badge.textContent = `${val}px`;
      });
    }

    // Sound Profile Select / Preview in Settings
    const soundProfileSelect = document.getElementById('select-sound-profile');
    if (soundProfileSelect) {
      soundProfileSelect.value = sound.getProfile();
      soundProfileSelect.addEventListener('change', (e) => {
        sound.setProfile(e.target.value, true);
        this._syncSoundUI();
      });
    }

    const soundPreviewBtn = document.getElementById('btn-sound-preview');
    if (soundPreviewBtn) {
      soundPreviewBtn.addEventListener('click', () => {
        sound.playKeypress(false, 'f', 'KeyF');
      });
    }

    const soundReleaseBtn = document.getElementById('btn-toggle-sound-release');
    if (soundReleaseBtn) {
      soundReleaseBtn.addEventListener('click', () => {
        sound.toggleKeyRelease();
        this._syncSoundUI();
      });
    }

    const soundVolumeSlider = document.getElementById('slider-sound-vol');
    if (soundVolumeSlider) {
      soundVolumeSlider.value = Math.round(sound.volume * 100);
      const soundVolVal = document.getElementById('val-sound-vol');
      if (soundVolVal) soundVolVal.textContent = `${soundVolumeSlider.value}%`;
      soundVolumeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        sound.setVolume(val / 100);
        if (soundVolVal) soundVolVal.textContent = `${val}%`;
      });
    }

    const ttsModeSelect = document.getElementById('select-tts-mode');
    if (ttsModeSelect) {
      ttsModeSelect.addEventListener('change', (e) => tts.setMode(e.target.value));
    }

    const ttsRateSlider = document.getElementById('slider-tts-rate');
    if (ttsRateSlider) {
      const ttsRateVal = document.getElementById('val-tts-rate');
      if (ttsRateVal) ttsRateVal.textContent = `${ttsRateSlider.value}x`;
      ttsRateSlider.addEventListener('input', (e) => {
        tts.setRate(e.target.value);
        if (ttsRateVal) ttsRateVal.textContent = `${e.target.value}x`;
      });
    }

    const ttsTestBtn = document.getElementById('btn-tts-test');
    if (ttsTestBtn) {
      ttsTestBtn.addEventListener('click', () => {
        tts.announceFeedback('Touch typing coach online. Place your fingers on home row.');
      });
    }

    // Settings Drawer Category Filter Tabs (All, Sound, Hands, Keyboard, Cursor, Voice)
    const drawerTabs = document.querySelectorAll('.drawer-tab');
    const settingsCards = document.querySelectorAll('.settings-card');
    drawerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        drawerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const selectedCategory = tab.dataset.tab;
        settingsCards.forEach(card => {
          if (selectedCategory === 'all' || card.dataset.card === selectedCategory) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      });
    });

    // Reset Studio Settings Defaults
    const resetSettingsBtn = document.getElementById('btn-reset-settings');
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', () => {
        // Reset Audio
        sound.setProfile('thock', false);
        sound.setVolume(0.5);
        if (sound.isMuted) sound.toggleMute();

        // Reset Hand Overlay
        if (this.overlay) {
          this.overlay.setOpacity(0.5);
          this.overlay.setThickness(1.0);
          if (!this.overlay.isEnabled) this.overlay.toggleOverlay();
        }

        // Reset Keyboard
        this.kbTheme = 'cyber-dark';
        this.kbWidth = 100;
        this.kbHeight = 35;
        try {
          localStorage.setItem('keyvibe_kb_theme', 'cyber-dark');
          localStorage.setItem('keyvibe_kb_width', '100');
          localStorage.setItem('keyvibe_kb_height', '35');
        } catch (_) { }
        this._applyKeyboardSettings();

        // Reset Cursor
        this.setCursorStyle('line');

        // Reset Voice
        tts.setMode('coach');
        tts.setRate(1.1);

        // Sync all UI states
        this._syncSoundUI();
        this._syncCursorUI();
        this._syncHandSettingsUI();

        // Button confirmation badge
        const origText = resetSettingsBtn.innerHTML;
        resetSettingsBtn.innerHTML = '✓ Restored!';
        resetSettingsBtn.style.borderColor = '#4ade80';
        resetSettingsBtn.style.color = '#4ade80';
        setTimeout(() => {
          resetSettingsBtn.innerHTML = origText;
          resetSettingsBtn.style.borderColor = '';
          resetSettingsBtn.style.color = '';
        }, 1500);

        sound.playSuccessChime();
      });
    }

    // Hands Overlay Toggle
    const toggleHandsBtn = document.getElementById('btn-toggle-hands');
    if (toggleHandsBtn) {
      toggleHandsBtn.addEventListener('click', () => {
        if (!this.showKeyboard) return;
        const isEnabled = this.overlay ? this.overlay.toggleOverlay() : true;
        toggleHandsBtn.classList.toggle('active', isEnabled);
        const handsRoom = document.querySelector('.hands-room');
        if (handsRoom) handsRoom.classList.toggle('collapsed', !isEnabled);
      });
    }

    // Virtual Keyboard Visibility Toggle
    const toggleKbBtn = document.getElementById('btn-toggle-keyboard');
    if (toggleKbBtn) {
      toggleKbBtn.addEventListener('click', () => {
        this.toggleKeyboard();
      });
    }

    const settingKbToggleBtn = document.getElementById('btn-setting-kb-toggle');
    if (settingKbToggleBtn) {
      settingKbToggleBtn.addEventListener('click', () => {
        this.toggleKeyboard();
      });
    }

    // Academy Controls
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
        this._filterAcademyLessons(e.target.value);
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

    // Focus typing area when clicking anywhere
    document.addEventListener('click', (e) => {
      if (!e.target.closest('input, select, textarea, button, .modal-content')) {
        window.focus();
      }
    });

    // Custom text input apply button
    const customApplyBtn = document.getElementById('btn-apply-custom');
    const customTextarea = document.getElementById('custom-input-text');
    if (customApplyBtn && customTextarea) {
      customApplyBtn.addEventListener('click', () => {
        const text = customTextarea.value.trim();
        if (text) {
          this.targetText = text.replace(/\r\n/g, '\n');
          this.resetTest(false);
          document.getElementById('custom-modal').classList.remove('open');
        }
      });
    }

    const openCustomBtn = document.getElementById('btn-open-custom');
    if (openCustomBtn) {
      openCustomBtn.addEventListener('click', () => {
        document.getElementById('custom-modal').classList.add('open');
      });
    }

    const closeCustomBtn = document.getElementById('btn-close-custom');
    if (closeCustomBtn) {
      closeCustomBtn.addEventListener('click', () => {
        document.getElementById('custom-modal').classList.remove('open');
      });
    }
  }

  _syncSoundUI() {
    const profile = sound.getProfile();
    const isMuted = sound.isMuted || profile === 'off';
    const profileLabels = {
      thock: 'Thock',
      clicky: 'Clicky',
      typewriter: 'Typewriter',
      soft: 'Chiclet',
      cherry_black: 'Cherry Black',
      voice: 'Voice',
      off: 'Muted'
    };

    const toggleBtn = document.getElementById('btn-toggle-sound');
    const toggleIcon = document.getElementById('sound-toggle-icon');
    const toggleLabel = document.getElementById('sound-toggle-label');
    const select = document.getElementById('select-sound-profile');

    if (toggleIcon) toggleIcon.textContent = isMuted ? '🔇' : '🔊';
    if (toggleLabel) toggleLabel.textContent = profileLabels[profile] || 'Sound';
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', !isMuted);
      toggleBtn.title = isMuted
        ? 'Keyboard Sound: Muted (Click to cycle profile, Shift+Click to unmute)'
        : `Keyboard Sound: ${profileLabels[profile]} (Click to cycle profile, Shift+Click to mute)`;
    }

    if (select && select.value !== profile) {
      select.value = profile;
    }

    const soundVolumeSlider = document.getElementById('slider-sound-vol');
    const soundVolVal = document.getElementById('val-sound-vol');
    if (soundVolumeSlider) {
      const volPct = Math.round(sound.volume * 100);
      soundVolumeSlider.value = volPct;
      if (soundVolVal) soundVolVal.textContent = `${volPct}%`;
    }

    const releaseBtn = document.getElementById('btn-toggle-sound-release');
    if (releaseBtn) {
      releaseBtn.classList.toggle('active', sound.enableKeyRelease);
      releaseBtn.textContent = sound.enableKeyRelease ? 'ENABLED' : 'MUTED';
    }
  }

  setCursorStyle(style) {
    if (!['line', 'block', 'underline', 'outline'].includes(style)) return;
    this.cursorStyle = style;
    try {
      localStorage.setItem('keyvibe_cursor_style', style);
    } catch (_) { }
    this._syncCursorUI();
    this._updateCaretPosition();
  }

  cycleCursorStyle() {
    const styles = ['line', 'block', 'underline', 'outline'];
    const idx = styles.indexOf(this.cursorStyle);
    const nextStyle = styles[(idx + 1) % styles.length];
    this.setCursorStyle(nextStyle);
    return nextStyle;
  }

  _syncCursorUI() {
    const style = this.cursorStyle;
    const styleLabels = {
      line: 'Line',
      block: 'Block',
      underline: 'Underline',
      outline: 'Outline'
    };
    const styleIcons = {
      line: '|',
      block: '█',
      underline: '_',
      outline: '▢'
    };

    const toggleBtn = document.getElementById('btn-toggle-cursor');
    const toggleIcon = document.getElementById('cursor-toggle-icon');
    const toggleLabel = document.getElementById('cursor-toggle-label');

    if (toggleIcon) toggleIcon.textContent = styleIcons[style] || '|';
    if (toggleLabel) toggleLabel.textContent = styleLabels[style] || 'Line';
    if (toggleBtn) {
      toggleBtn.title = `Cursor Style: ${styleLabels[style]} (Click to cycle)`;
    }

    const presets = document.getElementById('cursor-presets');
    if (presets) {
      presets.querySelectorAll('.sub-opt-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cursor === style);
      });
    }

    if (this.caretEl) {
      this.caretEl.classList.remove('cursor-line', 'cursor-block', 'cursor-underline', 'cursor-outline');
      this.caretEl.classList.add(`cursor-${style}`);
    }
  }

  setKeyboardTheme(theme) {
    this.kbTheme = theme;
    try {
      localStorage.setItem('keyvibe_kb_theme', theme);
    } catch (_) { }
    this._applyKeyboardSettings();
  }

  setKeyboardSize(width, height) {
    if (width !== undefined) {
      this.kbWidth = Math.max(65, Math.min(100, width));
      try { localStorage.setItem('keyvibe_kb_width', String(this.kbWidth)); } catch (_) { }
    }
    if (height !== undefined) {
      this.kbHeight = Math.max(26, Math.min(52, height));
      try { localStorage.setItem('keyvibe_kb_height', String(this.kbHeight)); } catch (_) { }
    }
    this._applyKeyboardSettings();
  }

  _applyKeyboardSettings() {
    document.body.setAttribute('data-kb-theme', this.kbTheme);
    document.documentElement.style.setProperty('--kb-width', `${this.kbWidth}%`);
    document.documentElement.style.setProperty('--kb-key-height', `${this.kbHeight}px`);

    // Recalibrate overlay positions when keyboard dimensions change
    setTimeout(() => {
      if (this.overlay2D) this.overlay2D.updatePositions(true);
      if (this.overlay3D) this.overlay3D.updatePositions();
    }, 40);
    this._syncHandSettingsUI();
  }

  _syncHandSettingsUI() {
    if (this.overlay) {
      const opacitySlider = document.getElementById('slider-hand-opacity');
      const opacityVal = document.getElementById('val-hand-opacity');
      if (opacitySlider) {
        const pct = Math.round(this.overlay.opacity * 100);
        opacitySlider.value = pct;
        if (opacityVal) opacityVal.textContent = `${pct}%`;
      }

      const thicknessSlider = document.getElementById('slider-hand-thickness');
      const thicknessVal = document.getElementById('val-hand-thickness');
      if (thicknessSlider) {
        const pct = Math.round((this.overlay.handScale || 1.0) * 100);
        thicknessSlider.value = pct;
        if (thicknessVal) thicknessVal.textContent = `${pct}%`;
      }
    }

    // Keyboard controls
    const themeSelect = document.getElementById('select-kb-theme');
    if (themeSelect && themeSelect.value !== this.kbTheme) {
      themeSelect.value = this.kbTheme;
    }

    // Synchronize visual swatch cards
    const themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(c => {
      c.classList.toggle('active', c.dataset.theme === this.kbTheme);
    });

    const widthSlider = document.getElementById('slider-kb-width');
    const widthVal = document.getElementById('val-kb-width');
    if (widthSlider) {
      widthSlider.value = this.kbWidth;
      if (widthVal) widthVal.textContent = `${this.kbWidth}%`;
    }

    const heightSlider = document.getElementById('slider-kb-height');
    const heightVal = document.getElementById('val-kb-height');
    if (heightSlider) {
      heightSlider.value = this.kbHeight;
      if (heightVal) heightVal.textContent = `${this.kbHeight}px`;
    }

    // Synchronize TTS settings UI
    const ttsModeSelect = document.getElementById('select-tts-mode');
    if (ttsModeSelect && tts.mode) {
      ttsModeSelect.value = tts.mode;
    }
    const ttsRateSlider = document.getElementById('slider-tts-rate');
    const ttsRateVal = document.getElementById('val-tts-rate');
    if (ttsRateSlider && tts.rate) {
      ttsRateSlider.value = tts.rate;
      if (ttsRateVal) ttsRateVal.textContent = `${tts.rate}x`;
    }
  }

  _populateVoiceList() {
    const voiceSelect = document.getElementById('select-tts-voice');
    if (!voiceSelect) return;

    const populate = () => {
      const voices = tts.getVoices();
      if (!voices.length) return;
      voiceSelect.innerHTML = '';
      voices.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.name;
        opt.textContent = `${voice.name} (${voice.lang})`;
        if (tts.selectedVoice && tts.selectedVoice.name === voice.name) {
          opt.selected = true;
        }
        voiceSelect.appendChild(opt);
      });
    };

    populate();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        tts.initVoices();
        populate();
      };
    }

    voiceSelect.addEventListener('change', (e) => {
      tts.setVoiceByName(e.target.value);
    });
  }



  toggleKeyboard(forceState) {
    if (forceState !== undefined) {
      this.showKeyboard = !!forceState;
    } else {
      this.showKeyboard = !this.showKeyboard;
    }

    try {
      localStorage.setItem('keyvibe_show_keyboard', String(this.showKeyboard));
    } catch (_) { }

    this._syncKeyboardVisibilityUI();
    if (this.showKeyboard) {
      this._showToast('⌨️ Virtual Keyboard Visible');
    } else {
      this._showToast('👁️ Blind Typing Mode Active (Keyboard Hidden)');
    }
  }

  _syncKeyboardVisibilityUI() {
    const kbSection = document.querySelector('.keyboard-section');
    const handsRoom = document.querySelector('.hands-room');
    const zenNotice = document.getElementById('zen-mode-notice');
    const kbToggleBtn = document.getElementById('btn-toggle-keyboard');
    const handsBtn = document.getElementById('btn-toggle-hands');
    const settingKbBtn = document.getElementById('btn-setting-kb-toggle');

    if (kbSection) {
      kbSection.classList.toggle('hidden', !this.showKeyboard);
    }

    if (zenNotice) {
      zenNotice.style.display = this.showKeyboard ? 'none' : 'flex';
    }

    if (kbToggleBtn) {
      kbToggleBtn.classList.toggle('active', this.showKeyboard);
      kbToggleBtn.setAttribute('aria-pressed', String(this.showKeyboard));
    }

    if (settingKbBtn) {
      settingKbBtn.classList.toggle('active', this.showKeyboard);
      settingKbBtn.textContent = this.showKeyboard ? 'VISIBLE' : 'HIDDEN';
    }

    if (handsBtn) {
      handsBtn.classList.toggle('disabled', !this.showKeyboard);
      handsBtn.title = this.showKeyboard
        ? 'Toggle realistic hand overlay on keyboard'
        : 'Hands overlay unavailable while keyboard is hidden';
    }

    if (handsRoom) {
      const handsActive = handsBtn && handsBtn.classList.contains('active');
      handsRoom.classList.toggle('collapsed', !this.showKeyboard || !handsActive);
    }

    // Hand overlays visibility
    if (!this.showKeyboard) {
      if (this.overlay && this.overlay.svg) this.overlay.svg.style.display = 'none';
    } else {
      if (this.overlay && this.overlay.svg) {
        this.overlay.svg.style.display = this.overlay.isEnabled ? 'block' : 'none';
        this.overlay.updatePositions(true);
      }
    }
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

  _filterAcademyLessons(category) {
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
    this._renderLessonSelector();
  }

  _renderLessonSelector() {
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

      const keysClean = lesson.keys
        .filter(k => k.trim() && k !== 'ShiftLeft' && k !== 'ShiftRight')
        .slice(0, 3)
        .map(k => k.toUpperCase())
        .join(' ');

      card.innerHTML = `
        <span class="lesson-chip-num">L${lesson.level}</span>
        <span class="lesson-chip-title">${lesson.title.replace(/^Level \d+:\s*/, '')}</span>
        ${keysClean ? `<span class="lesson-chip-keys">${keysClean}</span>` : ''}
        ${isCompleted ? `<span class="lesson-chip-check">✓</span>` : ''}
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

    this._updateAcademyNavUI();
  }

  _updateAcademyNavUI() {
    const prevBtn = document.getElementById('btn-academy-prev');
    const nextBtn = document.getElementById('btn-academy-next');
    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;

    const badge = document.getElementById('academy-progress-badge');
    if (badge) {
      badge.textContent = `${this.completedLessons.size}/${LESSONS.length} Done`;
    }

    // Highlight active chip and scroll into view
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

  _syncWordsSettingsUI() {
    const punctBtn = document.getElementById('toggle-punct');
    if (punctBtn) punctBtn.classList.toggle('active', this.punctuation);

    const numBtn = document.getElementById('toggle-numbers');
    if (numBtn) numBtn.classList.toggle('active', this.numbers);

    const dictSelect = document.getElementById('select-dictionary');
    if (dictSelect) dictSelect.value = this.dictionary;

    const wordsBar = document.getElementById('words-subbar');
    if (wordsBar) {
      wordsBar.querySelectorAll('.sub-opt-btn').forEach(btn => {
        if (this.timeLimit > 0) {
          btn.classList.toggle('active', btn.dataset.time === String(this.timeLimit));
        } else {
          btn.classList.toggle('active', btn.dataset.words === String(this.wordCount));
        }
      });
    }
  }

  setMode(mode, lessonIdx = 0) {
    this.mode = mode;
    this.currentLessonIdx = lessonIdx;
    try { localStorage.setItem('keyvibe_mode', mode); } catch (_) { }

    // Update active tab in header nav
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // Show/hide sub-bars
    const academyBar = document.getElementById('academy-subbar');
    const wordsBar = document.getElementById('words-subbar');
    if (academyBar) academyBar.style.display = mode === 'academy' ? 'flex' : 'none';
    if (wordsBar) wordsBar.style.display = mode === 'words' ? 'flex' : 'none';

    // Update title description and bottom shortcut hint
    const modeTitle = document.getElementById('current-mode-title');
    const modeDesc = document.getElementById('current-mode-desc');
    const catPill = document.getElementById('academy-cat-pill');
    const targetBadges = document.getElementById('target-keys-badges');
    const shortcutHint = document.getElementById('shortcut-mode-hint');

    if (mode === 'academy') {
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
      this.targetText = l.text;
      if (this.academyFilter !== 'all' && l.category !== this.academyFilter) {
        this.academyFilter = 'all';
        this._renderLessonSelector();
      } else {
        this._updateAcademyNavUI();
      }
    } else {
      if (catPill) catPill.style.display = 'none';
      if (targetBadges) targetBadges.style.display = 'none';

      if (mode === 'words') {
        const modeLabel = this.timeLimit > 0 ? `${this.timeLimit}s Countdown` : `${this.wordCount} Words`;
        if (modeTitle) modeTitle.textContent = `Word Sprint (${modeLabel})`;
        if (modeDesc) modeDesc.textContent = `Type with rhythm and flow. Pool: ${this.dictionary.toUpperCase()}. Punctuation: ${this.punctuation ? 'ON' : 'OFF'}, Numbers: ${this.numbers ? 'ON' : 'OFF'}.`;
        if (shortcutHint) shortcutHint.innerHTML = `<kbd>⚡ Words Mode</kbd> ${modeLabel}`;

        const count = this.timeLimit > 0 ? Math.max(50, this.timeLimit * 2) : this.wordCount;
        this.targetText = getRandomWords(count, {
          punctuation: this.punctuation,
          numbers: this.numbers,
          dictionary: this.dictionary
        });
      } else if (mode === 'quotes') {
        if (modeTitle) modeTitle.textContent = 'Philosophical & Tech Quotes';
        if (modeDesc) modeDesc.textContent = 'Type inspirational wisdom with proper punctuation and capitalization.';
        if (shortcutHint) shortcutHint.innerHTML = `<kbd>💬 Quotes</kbd> Wisdom`;
        this.targetText = getRandomQuote();
      }
    }

    this._syncWordsSettingsUI();
    this.resetTest(false);
  }

  resetTest(regenerateText = true) {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.startTime = null;
    this.charIndex = 0;
    this.typedChars = [];
    this.streak = 0;
    this.maxStreak = 0;
    this.isFinished = false;
    this.totalKeyStrokes = 0;
    this.correctKeyStrokes = 0;

    // Reset Graph & Rhythm Tracking
    this.wpmHistory = [];
    this.keystrokeIntervals = [];
    this.lastKeystrokeTime = null;
    this.currentSecondErrors = 0;

    // Reset finger stats
    Object.keys(this.fingerStats).forEach(f => {
      this.fingerStats[f].total = 0;
      this.fingerStats[f].errors = 0;
    });
    this.missedKeys = {};

    if (regenerateText) {
      if (this.mode === 'words') {
        const count = this.timeLimit > 0 ? Math.max(50, this.timeLimit * 2) : this.wordCount;
        this.targetText = getRandomWords(count, {
          punctuation: this.punctuation,
          numbers: this.numbers,
          dictionary: this.dictionary
        });
      } else if (this.mode === 'quotes') {
        this.targetText = getRandomQuote();
      }
    }

    if (this.statTimeEl) {
      this.statTimeEl.textContent = this.timeLimit > 0 ? `${this.timeLimit}s` : '0s';
    }

    this._renderTextDisplay();
    this._updateLiveStats();
    this._highlightCurrentTarget();
    this.hands.setStatusTag('READY', 'ready');
  }

  _renderTextDisplay() {
    if (!this.textDisplayEl) return;
    this.textDisplayEl.innerHTML = '';

    const frag = document.createDocumentFragment();
    let currentWordEl = null;

    for (let i = 0; i < this.targetText.length; i++) {
      const char = this.targetText[i];

      if (char === ' ') {
        currentWordEl = null; // Close current word token
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'char-token char-space';
        spaceSpan.dataset.index = i;
        spaceSpan.innerHTML = '&nbsp;';
        if (i === 0) spaceSpan.classList.add('char-current');
        frag.appendChild(spaceSpan);
      } else if (char === '\n') {
        currentWordEl = null;
        const enterSpan = document.createElement('span');
        enterSpan.className = 'char-token char-enter';
        enterSpan.dataset.index = i;
        enterSpan.innerHTML = '↵';
        if (i === 0) enterSpan.classList.add('char-current');
        frag.appendChild(enterSpan);
        frag.appendChild(document.createElement('br'));
      } else {
        if (!currentWordEl) {
          currentWordEl = document.createElement('span');
          currentWordEl.className = 'word-token';
          frag.appendChild(currentWordEl);
        }
        const charSpan = document.createElement('span');
        charSpan.className = 'char-token';
        charSpan.dataset.index = i;
        charSpan.textContent = char;
        if (i === 0) charSpan.classList.add('char-current');
        currentWordEl.appendChild(charSpan);
      }
    }

    this.textDisplayEl.appendChild(frag);

    // Keep caret element inside text display box
    if (!this.caretEl || !this.caretEl.isConnected) {
      this.caretEl = document.getElementById('typing-caret') || document.createElement('div');
      this.caretEl.id = 'typing-caret';
      this.caretEl.className = 'typing-caret';
    }
    this.textDisplayEl.appendChild(this.caretEl);

    // Ensure focus notice exists
    let focusNotice = document.getElementById('focus-notice');
    if (!focusNotice || !focusNotice.isConnected) {
      focusNotice = document.createElement('div');
      focusNotice.id = 'focus-notice';
      focusNotice.className = 'focus-notice';
      focusNotice.innerHTML = '<span class="focus-notice-icon">🖱️</span><span>Click here or press any key to focus</span>';
      focusNotice.addEventListener('click', () => {
        this.textDisplayEl.focus();
        this.textDisplayEl.classList.remove('blurred');
      });
      this.textDisplayEl.appendChild(focusNotice);
    }

    this.textDisplayEl.scrollTop = 0;
    this._updateCaretPosition();
  }

  _appendWordsToDisplay(moreText) {
    if (!this.textDisplayEl) return;
    const startIndex = this.targetText.length - moreText.length;
    const frag = document.createDocumentFragment();
    let currentWordEl = null;

    for (let i = 0; i < moreText.length; i++) {
      const char = moreText[i];
      const absoluteIdx = startIndex + i;

      if (char === ' ') {
        currentWordEl = null;
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'char-token char-space';
        spaceSpan.dataset.index = absoluteIdx;
        spaceSpan.innerHTML = '&nbsp;';
        frag.appendChild(spaceSpan);
      } else {
        if (!currentWordEl) {
          currentWordEl = document.createElement('span');
          currentWordEl.className = 'word-token';
          frag.appendChild(currentWordEl);
        }
        const charSpan = document.createElement('span');
        charSpan.className = 'char-token';
        charSpan.dataset.index = absoluteIdx;
        charSpan.textContent = char;
        currentWordEl.appendChild(charSpan);
      }
    }

    // Insert before caret and focus notice
    if (this.caretEl && this.caretEl.parentElement === this.textDisplayEl) {
      this.textDisplayEl.insertBefore(frag, this.caretEl);
    } else {
      this.textDisplayEl.appendChild(frag);
    }
  }

  _updateCaretPosition() {
    if (!this.textDisplayEl) return;

    if (!this.caretEl) {
      this.caretEl = document.getElementById('typing-caret') || document.createElement('div');
      this.caretEl.id = 'typing-caret';
    }

    // Always ensure caretEl is inside textDisplayEl
    if (this.caretEl.parentElement !== this.textDisplayEl) {
      this.textDisplayEl.appendChild(this.caretEl);
    }

    this.caretEl.className = `typing-caret cursor-${this.cursorStyle}`;

    // Pause blinking while typing actively
    this.caretEl.classList.add('typing-active');
    clearTimeout(this.typingActiveTimeout);
    this.typingActiveTimeout = setTimeout(() => {
      if (this.caretEl) this.caretEl.classList.remove('typing-active');
    }, 450);

    const currentSpan = this.textDisplayEl.querySelector(`.char-token[data-index="${this.charIndex}"]`);
    const targetSpan = currentSpan || this.textDisplayEl.querySelector(`.char-token[data-index="${this.targetText.length - 1}"]`);

    if (!targetSpan) {
      this.caretEl.style.display = 'none';
      return;
    }

    const boxRect = this.textDisplayEl.getBoundingClientRect();
    const spanRect = targetSpan.getBoundingClientRect();

    const scrollTop = this.textDisplayEl.scrollTop;
    const scrollLeft = this.textDisplayEl.scrollLeft;

    let left = (spanRect.left - boxRect.left) - this.textDisplayEl.clientLeft + scrollLeft;
    let top = (spanRect.top - boxRect.top) - this.textDisplayEl.clientTop + scrollTop;
    let width = spanRect.width || 12;
    let height = spanRect.height || 26;

    if (!currentSpan && targetSpan) {
      left += spanRect.width;
    }

    this.caretEl.style.display = 'block';

    if (this.cursorStyle === 'block') {
      this.caretEl.style.top = `${top}px`;
      this.caretEl.style.left = `${left}px`;
      this.caretEl.style.width = `${Math.max(10, width)}px`;
      this.caretEl.style.height = `${height}px`;
    } else if (this.cursorStyle === 'underline') {
      this.caretEl.style.top = `${top + height - 3}px`;
      this.caretEl.style.left = `${left}px`;
      this.caretEl.style.width = `${Math.max(10, width)}px`;
      this.caretEl.style.height = `3px`;
    } else if (this.cursorStyle === 'outline') {
      this.caretEl.style.top = `${top}px`;
      this.caretEl.style.left = `${left}px`;
      this.caretEl.style.width = `${Math.max(10, width)}px`;
      this.caretEl.style.height = `${height}px`;
    } else {
      this.caretEl.style.top = `${top}px`;
      this.caretEl.style.left = `${left}px`;
      this.caretEl.style.width = `2.5px`;
      this.caretEl.style.height = `${height}px`;
    }

    // Auto-scroll to keep active line centered
    if (currentSpan) {
      const viewTop = this.textDisplayEl.scrollTop;
      const viewBottom = viewTop + this.textDisplayEl.clientHeight;
      if (top + height > viewBottom - 4) {
        this.textDisplayEl.scrollTop = top - 8;
      } else if (top < viewTop + 4) {
        this.textDisplayEl.scrollTop = Math.max(0, top - 8);
      }
    }
  }

  _highlightCurrentTarget() {
    if (this.charIndex >= this.targetText.length) {
      this._finishTest();
      return;
    }

    const targetChar = this.targetText[this.charIndex];
    const mapInfo = CHAR_MAP[targetChar] || { finger: 'RT', shift: null, keyId: 'Space' };
    const fingerId = mapInfo.finger;
    const shiftFingerId = mapInfo.shift;

    this.keyboard.highlightTarget(mapInfo.keyId, shiftFingerId);
    this.hands.highlightTarget(fingerId, shiftFingerId, targetChar, mapInfo.tip);
    if (this.overlay) this.overlay.setTarget(mapInfo.keyId, fingerId, shiftFingerId);

    const fingerInfo = FINGERS[fingerId];
    tts.announceTarget(targetChar, { ...fingerInfo, shift: shiftFingerId });
  }

  _handleKeyDown(e) {
    // If Result Modal is open, handle keyboard navigation
    if (this.modalEl && this.modalEl.classList.contains('open')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._hideModal();
        this.resetTest(false);
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this._hideModal();
        if (this.mode === 'academy') {
          this.nextLesson();
        } else {
          this.resetTest(true);
        }
        return;
      }
      if (e.key === 'Escape') {
        this._hideModal();
        return;
      }
    }

    // Quick Restart Shortcut: Tab followed by Enter
    if (e.key === 'Tab') {
      this.lastTabTime = Date.now();
    } else if (e.key === 'Enter' && Date.now() - this.lastTabTime < 900) {
      e.preventDefault();
      this.resetTest();
      this._showToast('↺ Test Restarted');
      return;
    }

    // Alt + K: Toggle Virtual Keyboard Visibility
    if (e.altKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      this.toggleKeyboard();
      return;
    }

    // Academy Shortcuts: Alt + Left / Alt + Right (or [ and ])
    if (this.mode === 'academy' && e.altKey) {
      if (e.key === 'ArrowLeft' || e.key === '[') {
        e.preventDefault();
        this.prevLesson();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ']') {
        e.preventDefault();
        this.nextLesson();
        return;
      }
    }

    if (this.isFinished) return;

    // Remove blur overlay if typing
    if (this.textDisplayEl && this.textDisplayEl.classList.contains('blurred')) {
      this.textDisplayEl.classList.remove('blurred');
    }

    // Ignore standalone modifier presses for typing content
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
      this.keyboard.pressKey(e.code, true);
      return;
    }

    // Prevent default browser behavior for space and backspace
    if (e.key === ' ' || e.key === 'Backspace') {
      e.preventDefault();
    }

    // Start timer on first keystroke
    if (!this.startTime) {
      this.startTime = Date.now();
      this.lastKeystrokeTime = Date.now();
      this.hands.setStatusTag('TYPING', 'active');
      this._startTimer();
    } else {
      // Record interval between keystrokes for rhythm / consistency calculation
      const now = Date.now();
      const interval = now - this.lastKeystrokeTime;
      if (interval < 2500) {
        this.keystrokeIntervals.push(interval);
      }
      this.lastKeystrokeTime = now;
    }

    // Handle Backspace
    if (e.key === 'Backspace') {
      if (this.charIndex > 0) {
        const currentSpan = this.textDisplayEl.querySelector(`.char-token[data-index="${this.charIndex}"]`);
        if (currentSpan) {
          currentSpan.classList.remove('char-current');
        }

        this.charIndex--;
        const prevSpan = this.textDisplayEl.querySelector(`.char-token[data-index="${this.charIndex}"]`);
        if (prevSpan) {
          prevSpan.classList.remove('char-correct', 'char-error');
          prevSpan.classList.add('char-current');
        }
        this._updateCaretPosition();
        this._highlightCurrentTarget();
      }
      this.keyboard.pressKey('Backspace', true);
      sound.playKeypress(false, 'Backspace', 'Backspace');
      return;
    }

    // Single character input
    if (e.key.length === 1 || e.key === 'Enter') {
      const pressedChar = e.key === 'Enter' ? '\n' : e.key;
      const expectedChar = this.targetText[this.charIndex];
      const isCorrect = (pressedChar === expectedChar);

      this.totalKeyStrokes++;
      const targetMap = CHAR_MAP[expectedChar] || { finger: 'RT', keyId: 'Space' };
      const fingerId = targetMap.finger;

      if (this.fingerStats[fingerId]) {
        this.fingerStats[fingerId].total++;
      }

      const currentCharSpan = this.textDisplayEl.querySelector(`.char-token[data-index="${this.charIndex}"]`);

      // Sound feedback
      sound.playKeypress(pressedChar === ' ' || expectedChar === ' ', pressedChar, e.code);

      if (isCorrect) {
        this.correctKeyStrokes++;
        this.streak++;
        if (this.streak > this.maxStreak) this.maxStreak = this.streak;

        if (currentCharSpan) {
          currentCharSpan.classList.remove('char-current', 'char-error');
          currentCharSpan.classList.add('char-correct');
        }

        this.keyboard.pressKey(e.code, true);
        this.hands.animateFingerTap(fingerId);
        if (this.overlay) this.overlay.animateTap(fingerId);

        if (this.streak > 0 && this.streak % 20 === 0) {
          sound.playStreak(this.streak);
        }

        tts.resetMistakes();
      } else {
        // Error
        this.streak = 0;
        this.currentSecondErrors++;
        if (this.fingerStats[fingerId]) {
          this.fingerStats[fingerId].errors++;
        }
        this.missedKeys[expectedChar] = (this.missedKeys[expectedChar] || 0) + 1;

        if (currentCharSpan) {
          currentCharSpan.classList.remove('char-current', 'char-correct');
          currentCharSpan.classList.add('char-error');
        }

        sound.playError();
        this.keyboard.pressKey(e.code, false);

        tts.announceMistake(expectedChar, FINGERS[fingerId]);
      }

      if (currentCharSpan) {
        currentCharSpan.classList.remove('char-current');
      }

      this.charIndex++;

      // In Timed Mode: append more words dynamically so typist never runs out of text
      if (this.timeLimit > 0 && this.charIndex >= this.targetText.length - 15) {
        const moreWords = ' ' + getRandomWords(25, {
          punctuation: this.punctuation,
          numbers: this.numbers,
          dictionary: this.dictionary
        });
        this.targetText += moreWords;
        this._appendWordsToDisplay(moreWords);
      }

      // Set next char as current
      if (this.charIndex < this.targetText.length) {
        const nextCharSpan = this.textDisplayEl.querySelector(`.char-token[data-index="${this.charIndex}"]`);
        if (nextCharSpan) {
          nextCharSpan.classList.add('char-current');
        }
      }

      this._updateCaretPosition();
      this._updateLiveStats();
      this._highlightCurrentTarget();
    }
  }

  _handleKeyUp(e) {
    this.keyboard.releaseKey(e.code);
    sound.playKeyrelease(e.code === 'Space', e.key, e.code);
  }

  _startTimer() {
    this.timerInterval = setInterval(() => {
      if (!this.startTime) return;
      const elapsedSeconds = (Date.now() - this.startTime) / 1000;
      const secFloor = Math.floor(elapsedSeconds);

      // Record second-by-second analytics points for SVG graph
      if (secFloor > 0 && (!this.wpmHistory.length || this.wpmHistory[this.wpmHistory.length - 1].time !== secFloor)) {
        const elapsedMin = elapsedSeconds / 60;
        const gross = Math.round((this.totalKeyStrokes / 5) / elapsedMin);
        const acc = this.totalKeyStrokes > 0 ? (this.correctKeyStrokes / this.totalKeyStrokes) : 1;
        const net = Math.max(0, Math.round(gross * acc));

        this.wpmHistory.push({
          time: secFloor,
          wpm: isNaN(net) ? 0 : net,
          rawWpm: isNaN(gross) ? 0 : gross,
          errors: this.currentSecondErrors
        });
        this.currentSecondErrors = 0;
      }

      if (this.timeLimit > 0) {
        const remaining = Math.max(0, Math.ceil(this.timeLimit - elapsedSeconds));
        if (this.statTimeEl) this.statTimeEl.textContent = `${remaining}s`;
        if (remaining <= 0) {
          this._finishTest();
        }
      } else {
        if (this.statTimeEl) this.statTimeEl.textContent = `${secFloor}s`;
      }

      this._updateLiveStats();
    }, 250);
  }

  _updateLiveStats() {
    if (!this.startTime) {
      if (this.statWpmEl) this.statWpmEl.textContent = '0';
      if (this.statAccEl) this.statAccEl.textContent = '100%';
      if (this.statStreakEl) this.statStreakEl.textContent = '0';
      return;
    }

    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    const grossWpm = elapsedMinutes > 0 ? Math.round((this.totalKeyStrokes / 5) / elapsedMinutes) : 0;
    const accuracy = this.totalKeyStrokes > 0 ? Math.round((this.correctKeyStrokes / this.totalKeyStrokes) * 100) : 100;

    if (this.statWpmEl) this.statWpmEl.textContent = isNaN(grossWpm) ? '0' : grossWpm;
    if (this.statAccEl) this.statAccEl.textContent = `${accuracy}%`;
    if (this.statStreakEl) this.statStreakEl.textContent = this.streak;
  }

  _finishTest() {
    if (this.isFinished) return;
    this.isFinished = true;
    clearInterval(this.timerInterval);

    const elapsedSeconds = Math.max(1, (Date.now() - this.startTime) / 1000);
    const elapsedMinutes = elapsedSeconds / 60;
    const grossWpm = Math.round((this.totalKeyStrokes / 5) / elapsedMinutes);
    const accuracy = this.totalKeyStrokes > 0 ? Math.round((this.correctKeyStrokes / this.totalKeyStrokes) * 1000) / 10 : 100;
    const netWpm = Math.max(0, Math.round(grossWpm * (accuracy / 100)));

    // Calculate Consistency % based on keystroke interval rhythm variance
    let consistency = 95;
    if (this.keystrokeIntervals.length > 5) {
      const mean = this.keystrokeIntervals.reduce((a, b) => a + b, 0) / this.keystrokeIntervals.length;
      const variance = this.keystrokeIntervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.keystrokeIntervals.length;
      const stdDev = Math.sqrt(variance);
      const cv = mean > 0 ? (stdDev / mean) : 0;
      consistency = Math.max(40, Math.min(100, Math.round(100 * (1 - Math.min(0.85, cv * 0.7)))));
    }

    sound.playComplete();
    this.hands.setStatusTag('COMPLETE!', 'complete');
    tts.announceFeedback(`Great work! Finished at ${netWpm} words per minute with ${accuracy} percent accuracy.`);

    // Celebrate high achievements with confetti
    if (accuracy >= 95 || netWpm >= 65) {
      this._launchConfetti();
    }

    // In Academy mode, record completed lesson and update selector UI
    if (this.mode === 'academy') {
      const lesson = LESSONS[this.currentLessonIdx];
      if (lesson) {
        this.completedLessons.add(lesson.id);
        try {
          localStorage.setItem('keyvibe_completed_lessons', JSON.stringify([...this.completedLessons]));
        } catch (_) { }
        this._renderLessonSelector();
        this._showToast(`🎉 Level ${lesson.level} Completed!`);
      }
    }

    this._showResultModal({
      grossWpm,
      netWpm,
      accuracy,
      consistency,
      streak: this.maxStreak,
      totalKeys: this.totalKeyStrokes,
      correctKeys: this.correctKeyStrokes,
      errors: this.totalKeyStrokes - this.correctKeyStrokes,
      elapsedSeconds
    });
  }

  _showResultModal(stats) {
    if (!this.modalEl) return;

    // Evaluate Performance Tier
    let tier = { icon: '🌱', title: 'Rising Typist', tag: 'Tier C', sub: 'Building foundational rhythm' };
    if (stats.netWpm >= 85 && stats.accuracy >= 95) {
      tier = { icon: '⚡', title: 'Cyber Speedster', tag: 'Tier S', sub: 'Elite precision & cadence' };
    } else if (stats.netWpm >= 60 && stats.accuracy >= 92) {
      tier = { icon: '🚀', title: 'Pro Typist', tag: 'Tier A', sub: 'Fluid professional velocity' };
    } else if (stats.netWpm >= 40 && stats.accuracy >= 85) {
      tier = { icon: '⭐', title: 'Fluent Typist', tag: 'Tier B', sub: 'Consistent touch typing speed' };
    }

    const rankIcon = document.getElementById('modal-rank-icon');
    const rankTitle = document.getElementById('modal-rank-title');
    const rankTier = document.getElementById('modal-rank-tier');
    const rankSub = document.getElementById('modal-rank-subtitle');
    if (rankIcon) rankIcon.textContent = tier.icon;
    if (rankTitle) rankTitle.textContent = tier.title;
    if (rankTier) rankTier.textContent = tier.tag;
    if (rankSub) {
      if (this.mode === 'academy') {
        const l = LESSONS[this.currentLessonIdx];
        rankSub.textContent = l ? `Mastered Level ${l.level}: ${l.category} • ${tier.sub}` : tier.sub;
      } else {
        rankSub.textContent = tier.sub;
      }
    }

    // Hero Stats
    const wpmEl = document.getElementById('modal-wpm');
    const wpmSubEl = document.getElementById('modal-wpm-sub');
    const accEl = document.getElementById('modal-acc');
    const accSubEl = document.getElementById('modal-acc-sub');
    const consistEl = document.getElementById('modal-consistency');
    const streakEl = document.getElementById('modal-streak');
    const streakSubEl = document.getElementById('modal-streak-sub');
    const charsEl = document.getElementById('modal-chars');
    const timeElapsedEl = document.getElementById('modal-time-elapsed');

    if (wpmEl) wpmEl.textContent = stats.netWpm;
    if (wpmSubEl) wpmSubEl.textContent = `${stats.grossWpm} raw wpm`;
    if (accEl) accEl.textContent = `${stats.accuracy}%`;
    if (accSubEl) accSubEl.textContent = `${stats.errors} error${stats.errors === 1 ? '' : 's'}`;
    if (consistEl) consistEl.textContent = `${stats.consistency}%`;
    if (streakEl) streakEl.textContent = stats.streak;
    if (streakSubEl) streakSubEl.textContent = `${stats.streak} consecutive`;
    if (charsEl) charsEl.textContent = `${stats.correctKeys}/${stats.totalKeys}`;
    if (timeElapsedEl) timeElapsedEl.textContent = `${stats.elapsedSeconds.toFixed(1)}s elapsed`;

    // Render Performance Velocity SVG Chart
    this._renderPerformanceChart(stats);

    // Ergonomic Finger Precision Diagnostic
    const fingerChartEl = document.getElementById('modal-finger-breakdown');
    if (fingerChartEl) {
      fingerChartEl.innerHTML = '';
      let leftTotal = 0, rightTotal = 0;

      Object.keys(this.fingerStats).forEach(fKey => {
        const data = this.fingerStats[fKey];
        const info = FINGERS[fKey];
        if (data.total > 0) {
          if (fKey.startsWith('L')) leftTotal += data.total;
          if (fKey.startsWith('R')) rightTotal += data.total;

          const acc = Math.round(((data.total - data.errors) / data.total) * 100);
          let badgeClass = 'good', badgeText = 'SOLID';
          if (acc >= 98) { badgeClass = 'perfect'; badgeText = 'MASTER'; }
          else if (acc < 90) { badgeClass = 'warn'; badgeText = 'PRACTICE'; }

          const row = document.createElement('div');
          row.className = 'finger-stat-bar-row';
          row.innerHTML = `
            <div class="finger-stat-label">
              <span class="finger-chip-dot" style="background:${info.color}"></span>
              <span>${info.shortName}</span>
            </div>
            <div class="finger-bar-track">
              <div class="finger-bar-fill" style="width:${acc}%; background:${info.color}"></div>
            </div>
            <div class="finger-stat-val">${acc}%</div>
            <span class="finger-stat-badge ${badgeClass}">${badgeText}</span>
          `;
          fingerChartEl.appendChild(row);
        }
      });

      // Update Hand Balance
      const handBalanceEl = document.getElementById('modal-hand-balance');
      if (handBalanceEl) {
        const sum = leftTotal + rightTotal;
        if (sum > 0) {
          const leftPct = Math.round((leftTotal / sum) * 100);
          const rightPct = 100 - leftPct;
          handBalanceEl.textContent = `L: ${leftPct}% | R: ${rightPct}%`;
        } else {
          handBalanceEl.textContent = 'Balanced';
        }
      }
    }

    // Missed Keys and Weak Keys Drill Prompt
    const missedListEl = document.getElementById('modal-missed-keys');
    const weakDrillBox = document.getElementById('modal-weak-drill-box');
    const missedEntries = Object.entries(this.missedKeys).sort((a, b) => b[1] - a[1]);

    if (missedListEl) {
      missedListEl.innerHTML = '';
      if (missedEntries.length === 0) {
        missedListEl.innerHTML = '<span class="flawless-badge">✨ Flawless Execution! 100% clean accuracy.</span>';
        if (weakDrillBox) weakDrillBox.style.display = 'none';
      } else {
        missedEntries.slice(0, 6).forEach(([char, count]) => {
          const tag = document.createElement('span');
          tag.className = 'missed-key-tag';
          tag.textContent = `'${char === ' ' ? 'Space' : char}' (${count}x)`;
          missedListEl.appendChild(tag);
        });
        if (weakDrillBox) weakDrillBox.style.display = 'flex';
      }
    }

    // Update Next Button Label
    const nextLabelEl = document.getElementById('btn-modal-next-label');
    if (nextLabelEl) {
      nextLabelEl.textContent = this.mode === 'academy' ? 'Next Lesson →' : 'Next Words →';
    }

    this.modalEl.classList.add('open');
  }

  _renderPerformanceChart(stats) {
    const svgEl = document.getElementById('modal-chart-svg');
    const tooltipEl = document.getElementById('modal-chart-tooltip');
    if (!svgEl) return;

    // Use collected wpm history points or synthesize final point
    const history = [...this.wpmHistory];
    if (history.length === 0 || history[history.length - 1].time < Math.floor(stats.elapsedSeconds)) {
      history.push({
        time: Math.max(1, Math.round(stats.elapsedSeconds)),
        wpm: stats.netWpm,
        rawWpm: stats.grossWpm,
        errors: 0
      });
    }

    const svgWidth = 540;
    const svgHeight = 110;
    const padding = { top: 15, bottom: 20, left: 25, right: 15 };
    const chartW = svgWidth - padding.left - padding.right;
    const chartH = svgHeight - padding.top - padding.bottom;

    const maxWpm = Math.max(40, ...history.map(h => Math.max(h.wpm, h.rawWpm))) * 1.15;
    const maxTime = Math.max(3, history[history.length - 1].time);

    const getX = (t) => padding.left + (t / maxTime) * chartW;
    const getY = (w) => padding.top + chartH - (w / maxWpm) * chartH;

    // Build SVG paths
    let netPoints = [];
    let rawPoints = [];
    let areaPathD = `M ${getX(0)},${getY(0)}`;
    let errorDots = [];

    history.forEach((pt, i) => {
      const x = getX(pt.time);
      const yNet = getY(pt.wpm);
      const yRaw = getY(pt.rawWpm);

      if (i === 0 && pt.time > 0) {
        netPoints.push(`${getX(0)},${getY(0)}`);
        rawPoints.push(`${getX(0)},${getY(0)}`);
      }

      netPoints.push(`${x},${yNet}`);
      rawPoints.push(`${x},${yRaw}`);

      if (pt.errors > 0) {
        errorDots.push({ x, y: yNet, errors: pt.errors, time: pt.time, wpm: pt.wpm });
      }
    });

    areaPathD = `M ${getX(0)},${padding.top + chartH} L ` + netPoints.join(' L ') + ` L ${getX(history[history.length - 1].time)},${padding.top + chartH} Z`;

    const gridLines = [0.25, 0.5, 0.75, 1.0].map(ratio => {
      const val = Math.round(maxWpm * ratio);
      const y = getY(val);
      return `
        <line x1="${padding.left}" y1="${y}" x2="${svgWidth - padding.right}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
        <text x="${padding.left - 4}" y="${y + 3}" fill="rgba(255,255,255,0.3)" font-size="8" text-anchor="end" font-family="monospace">${val}</text>
      `;
    }).join('');

    const errorSvg = errorDots.map(d => `
      <circle cx="${d.x}" cy="${d.y}" r="4" fill="#f43f5e" stroke="#fff" stroke-width="1.5" />
    `).join('');

    svgEl.innerHTML = `
      <defs>
        <linearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPathD}" fill="url(#wpmGradient)" />
      <polyline points="${rawPoints.join(' ')}" fill="none" stroke="#a78bfa" stroke-width="1.8" stroke-dasharray="4,4" opacity="0.85" />
      <polyline points="${netPoints.join(' ')}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${errorSvg}
    `;

    // Interactive tooltip
    if (tooltipEl) {
      svgEl.onmousemove = (e) => {
        const rect = svgEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const normTime = Math.max(0, Math.min(maxTime, ((mouseX - padding.left) / chartW) * maxTime));

        // Find nearest point
        let nearest = history[0];
        let minDist = 9999;
        history.forEach(h => {
          const d = Math.abs(h.time - normTime);
          if (d < minDist) { minDist = d; nearest = h; }
        });

        if (nearest) {
          tooltipEl.style.display = 'block';
          tooltipEl.style.left = `${Math.min(rect.width - 90, Math.max(10, mouseX - 35))}px`;
          tooltipEl.style.top = `6px`;
          tooltipEl.innerHTML = `<b>${nearest.time}s</b>: ${nearest.wpm} WPM <span style="color:#a78bfa;">(${nearest.rawWpm} raw)</span>${nearest.errors ? ` • <span style="color:#fb7185;">${nearest.errors} err</span>` : ''}`;
        }
      };

      svgEl.onmouseleave = () => {
        tooltipEl.style.display = 'none';
      };
    }
  }

  _startWeakKeysDrill() {
    this._hideModal();
    const weakKeys = Object.keys(this.missedKeys);
    if (!weakKeys.length) return;

    this.targetText = generateWeakKeyDrill(weakKeys, 25);
    const modeTitle = document.getElementById('current-mode-title');
    const modeDesc = document.getElementById('current-mode-desc');
    if (modeTitle) modeTitle.textContent = `🎯 Weak Keys Drill (${weakKeys.slice(0, 5).join(', ')})`;
    if (modeDesc) modeDesc.textContent = 'Focused targeted training to calibrate muscle memory on missed keys.';

    this.resetTest(false);
    this._showToast(`🎯 Targeted Weak Keys drill loaded!`);
    if (this.textDisplayEl) this.textDisplayEl.focus();
  }

  _copyStatsSummary() {
    const wpm = document.getElementById('modal-wpm')?.textContent || '0';
    const raw = document.getElementById('modal-wpm-sub')?.textContent || '0 raw';
    const acc = document.getElementById('modal-acc')?.textContent || '100%';
    const consistency = document.getElementById('modal-consistency')?.textContent || '95%';
    const streak = document.getElementById('modal-streak')?.textContent || '0';
    const time = document.getElementById('modal-time-elapsed')?.textContent || '';

    const text = `⌨️ KeyVibe Touch Typing Report\n• Net Speed: ${wpm} WPM (${raw})\n• Accuracy: ${acc}\n• Consistency: ${consistency}\n• Max Streak: ${streak} 🔥\n• Duration: ${time}\n• Mode: ${this.mode.toUpperCase()}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this._showToast('📋 Stats summary copied to clipboard!');
      }).catch(() => {
        this._showToast('⚠️ Could not access clipboard');
      });
    }
  }

  _showToast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      if (this.toastEl) this.toastEl.classList.remove('show');
    }, 2400);
  }

  _launchConfetti() {
    if (!this.confettiCanvas) return;
    const canvas = this.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#06b6d4', '#38bdf8', '#10b981', '#fbbf24', '#818cf8', '#f43f5e', '#ffffff'];
    const particles = [];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 12 - 4,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.35,
        opacity: 1
      });
    }

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotSpeed;
        p.opacity -= 0.012;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      });

      frame++;
      if (frame < 80) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(animate);
  }

  _hideModal() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }
}

// Instantiate and start app on DOM load
window.addEventListener('DOMContentLoaded', () => {
  const app = new TypingApp();
  window.app = app;
  app.init();
});

