/**
 * Main Application Orchestrator for KeyVibe Touch Typing Studio
 * Coordinates virtual keyboard, realistic hands overlay, audio/TTS engines,
 * keystroke processing, live metrics, and practice modes.
 */

import { CHAR_MAP, FINGERS } from './fingerMap.js';
import { sound } from './audio.js';
import { tts } from './tts.js';
import { VirtualKeyboard } from './keyboard.js';
import { VirtualHands } from './hands.js';
import { HandOverlay } from './handOverlay.js';
import { LESSONS, getRandomWords } from './lessons.js';
import { MetricsTracker } from './metrics.js';
import { SettingsManager } from './settingsManager.js';
import { AcademyManager } from './academyManager.js';
import { ResultsModal } from './resultsModal.js';

class TypingApp {
  constructor() {
    // Hardware & Visualization Components
    this.keyboard = new VirtualKeyboard('keyboard-container');
    this.hands = new VirtualHands('hands-container');
    this.overlay = new HandOverlay('keyboard-container');

    // Sub-Modules
    this.metrics = new MetricsTracker();
    this.settings = new SettingsManager(this);
    this.academy = new AcademyManager(this);
    this.resultsModal = new ResultsModal(this);

    // Active Test State
    this.targetText = '';
    this.charIndex = 0;
    this.isFinished = false;
    this.timerInterval = null;
    this.lastTabTime = 0;
    this.typingActiveTimeout = null;

    // DOM Elements Cache
    this.textDisplayEl = document.getElementById('text-display');
    this.caretEl = document.getElementById('typing-caret');
    this.statWpmEl = document.getElementById('stat-wpm');
    this.statAccEl = document.getElementById('stat-acc');
    this.statStreakEl = document.getElementById('stat-streak');
    this.statTimeEl = document.getElementById('stat-time');
  }

  // Compatibility getters/setters for legacy access
  get mode() { return this.academy.mode; }
  set mode(val) { this.academy.mode = val; }
  get currentLessonIdx() { return this.academy.currentLessonIdx; }
  set currentLessonIdx(val) { this.academy.currentLessonIdx = val; }
  get showKeyboard() { return this.settings.showKeyboard; }
  get cursorStyle() { return this.settings.cursorStyle; }
  get fingerStats() { return this.metrics.fingerStats; }
  get missedKeys() { return this.metrics.missedKeys; }

  init() {
    // Mount hardware viewports
    this.keyboard.render();
    this.hands.render();
    this.overlay.init();

    // Hook TTS status wave & mode change
    tts.onSpeakingChange = (isSpeaking) => {
      this.hands.setTTSActive(isSpeaking);
    };
    tts.onModeChange = () => {
      this.settings.syncVoiceUI();
    };

    // Initialize sub-controllers
    this.settings.init();
    this.academy.init();

    // Setup global listeners
    this._attachGlobalListeners();

    // Caret update on resize or dynamic font load
    window.addEventListener('resize', () => {
      this._updateCaretPosition();
      if (this.overlay) this.overlay.updatePositions(true);
    });
    if (document.fonts) {
      document.fonts.ready.then(() => this._updateCaretPosition());
    }

    // Load initial mode
    this.academy.setMode(this.academy.mode, this.academy.currentLessonIdx);
  }

