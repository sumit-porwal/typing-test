/**
 * Coach Guidance Bar Component
 * Displays live target key, active finger assignment, tactile hints, and TTS wave indicators
 */

import { FINGERS } from './fingerMap.js';

export class VirtualHands {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeFingerId = null;
    this.shiftFingerId = null;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="coach-bar-dock" id="coach-bar-dock">
        <div class="dock-badge-item">
          <span class="dock-tag status-ready" id="coach-status-tag">READY</span>
          <div class="tts-wave-container" id="tts-wave-container" title="Audio Coach Speaking">
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
          </div>
        </div>

        <div class="dock-target-item">
          <span class="dock-sublabel">PRESS KEY:</span>
          <span class="dock-key-char" id="target-key-hero">F</span>
        </div>

        <div class="dock-finger-item" id="target-finger-badge">
          <span class="finger-color-dot" id="finger-color-dot"></span>
          <span class="finger-name-text" id="finger-name-text">Left Index (LI)</span>
        </div>

        <div class="dock-tip-item" id="target-hint-text">
          Feel the tactile bump on key F with left index finger
        </div>
      </div>
    `;

    this.targetKeyHero = document.getElementById('target-key-hero');
    this.fingerColorDot = document.getElementById('finger-color-dot');
    this.fingerNameText = document.getElementById('finger-name-text');
    this.targetHintText = document.getElementById('target-hint-text');
    this.ttsWaveContainer = document.getElementById('tts-wave-container');
    this.coachStatusTag = document.getElementById('coach-status-tag');
  }

  setTTSActive(isSpeaking) {
    if (this.ttsWaveContainer) {
      if (isSpeaking) {
        this.ttsWaveContainer.classList.add('tts-speaking');
      } else {
        this.ttsWaveContainer.classList.remove('tts-speaking');
      }
    }
  }

  setTTSMode(mode) {
    if (this.ttsWaveContainer) {
      const isMuted = mode === 'off';
      this.ttsWaveContainer.classList.toggle('wave-muted', isMuted);
      this.ttsWaveContainer.title = isMuted
        ? 'Voice Coach: Muted (Click to enable)'
        : `Voice Coach: ${mode} (Click to mute)`;
    }
  }

  highlightTarget(fingerId, shiftFingerId, char, tip) {
    this.activeFingerId = fingerId;
    this.shiftFingerId = shiftFingerId;

    const fingerInfo = FINGERS[fingerId];
    if (this.targetKeyHero) {
      this.targetKeyHero.textContent = char === ' ' ? '␣ SPACE' : char;
    }

    if (this.fingerColorDot && fingerInfo) {
      this.fingerColorDot.style.backgroundColor = fingerInfo.color;
      this.fingerColorDot.style.boxShadow = `0 0 10px ${fingerInfo.color}`;
    }

    if (this.fingerNameText && fingerInfo) {
      let text = fingerInfo.name;
      if (shiftFingerId) {
        const shiftInfo = FINGERS[shiftFingerId];
        text += ` + ${shiftInfo.shortName} (Shift)`;
      }
      this.fingerNameText.textContent = text;
    }

    if (this.targetHintText) {
      if (tip) {
        this.targetHintText.textContent = tip;
      } else if (shiftFingerId) {
        this.targetHintText.textContent = `Hold ${FINGERS[shiftFingerId].shortName} while tapping with ${fingerInfo ? fingerInfo.shortName : 'finger'}`;
      } else if (fingerInfo) {
        this.targetHintText.textContent = `Reach ${fingerInfo.name} from home row (${fingerInfo.homeKey.toUpperCase()})`;
      } else {
        this.targetHintText.textContent = `Keep hands relaxed over home row (ASDF - JKL;)`;
      }
    }
  }

  animateFingerTap(fingerId) {
    // Coach bar visual pulse
    if (this.targetKeyHero) {
      this.targetKeyHero.classList.add('target-key-tap');
      setTimeout(() => this.targetKeyHero.classList.remove('target-key-tap'), 150);
    }
  }

  setStatusTag(text, type = 'ready') {
    if (this.coachStatusTag) {
      this.coachStatusTag.textContent = text;
      this.coachStatusTag.className = `dock-tag status-${type}`;
    }
  }

  setFinishedState() {
    this.setStatusTag('COMPLETE!', 'complete');
    if (this.targetKeyHero) {
      this.targetKeyHero.textContent = '↺';
    }
    if (this.fingerColorDot) {
      this.fingerColorDot.style.backgroundColor = '#10b981';
      this.fingerColorDot.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.6)';
    }
    if (this.fingerNameText) {
      this.fingerNameText.textContent = 'Test Finished';
    }
    if (this.targetHintText) {
      this.targetHintText.textContent = 'Press any key or Space to start next test (or press Tab + Enter)';
    }
  }
}
