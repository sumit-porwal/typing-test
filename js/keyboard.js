/**
 * Interactive Mechanical Keyboard Component
 * Renders full keyboard layout, manages target highlighting, tactile bumps, and keypress animations
 */

import { KEYBOARD_LAYOUT, FINGERS } from './fingerMap.js';

export class VirtualKeyboard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.keyElements = new Map();
    this.currentTargetKey = null;
    this.currentShiftKey = null;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const boardEl = document.createElement('div');
    boardEl.className = 'keyboard-board';

    KEYBOARD_LAYOUT.forEach((row, rowIdx) => {
      const rowEl = document.createElement('div');
      rowEl.className = `keyboard-row keyboard-row-${rowIdx}`;

      row.forEach(key => {
        const keyEl = document.createElement('div');
        keyEl.className = 'key-cap';
        keyEl.dataset.code = key.code;
        keyEl.dataset.finger = key.finger || '';

        // Width styling for special keys
        if (key.width && key.width > 1) {
          keyEl.style.flexGrow = key.width;
          keyEl.dataset.width = key.width;
        }

        // Color theme by finger assignment
        const fingerInfo = FINGERS[key.finger];
        if (fingerInfo) {
          keyEl.style.setProperty('--finger-color', fingerInfo.color);
          keyEl.style.setProperty('--finger-glow', fingerInfo.glow);
        }

        if (key.isSpecial) keyEl.classList.add('key-special');
        if (key.isSpace) keyEl.classList.add('key-space');
        if (key.isHome) keyEl.classList.add('key-home');

        // Tactile bump on F and J
        if (key.hasBump) {
          keyEl.classList.add('key-has-bump');
          const bumpEl = document.createElement('span');
          bumpEl.className = 'tactile-bump';
          keyEl.appendChild(bumpEl);
        }

        // Labels
        const labelContainer = document.createElement('div');
        labelContainer.className = 'key-labels';

        if (key.shiftLabel) {
          const shiftSpan = document.createElement('span');
          shiftSpan.className = 'key-shift-label';
          shiftSpan.textContent = key.shiftLabel;
          labelContainer.appendChild(shiftSpan);
        }

        const mainSpan = document.createElement('span');
        mainSpan.className = 'key-main-label';
        mainSpan.textContent = key.label;
        labelContainer.appendChild(mainSpan);

        keyEl.appendChild(labelContainer);

        // Finger zone dot indicator
        if (fingerInfo && !key.isSpecial) {
          const dot = document.createElement('span');
          dot.className = 'finger-indicator-dot';
          dot.style.backgroundColor = fingerInfo.color;
          keyEl.appendChild(dot);
        }

        if (key.code === 'CapsLock') {
          keyEl.addEventListener('click', () => {
            if (window.app) {
              const isNowLocked = !keyEl.classList.contains('caps-locked');
              window.app.setCapsLockIndicator(isNowLocked);
            }
          });
        }

        rowEl.appendChild(keyEl);
        this.keyElements.set(key.code, keyEl);
      });

      boardEl.appendChild(rowEl);
    });

    this.container.appendChild(boardEl);
  }

  highlightTarget(targetKeyId, shiftFinger) {
    // Clear previous highlights
    if (this.currentTargetKey) {
      this.currentTargetKey.classList.remove('target-active', 'target-pulse');
      this.currentTargetKey = null;
    }
    if (this.currentShiftKey) {
      this.currentShiftKey.classList.remove('shift-active');
      this.currentShiftKey = null;
    }

    // Highlight main key
    if (targetKeyId && this.keyElements.has(targetKeyId)) {
      const el = this.keyElements.get(targetKeyId);
      el.classList.add('target-active', 'target-pulse');
      this.currentTargetKey = el;
    }

    // Highlight shift key if required
    if (shiftFinger) {
      const shiftCode = shiftFinger === 'LP' ? 'ShiftLeft' : 'ShiftRight';
      if (this.keyElements.has(shiftCode)) {
        const shiftEl = this.keyElements.get(shiftCode);
        shiftEl.classList.add('shift-active');
        this.currentShiftKey = shiftEl;
      }
    }
  }

  clearHighlights() {
    if (this.currentTargetKey) {
      this.currentTargetKey.classList.remove('target-active', 'target-pulse');
      this.currentTargetKey = null;
    }
    if (this.currentShiftKey) {
      this.currentShiftKey.classList.remove('shift-active');
      this.currentShiftKey = null;
    }
  }

  pressKey(code, isCorrect = true) {
    let el = this.keyElements.get(code);

    // If space was pressed
    if (!el && (code === ' ' || code === 'Space')) {
      el = this.keyElements.get('Space');
    }

    if (el) {
      el.classList.add('key-pressed');
      if (!isCorrect) {
        el.classList.add('key-error');
        setTimeout(() => el.classList.remove('key-error'), 250);
      }
    }
  }

  releaseKey(code) {
    let el = this.keyElements.get(code);
    if (!el && (code === ' ' || code === 'Space')) {
      el = this.keyElements.get('Space');
    }
    if (el) {
      el.classList.remove('key-pressed');
    }
  }

  flashError(code) {
    let el = this.keyElements.get(code);
    if (el) {
      el.classList.add('key-error');
      setTimeout(() => el.classList.remove('key-error'), 250);
    }
  }

  setCapsLock(isLocked) {
    const el = this.keyElements.get('CapsLock');
    if (el) {
      el.classList.toggle('caps-locked', !!isLocked);
    }
  }
}
