/**
 * Text-To-Speech (TTS) Voice Guidance Engine
 * Uses Web Speech API with smart queue management and tactile typing coach voice
 */

class TTSEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.selectedVoice = null;
    this.mode = 'coach'; // 'coach', 'letter', 'word', 'off'
    this.previousActiveMode = 'coach';
    this.rate = 1.1; // slightly brisk for natural typing pace
    this.pitch = 1.0;
    this.volume = 0.85;
    this.isSpeaking = false;
    this.onSpeakingChange = null; // callback for UI wave animation
    this.onModeChange = null; // callback for UI synchronization
    this.lastSpokenKey = null;
    this.lastSpeechTime = 0;
    this.consecutiveMistakes = 0;

    this.loadSettings();
    this.initVoices();
  }

  loadSettings() {
    try {
      const savedMode = localStorage.getItem('keyvibe_tts_mode');
      if (savedMode && ['coach', 'letter', 'word', 'off'].includes(savedMode)) {
        this.mode = savedMode;
        if (savedMode !== 'off') {
          this.previousActiveMode = savedMode;
        }
      }
      const savedPrev = localStorage.getItem('keyvibe_tts_prev_mode');
      if (savedPrev && ['coach', 'letter', 'word'].includes(savedPrev)) {
        this.previousActiveMode = savedPrev;
      }
      const savedRate = localStorage.getItem('keyvibe_tts_rate');
      if (savedRate) {
        const r = parseFloat(savedRate);
        if (!isNaN(r) && r >= 0.5 && r <= 2.0) this.rate = r;
      }
    } catch (_) { }
  }

  saveSettings() {
    try {
      localStorage.setItem('keyvibe_tts_mode', this.mode);
      if (this.previousActiveMode) {
        localStorage.setItem('keyvibe_tts_prev_mode', this.previousActiveMode);
      }
      localStorage.setItem('keyvibe_tts_rate', String(this.rate));
    } catch (_) { }
  }

  initVoices() {
    if (!this.synth) return;
    const loadVoices = () => {
      this.voices = this.synth.getVoices();
      if (!this.voices.length) return;

      const savedVoiceName = localStorage.getItem('keyvibe_tts_voice');
      if (savedVoiceName) {
        const savedVoice = this.voices.find(v => v.name === savedVoiceName);
        if (savedVoice) {
          this.selectedVoice = savedVoice;
          return;
        }
      }

      // Prefer high quality English voices (Natural, Google, Samantha, Jenny, Guy, etc.)
      const preferred = this.voices.find(v => 
        (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Premium')))
      ) || this.voices.find(v => v.lang.startsWith('en')) || this.voices[0];

      this.selectedVoice = preferred;
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  getVoices() {
    return this.voices.filter(v => v.lang.startsWith('en') || v.lang === '');
  }

  setVoiceByName(name) {
    const v = this.voices.find(item => item.name === name);
    if (v) {
      this.selectedVoice = v;
      try {
        localStorage.setItem('keyvibe_tts_voice', name);
      } catch (_) { }
    }
  }

  setMode(mode) {
    if (mode !== 'off') {
      this.previousActiveMode = mode;
    }
    this.mode = mode;
    if (mode === 'off' && this.synth) {
      this.synth.cancel();
      this._setSpeaking(false);
    }
    this.saveSettings();
    if (this.onModeChange) {
      this.onModeChange(this.mode);
    }
  }

  toggle() {
    if (this.mode === 'off') {
      this.setMode(this.previousActiveMode || 'coach');
    } else {
      this.setMode('off');
    }
    return this.mode !== 'off';
  }

  cycleMode() {
    const modes = ['coach', 'letter', 'word', 'off'];
    const curIdx = modes.indexOf(this.mode);
    const nextIdx = (curIdx + 1) % modes.length;
    this.setMode(modes[nextIdx]);
    return this.mode;
  }

  isEnabled() {
    return this.mode !== 'off';
  }

  setRate(r) {
    this.rate = parseFloat(r);
    this.saveSettings();
  }

  setPitch(p) {
    this.pitch = parseFloat(p);
  }

  setVolume(vol) {
    this.volume = parseFloat(vol);
  }

  _setSpeaking(val) {
    this.isSpeaking = val;
    if (this.onSpeakingChange) {
      this.onSpeakingChange(val);
    }
  }

  /**
   * Announce target character / key with finger coach instruction
   */
  announceTarget(char, fingerInfo, force = false) {
    if (this.mode === 'off' || !this.synth) return;

    // Prevent immediate re-speech of the exact same key unless forced
    const now = Date.now();
    if (!force && this.lastSpokenKey === char && (now - this.lastSpeechTime < 800)) {
      return;
    }
    this.lastSpokenKey = char;
    this.lastSpeechTime = now;

    let textToSpeak = '';

    if (this.mode === 'coach') {
      const fingerName = fingerInfo ? fingerInfo.shortName : '';
      const charName = this._getReadableChar(char);
      if (char === ' ') {
        textToSpeak = 'Space';
      } else if (fingerInfo && fingerInfo.shift) {
        textToSpeak = `Shift and ${charName}`;
      } else {
        textToSpeak = `${fingerName}, ${charName}`;
      }
    } else if (this.mode === 'letter') {
      textToSpeak = this._getReadableChar(char);
    }

    if (textToSpeak) {
      this._speak(textToSpeak, false);
    }
  }

  /**
   * Speak next word for dictation/word mode
   */
  announceWord(word) {
    if (this.mode !== 'word' || !this.synth || !word) return;
    this._speak(word, false);
  }

  /**
   * Coach advice on mistakes
   */
  announceMistake(expectedChar, fingerInfo) {
    if (this.mode === 'off' || !this.synth) return;
    this.consecutiveMistakes++;

    if (this.consecutiveMistakes >= 2) {
      const charName = this._getReadableChar(expectedChar);
      const fingerName = fingerInfo ? fingerInfo.name : 'proper finger';
      this._speak(`Use ${fingerName} for ${charName}`, true);
      this.consecutiveMistakes = 0;
    }
  }

  resetMistakes() {
    this.consecutiveMistakes = 0;
  }

  announceFeedback(phrase) {
    if (this.mode === 'off' || !this.synth) return;
    this._speak(phrase, true);
  }

  _speak(text, priority = false) {
    if (!this.synth) return;

    // If typing fast, cancel prior unfinished utterances so coach stays synchronized
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    utterance.onstart = () => this._setSpeaking(true);
    utterance.onend = () => this._setSpeaking(false);
    utterance.onerror = () => this._setSpeaking(false);

    try {
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
      this._setSpeaking(false);
    }
  }

  _getReadableChar(char) {
    if (char === ' ') return 'Space';
    if (char === '\n') return 'Enter';
    if (char === '.') return 'Period';
    if (char === ',') return 'Comma';
    if (char === ';') return 'Semicolon';
    if (char === ':') return 'Colon';
    if (char === '!') return 'Exclamation mark';
    if (char === '?') return 'Question mark';
    if (char === '-') return 'Hyphen';
    if (char === '_') return 'Underscore';
    if (char === '/') return 'Slash';
    if (char === "'") return 'Apostrophe';
    if (char === '"') return 'Quote';
    if (char >= 'A' && char <= 'Z') return `Capital ${char}`;
    return char;
  }
}

export const tts = new TTSEngine();