  _attachGlobalListeners() {
    window.addEventListener('keydown', (e) => {
      this._checkCapsLock(e);
      this._handleKeyDown(e);
    });
    window.addEventListener('keyup', (e) => {
      this._checkCapsLock(e);
      this._handleKeyUp(e);
    });
    window.addEventListener('focus', () => {
      // Clear or refresh caps lock state if possible
    });

    // Focus handling on text display
    if (this.textDisplayEl) {
      this.textDisplayEl.addEventListener('focus', () => {
        this.textDisplayEl.classList.remove('blurred');
      });
      this.textDisplayEl.addEventListener('blur', () => {
        const isCustomOpen = document.getElementById('custom-modal')?.classList.contains('open');
        const isDrawerOpen = document.getElementById('settings-drawer')?.classList.contains('open');
        if (!this.isFinished && !isCustomOpen && !isDrawerOpen) {
          this.textDisplayEl.classList.add('blurred');
        }
        document.body.classList.remove('zen-typing-focused');
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

    // Restart button in header/stats bar
    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) restartBtn.addEventListener('click', () => this.resetTest());

    // Restart button on completion banner
    const finishRestartBtn = document.getElementById('finish-banner-restart-btn');
    if (finishRestartBtn) finishRestartBtn.addEventListener('click', () => this.resetTest(true));

    // Window click background focus
    document.addEventListener('click', (e) => {
      if (!e.target.closest('input, select, textarea, button, .modal-content, .drawer-content')) {
        window.focus();
      }
    });
  }

  _checkCapsLock(e) {
    if (e && typeof e.getModifierState === 'function') {
      const isLocked = e.getModifierState('CapsLock');
      this.setCapsLockIndicator(isLocked);
    }
  }

  setCapsLockIndicator(isLocked) {
    const hud = document.getElementById('caps-lock-hud');
    if (hud) hud.style.display = isLocked ? 'flex' : 'none';
    if (this.keyboard) this.keyboard.setCapsLock(isLocked);
  }

  resetTest(regenerateText = true) {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.charIndex = 0;
    this.isFinished = false;
    this.metrics.reset();
    clearTimeout(this._zenIdleTimer);
    document.body.classList.remove('zen-typing-focused');
    this.hideFinishedPrompt();

    if (regenerateText) {
      this.targetText = this.academy.generateModeText();
    }
    if (!this.targetText || this.targetText.length === 0) {
      this.targetText = getRandomWords(25, {
        punctuation: this.settings.punctuation,
        numbers: this.settings.numbers,
        dictionary: this.settings.dictionary
      });
    }

    const activeTime = this.academy ? this.academy.getActiveTimeLimit() : (this.settings.timeLimit || 0);
    if (this.statTimeEl) {
      this.statTimeEl.textContent = activeTime > 0 ? `${activeTime}s` : '0s';
    }

    this._renderTextDisplay();
    this._updateLiveStats();
    this._highlightCurrentTarget();
    this.hands.setStatusTag('READY', 'ready');
  }

  _renderTextDisplay() {
    if (!this.textDisplayEl) return;
    this.textDisplayEl.innerHTML = '';

    const isZen = (this.academy.mode === 'zen');
    this.textDisplayEl.classList.toggle('zen-display', isZen);
    document.body.classList.toggle('zen-mode', isZen);

    if (isZen) {
      const conveyor = document.createElement('div');
      conveyor.className = 'zen-text-conveyor';
      conveyor.id = 'zen-text-conveyor';

      for (let i = 0; i < this.targetText.length; i++) {
        const char = this.targetText[i];
        const span = document.createElement('span');
        span.className = (char === ' ') ? 'char-token char-space' : 'char-token';
        span.dataset.index = i;
        span.innerHTML = (char === ' ') ? '&nbsp;' : char;
        if (i === 0) span.classList.add('char-current');
        conveyor.appendChild(span);
      }

      this.textDisplayEl.appendChild(conveyor);
    } else {
      const frag = document.createDocumentFragment();
      let currentWordEl = null;

      for (let i = 0; i < this.targetText.length; i++) {
        const char = this.targetText[i];

        if (char === ' ') {
          currentWordEl = null;
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
    }

    if (!this.caretEl || !this.caretEl.isConnected) {
      this.caretEl = document.getElementById('typing-caret') || document.createElement('div');
      this.caretEl.id = 'typing-caret';
      this.caretEl.className = 'typing-caret';
    }
    this.textDisplayEl.appendChild(this.caretEl);

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
    const isZen = (this.academy.mode === 'zen');
    const conveyor = document.getElementById('zen-text-conveyor');

    if (isZen && conveyor) {
      for (let i = 0; i < moreText.length; i++) {
        const char = moreText[i];
        const span = document.createElement('span');
        span.className = (char === ' ') ? 'char-token char-space' : 'char-token';
        span.dataset.index = startIndex + i;
        span.innerHTML = (char === ' ') ? '&nbsp;' : char;
        conveyor.appendChild(span);
      }
      return;
    }

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

    if (this.caretEl.parentElement !== this.textDisplayEl) {
      this.textDisplayEl.appendChild(this.caretEl);
    }

    this.caretEl.className = `typing-caret cursor-${this.settings.cursorStyle}`;

    this.caretEl.classList.add('typing-active');
    clearTimeout(this.typingActiveTimeout);
    this.typingActiveTimeout = setTimeout(() => {
      if (this.caretEl) this.caretEl.classList.remove('typing-active');
    }, 450);

    const isZen = (this.academy.mode === 'zen');
    const currentSpan = this.textDisplayEl.querySelector(`.char-token[data-index="${this.charIndex}"]`);
    const targetSpan = currentSpan || this.textDisplayEl.querySelector(`.char-token[data-index="${this.targetText.length - 1}"]`);

    if (!targetSpan) {
      this.caretEl.style.display = 'none';
      return;
    }

    // ZEN MODE CONVEYOR: Pin cursor dead-center, translate the text conveyor
    if (isZen) {
      const conveyor = document.getElementById('zen-text-conveyor');
      if (conveyor) {
        const boxWidth = this.textDisplayEl.clientWidth;
        const charLeft = targetSpan.offsetLeft;
        const charWidth = targetSpan.offsetWidth || 18;
        const charCenter = charLeft + (charWidth / 2);
        const targetTranslateX = (boxWidth / 2) - charCenter;
        conveyor.style.transform = `translateX(${targetTranslateX}px)`;

        this.caretEl.style.display = 'block';
        const cursorStyle = this.settings ? this.settings.cursorStyle : 'line';
        const halfChar = charWidth / 2;

        if (cursorStyle === 'line') {
          // Line cursor: sits at the left boundary of the character, scaled to 1.85rem font height
          this.caretEl.style.left = `calc(50% - ${halfChar}px)`;
          this.caretEl.style.top = '50%';
          this.caretEl.style.transform = 'translateY(-50%)';
          this.caretEl.style.width = '3.5px';
          this.caretEl.style.height = '46px';
        } else if (cursorStyle === 'underline') {
          // Underline cursor: sits under the character at the font baseline
          this.caretEl.style.left = '50%';
          this.caretEl.style.top = 'calc(50% + 22px)';
          this.caretEl.style.transform = 'translateX(-50%)';
          this.caretEl.style.width = `${Math.max(16, charWidth + 2)}px`;
          this.caretEl.style.height = '4px';
        } else if (cursorStyle === 'outline') {
          // Outline cursor: surrounds the character box
          this.caretEl.style.left = '50%';
          this.caretEl.style.top = '50%';
          this.caretEl.style.transform = 'translate(-50%, -50%)';
          this.caretEl.style.width = `${Math.max(16, charWidth + 2)}px`;
          this.caretEl.style.height = '48px';
        } else {
          // Block cursor: covers the full character box
          this.caretEl.style.left = '50%';
          this.caretEl.style.top = '50%';
          this.caretEl.style.transform = 'translate(-50%, -50%)';
          this.caretEl.style.width = `${Math.max(16, charWidth + 2)}px`;
          this.caretEl.style.height = '48px';
        }
        return;
      }
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
    this.caretEl.style.transform = '';

    if (this.settings.cursorStyle === 'block') {
      this.caretEl.style.top = `${top}px`;
      this.caretEl.style.left = `${left}px`;
      this.caretEl.style.width = `${Math.max(10, width)}px`;
      this.caretEl.style.height = `${height}px`;
    } else if (this.settings.cursorStyle === 'underline') {
      this.caretEl.style.top = `${top + height - 3}px`;
      this.caretEl.style.left = `${left}px`;
      this.caretEl.style.width = `${Math.max(10, width)}px`;
      this.caretEl.style.height = `3px`;
    } else if (this.settings.cursorStyle === 'outline') {
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
    if (!this.targetText || this.targetText.length === 0) {
      this.targetText = this.academy.generateModeText() || getRandomWords(25, { dictionary: 'standard' });
      this._renderTextDisplay();
      return;
    }

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
    // Result Modal keyboard navigation
    if (this.resultsModal.isOpen()) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.resultsModal.hide();
        this.resetTest(false);
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.resultsModal.hide();
        if (this.academy.mode === 'academy') {
          this.academy.nextLesson();
        } else {
          this.resetTest(true);
        }
        return;
      }
      if (e.key === 'Escape') {
        this.resultsModal.hide();
        return;
      }
    }

    // Quick Restart: Tab followed by Enter within 900ms
    if (e.key === 'Tab') {
      this.lastTabTime = Date.now();
    } else if (e.key === 'Enter' && Date.now() - this.lastTabTime < 900) {
      e.preventDefault();
      this.resetTest();
      this.showToast('↺ Test Restarted');
      return;
    }

    // Alt + K: Toggle Virtual Keyboard
    if (e.altKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      this.settings.toggleKeyboard();
      return;
    }

    // Alt + V: Toggle Voice Coach
    if (e.altKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      const enabled = tts.toggle();
      this.showToast(enabled ? `🗣️ Voice Coach: ${tts.mode.toUpperCase()}` : '🔇 Voice Coach: MUTED');
      this.settings.syncVoiceUI();
      return;
    }

    // Alt + Z: Toggle Zen Mode
    if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      const nextMode = (this.academy.mode === 'zen') ? 'words' : 'zen';
      this.academy.setMode(nextMode);
      this.showToast(nextMode === 'zen' ? '☯ Zen Mode: Gliding Conveyor' : '⚡ Words Mode');
      return;
    }

    // Escape: Finish Zen test (especially infinite flow) or pause
    if (e.key === 'Escape') {
      if (this.metrics.startTime && !this.isFinished) {
        e.preventDefault();
        this._finishTest();
        return;
      }
    }

    // Academy Shortcuts: Alt + Left / Alt + Right
    if (this.academy.mode === 'academy' && e.altKey) {
      if (e.key === 'ArrowLeft' || e.key === '[') {
        e.preventDefault();
        this.academy.prevLesson();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ']') {
        e.preventDefault();
        this.academy.nextLesson();
        return;
      }
    }

    if (this.isFinished) {
      // Escape: if modal is open, close it and show restart prompt
      if (e.key === 'Escape') {
        if (this.resultsModal && this.resultsModal.isOpen()) {
          e.preventDefault();
          this.resultsModal.hide();
          return;
        }
      }

      // Any keypress (Space, Enter, or regular character key) cleanly starts a fresh new test
      if (e.key === ' ' || e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey)) {
        e.preventDefault();
        if (this.resultsModal && this.resultsModal.isOpen()) this.resultsModal.hide();
        this.resetTest(true);
        this.showToast('✨ Ready — Start typing to begin');
        return;
      }
      return;
    }

    if (this.textDisplayEl && this.textDisplayEl.classList.contains('blurred')) {
      this.textDisplayEl.classList.remove('blurred');
    }

    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
      this.keyboard.pressKey(e.code, true);
      return;
    }

    if (e.key === ' ' || e.key === 'Backspace') {
      e.preventDefault();
    }

    // Start timer on first active keystroke
    if (!this.metrics.startTime) {
      this.metrics.start(Date.now());
      const isZen = (this.academy.mode === 'zen');
      this.hands.setStatusTag(isZen ? 'FLOW' : 'TYPING', 'active');
      this._startTimer();
    } else {
      this.metrics.recordInterval(Date.now());
    }

    // In Zen mode, actively typing keeps the screen 100% distraction-free
    if (this.academy && this.academy.mode === 'zen') {
      document.body.classList.add('zen-typing-focused');
      clearTimeout(this._zenIdleTimer);
      this._zenIdleTimer = setTimeout(() => {
        if (!this.isFinished) {
          document.body.classList.remove('zen-typing-focused');
        }
      }, 3500);
    }

    // Backspace
    if (e.key === 'Backspace') {
      if (this.charIndex > 0) {
        const currentSpan = this.textDisplayEl.querySelector(`.char-token[data-index="${this.charIndex}"]`);
        if (currentSpan) currentSpan.classList.remove('char-current');

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

    // Character key input
    if (e.key.length === 1 || e.key === 'Enter') {
      const pressedChar = e.key === 'Enter' ? '\n' : e.key;
      const expectedChar = this.targetText[this.charIndex];
      const isCorrect = (pressedChar === expectedChar);

      const targetMap = CHAR_MAP[expectedChar] || { finger: 'RT', keyId: 'Space' };
      const fingerId = targetMap.finger;

      this.metrics.recordKeystroke(expectedChar, isCorrect, fingerId);

      const currentCharSpan = this.textDisplayEl.querySelector(`.char-token[data-index="${this.charIndex}"]`);
      sound.playKeypress(pressedChar === ' ' || expectedChar === ' ', pressedChar, e.code);

      if (isCorrect) {
        if (currentCharSpan) {
          currentCharSpan.classList.remove('char-current', 'char-error');
          currentCharSpan.classList.add('char-correct');
        }

        this.keyboard.pressKey(e.code, true);
        this.hands.animateFingerTap(fingerId);
        if (this.overlay) this.overlay.animateTap(fingerId);

        if (this.metrics.streak > 0 && this.metrics.streak % 20 === 0) {
          sound.playStreak(this.metrics.streak);
        }
        tts.resetMistakes();
      } else {
        if (currentCharSpan) {
          currentCharSpan.classList.remove('char-current', 'char-correct');
          currentCharSpan.classList.add('char-error');
        }
        sound.playError();
        this.triggerScreenErrorFlash();
        this.keyboard.pressKey(e.code, false);
        tts.announceMistake(expectedChar, FINGERS[fingerId]);
      }

      if (currentCharSpan) currentCharSpan.classList.remove('char-current');
      this.charIndex++;

      // Append more words dynamically in countdown timed mode or Zen infinity mode
      const activeTimeLimit = this.academy ? this.academy.getActiveTimeLimit() : (this.settings.timeLimit || 0);
      const isZenInfinity = (this.academy.mode === 'zen' && this.academy.zenType === 'infinity');
      if ((activeTimeLimit > 0 || isZenInfinity) && this.charIndex >= this.targetText.length - 15) {
        const moreWords = ' ' + getRandomWords(25, {
          punctuation: this.settings.punctuation,
          numbers: this.settings.numbers,
          dictionary: this.settings.dictionary
        });
        this.targetText += moreWords;
        this._appendWordsToDisplay(moreWords);
      }

      if (this.charIndex < this.targetText.length) {
        const nextCharSpan = this.textDisplayEl.querySelector(`.char-token[data-index="${this.charIndex}"]`);
        if (nextCharSpan) nextCharSpan.classList.add('char-current');
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
      if (!this.metrics.startTime) return;
      const elapsedSeconds = (Date.now() - this.metrics.startTime) / 1000;
      const secFloor = Math.floor(elapsedSeconds);

      this.metrics.recordSecondPoint(secFloor, elapsedSeconds);

      const activeTimeLimit = this.academy ? this.academy.getActiveTimeLimit() : (this.settings.timeLimit || 0);
      if (activeTimeLimit > 0) {
        const remaining = Math.max(0, Math.ceil(activeTimeLimit - elapsedSeconds));
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

  triggerScreenErrorFlash() {
    document.body.classList.remove('screen-error-flash');
    void document.body.offsetWidth;
    document.body.classList.add('screen-error-flash');
    setTimeout(() => {
      document.body.classList.remove('screen-error-flash');
    }, 220);
  }

  _updateLiveStats() {
    if (!this.metrics.startTime) {
      if (this.statWpmEl) this.statWpmEl.textContent = '—';
      if (this.statAccEl) this.statAccEl.textContent = '—';
      if (this.statStreakEl) this.statStreakEl.textContent = '0';
      return;
    }
    const { grossWpm, accuracy, streak } = this.metrics.getLiveStats();
    if (this.statWpmEl) this.statWpmEl.textContent = grossWpm;
    if (this.statAccEl) this.statAccEl.textContent = `${accuracy}%`;
    if (this.statStreakEl) this.statStreakEl.textContent = streak;
  }

  _finishTest() {
    if (this.isFinished) return;
    this.isFinished = true;
    clearInterval(this.timerInterval);
    clearTimeout(this._zenIdleTimer);
    document.body.classList.remove('zen-typing-focused');

    const stats = this.metrics.getFinalStats();

    sound.playComplete();
    this.showFinishedPrompt();
    tts.announceFeedback(`Great work! Finished at ${stats.netWpm} words per minute with ${stats.accuracy} percent accuracy.`);

    if (stats.accuracy >= 95 || stats.netWpm >= 65) {
      this.resultsModal.launchConfetti();
    }

    if (this.academy.mode === 'academy') {
      const lesson = LESSONS[this.academy.currentLessonIdx];
      if (lesson) {
        this.academy.markLessonComplete(lesson);
        this.showToast(`🎉 Level ${lesson.level} Completed!`);
      }
    }

    this.resultsModal.show(
      stats,
      this.academy.mode,
      this.academy.currentLessonIdx,
      this.metrics.fingerStats,
      this.metrics.missedKeys,
      this.metrics.wpmHistory
    );
  }

  showFinishedPrompt() {
    const banner = document.getElementById('test-finish-banner');
    if (banner) banner.style.display = 'flex';
    if (this.hands) this.hands.setFinishedState();
    if (this.keyboard) this.keyboard.clearHighlights();
  }

  hideFinishedPrompt() {
    const banner = document.getElementById('test-finish-banner');
    if (banner) banner.style.display = 'none';
  }

  // Helper delegates
  updateCaretPosition() { this._updateCaretPosition(); }
  showToast(msg) { this.resultsModal.showToast(msg); }
  setMode(mode, idx) { this.academy.setMode(mode, idx); }
  toggleKeyboard(state) { this.settings.toggleKeyboard(state); }
  setCursorStyle(style) { this.settings.setCursorStyle(style); }
  cycleCursorStyle() { return this.settings.cycleCursorStyle(); }
}

// Instantiate and start app on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new TypingApp();
  window.app = app;
  app.init();
});
