/**
 * KeyVibe Sound Engine
 * Hybrid Authentic Audio Architecture:
 * - Real Recorded Switch Samples (NovelKeys Cream, Cherry MX Blue, Vintage Typewriter, Cherry MX Black, Soft Membrane)
 * - Public Voice Sample Library (Real spoken voice announcements for every key and letter)
 * - Multi-Sample Round Robin & Micro-Pitch Acoustic Detuning (eliminates repetitive machine-gun effect)
 * - Dual-Action Mechanical Acoustics (Authentic Downstroke Bottom-Out + Upstroke Top-Out Key Return Clack)
 * - Spacebar Stabilizer Resonance Weighting
 * - Ultra-Low Latency Web Audio API AudioBuffer Decoding & Procedural Fallbacks
 */

const PROFILE_NAMES = {
  thock: 'Creamy Thock (NovelKeys Cream)',
  clicky: 'Crisp Tactile (Cherry MX Blue)',
  typewriter: 'Vintage Typewriter',
  soft: 'Quiet Chiclet / Membrane',
  cherry_black: 'Deep Linear (Cherry MX Black)',
  voice: 'Public Voice Samples (Spoken Keys)',
  off: 'Mute Sound Effects'
};

const PROFILE_KEYS = ['thock', 'clicky', 'typewriter', 'soft', 'cherry_black', 'voice', 'off'];

const SAMPLE_PACKS = {
  thock: { folder: 'sounds/thock', count: 6 },
  clicky: { folder: 'sounds/clicky', count: 10 },
  typewriter: { folder: 'sounds/typewriter', count: 6 },
  soft: { folder: 'sounds/soft', count: 5 },
  cherry_black: { folder: 'sounds/cherry_black', count: 10 }
};

const VOICE_SPECIAL_MAP = {
  ' ': 'space.wav',
  '\n': 'enter.wav',
  'Enter': 'enter.wav',
  'Backspace': 'back.wav',
  'Tab': 'tab.wav',
  'Escape': 'esc.wav',
  ',': 'comma.wav',
  '.': 'point.wav',
  ';': 'semicol.wav',
  ':': 'semicol.wav',
  "'": 'apostrf.wav',
  '"': 'apostrf.wav',
  '-': 'minus.wav',
  '_': 'minus.wav',
  '=': 'equal.wav',
  '+': 'plus.wav',
  '/': 'slash.wav',
  '?': 'question.wav',
  '[': 'open.wav',
  ']': 'close.wav',
  '(': 'open.wav',
  ')': 'close.wav'
};

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.soundProfile = 'thock';
    this.volume = 0.5;
    this.isMuted = false;
    this.enableKeyRelease = true;
    this.releaseVolumeRatio = 0.35;
    this.comboNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]; // C major pentatonic

    // Buffers cache
    this.sampleBuffers = {}; // { [profile]: AudioBuffer[] }
    this.voiceBuffers = {};  // { [filename]: AudioBuffer }
    this.loadingProfiles = new Set();
    this.lastSampleIndices = {};

    // Load saved settings
    try {
      const savedProfile = localStorage.getItem('keyvibe_sound_profile');
      if (savedProfile && PROFILE_KEYS.includes(savedProfile)) {
        this.soundProfile = savedProfile;
      }
      const savedVol = localStorage.getItem('keyvibe_sound_vol');
      if (savedVol !== null) {
        this.volume = Math.max(0, Math.min(1, parseFloat(savedVol)));
      }
      const savedRelease = localStorage.getItem('keyvibe_sound_release');
      if (savedRelease !== null) {
        this.enableKeyRelease = savedRelease === 'true';
      }
    } catch (_) {}

    // Auto preload selected profile on first user action
    this._attachLazyInit();
  }

  _attachLazyInit() {
    const trigger = () => {
      this.init();
      window.removeEventListener('pointerdown', trigger);
      window.removeEventListener('keydown', trigger);
    };
    window.addEventListener('pointerdown', trigger, { once: true, passive: true });
    window.addEventListener('keydown', trigger, { once: true, passive: true });
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.ctx) {
      this.preloadProfile(this.soundProfile);
      // Eagerly preload common mechanical packs in background
      setTimeout(() => {
        PROFILE_KEYS.forEach(p => {
          if (p !== 'off' && p !== this.soundProfile) {
            this.preloadProfile(p);
          }
        });
      }, 1000);
    }
  }

  getProfile() {
    return this.soundProfile;
  }

  getProfileName(profile = this.soundProfile) {
    return PROFILE_NAMES[profile] || profile;
  }

  setProfile(profile, preview = false) {
    if (!PROFILE_KEYS.includes(profile)) return;
    this.soundProfile = profile;
    try {
      localStorage.setItem('keyvibe_sound_profile', profile);
    } catch (_) {}

    if (profile !== 'off') {
      this.preloadProfile(profile);
    }

    if (preview && profile !== 'off') {
      this.playKeypress(false, 'f', 'KeyF');
    }
  }

  cycleProfile() {
    const idx = PROFILE_KEYS.indexOf(this.soundProfile);
    const nextProfile = PROFILE_KEYS[(idx + 1) % PROFILE_KEYS.length];
    this.setProfile(nextProfile, true);
    return nextProfile;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('keyvibe_sound_vol', String(this.volume));
    } catch (_) {}
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  setKeyRelease(enabled) {
    this.enableKeyRelease = !!enabled;
    try {
      localStorage.setItem('keyvibe_sound_release', String(this.enableKeyRelease));
    } catch (_) {}
    return this.enableKeyRelease;
  }

  toggleKeyRelease() {
    return this.setKeyRelease(!this.enableKeyRelease);
  }

  /* -----------------------------------------------------------
   * Sample Loading & Decoding
   * ----------------------------------------------------------- */
  async preloadProfile(profile) {
    if (!profile || profile === 'off' || this.loadingProfiles.has(profile)) return;
    if (this.sampleBuffers[profile] && this.sampleBuffers[profile].length > 0) return;

    this.loadingProfiles.add(profile);
    this.init();
    if (!this.ctx) return;

    try {
      if (profile === 'voice') {
        await this._preloadCommonVoiceSamples();
      } else if (SAMPLE_PACKS[profile]) {
        const { folder, count } = SAMPLE_PACKS[profile];
        const buffers = [];
        const loadPromises = [];

        for (let i = 1; i <= count; i++) {
          const url = `${folder}/${i}.wav`;
          loadPromises.push(
            fetch(url)
              .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.arrayBuffer();
              })
              .then(arrayBuf => this.ctx.decodeAudioData(arrayBuf))
              .then(audioBuf => {
                buffers.push(audioBuf);
              })
              .catch(err => {
                console.warn(`[KeyVibe Audio] Could not load sample ${url}:`, err.message);
              })
          );
        }

        await Promise.allSettled(loadPromises);
        if (buffers.length > 0) {
          this.sampleBuffers[profile] = buffers;
        }
      }
    } catch (e) {
      console.warn(`[KeyVibe Audio] Error preloading profile ${profile}:`, e);
    } finally {
      this.loadingProfiles.delete(profile);
    }
  }

  async _preloadCommonVoiceSamples() {
    if (!this.ctx) return;
    // Load common alphabet, numbers, and space
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
    const files = chars.map(c => (c >= '0' && c <= '9' ? `dig${c}.wav` : `char${c}.wav`));
    files.push('space.wav', 'enter.wav', 'back.wav', 'point.wav', 'comma.wav');

    const promises = files.map(fn => {
      if (this.voiceBuffers[fn]) return Promise.resolve();
      return fetch(`sounds/voice/${fn}`)
        .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(buf => { this.voiceBuffers[fn] = buf; })
        .catch(() => {});
    });

    await Promise.allSettled(promises);
  }

  _getVoiceFilename(key, isSpace = false) {
    if (isSpace || key === ' ') return 'space.wav';
    if (!key) return 'chara.wav';

    if (VOICE_SPECIAL_MAP[key]) {
      return VOICE_SPECIAL_MAP[key];
    }

    const lower = String(key).toLowerCase();
    if (lower.length === 1) {
      if (lower >= 'a' && lower <= 'z') {
        return `char${lower}.wav`;
      }
      if (lower >= '0' && lower <= '9') {
        return `dig${lower}.wav`;
      }
    }

    if (key === 'Backspace') return 'back.wav';
    if (key === 'Enter') return 'enter.wav';

    return 'chara.wav';
  }

  /* -----------------------------------------------------------
   * Play Keypress (Bottom-out / Strike)
   * ----------------------------------------------------------- */
  playKeypress(isSpace = false, key = null, code = null) {
    if (this.isMuted || this.soundProfile === 'off') return;
    this.init();
    if (!this.ctx) return;

    // Handle object argument for flexibility
    if (typeof isSpace === 'object' && isSpace !== null) {
      const opts = isSpace;
      isSpace = !!opts.isSpace;
      key = opts.key || null;
      code = opts.code || null;
    }

    const t = this.ctx.currentTime;
    const masterGainVal = this.volume;

    // 1. Spoken Voice Profile (Public Voice Samples)
    if (this.soundProfile === 'voice') {
      this._playVoiceSample(t, isSpace, key, masterGainVal);
      return;
    }

    // 2. Realistic Recorded Mechanical Switch Samples
    const buffers = this.sampleBuffers[this.soundProfile];
    if (buffers && buffers.length > 0) {
      this._playSampleBuffer(t, buffers, isSpace, masterGainVal);
      return;
    }

    // 3. Ultra-realistic procedural acoustic physical simulation fallback
    switch (this.soundProfile) {
      case 'thock':
        this._playThock(t, isSpace);
        break;
      case 'clicky':
        this._playClicky(t, isSpace);
        break;
      case 'typewriter':
        this._playTypewriter(t, isSpace);
        break;
      case 'soft':
        this._playSoft(t, isSpace);
        break;
      case 'cherry_black':
        this._playCherryBlack(t, isSpace);
        break;
    }
  }

  _playSampleBuffer(t, buffers, isSpace, masterGainVal) {
    // Multi-sample round-robin selection (avoid repeating exact same sample consecutively)
    let idx = Math.floor(Math.random() * buffers.length);
    if (buffers.length > 1 && idx === this.lastSampleIndices[this.soundProfile]) {
      idx = (idx + 1 + Math.floor(Math.random() * (buffers.length - 1))) % buffers.length;
    }
    this.lastSampleIndices[this.soundProfile] = idx;
    const buffer = buffers[idx];

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Natural human strike micro-pitch variation (±22 cents) for anti-robotic feel
    const pitchDetune = (Math.random() * 44 - 22);

    // Spacebar acoustic depth: large keycap and stabilizer bar deepens resonance
    if (isSpace) {
      source.detune.setValueAtTime(pitchDetune - 130, t);
    } else {
      source.detune.setValueAtTime(pitchDetune, t);
    }

    // Velocity dynamics (±5% organic force)
    const velocityGain = 0.95 + Math.random() * 0.1;
    const gainNode = this.ctx.createGain();
    const finalVolume = masterGainVal * (isSpace ? 1.05 : 1.0) * velocityGain;
    gainNode.gain.setValueAtTime(finalVolume, t);

    // Connect audio graph
    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // Spacebar stabilizer physical desk warmth impulse (65Hz sub-sine)
    if (isSpace) {
      this._addSpacebarSubWeight(t, masterGainVal);
    }

    source.start(t);
  }

  _playVoiceSample(t, isSpace, key, masterGainVal) {
    const fn = this._getVoiceFilename(key, isSpace);
    const buf = this.voiceBuffers[fn];

    if (buf) {
      const source = this.ctx.createBufferSource();
      source.buffer = buf;
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(masterGainVal * 0.95, t);
      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      source.start(t);
    } else {
      // Lazy fetch single voice file if not loaded yet
      fetch(`sounds/voice/${fn}`)
        .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(decoded => {
          this.voiceBuffers[fn] = decoded;
          const src = this.ctx.createBufferSource();
          src.buffer = decoded;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(masterGainVal * 0.95, this.ctx.currentTime);
          src.connect(g);
          g.connect(this.ctx.destination);
          src.start();
        })
        .catch(() => {
          // Fallback to creamy thock if sample missing
          this._playThock(t, isSpace);
        });
    }
  }

  _addSpacebarSubWeight(t, masterGainVal) {
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(75, t);
    subOsc.frequency.exponentialRampToValueAtTime(38, t + 0.05);

    subGain.gain.setValueAtTime(masterGainVal * 0.35, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.06);
  }

  /* -----------------------------------------------------------
   * Play Keyrelease (Upstroke Return Clack)
   * Real mechanical switches emit a crisp return clack when the stem resets
   * ----------------------------------------------------------- */
  playKeyrelease(isSpace = false, key = null, code = null) {
    if (this.isMuted || this.soundProfile === 'off' || !this.enableKeyRelease) return;
    if (this.soundProfile === 'voice') return; // Voice only triggers on keypress
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const buffers = this.sampleBuffers[this.soundProfile];
    const releaseVolume = this.volume * this.releaseVolumeRatio;

    if (buffers && buffers.length > 0) {
      // Play a pitch-shifted micro-slice of switch audio representing slider top-out
      const idx = Math.floor(Math.random() * buffers.length);
      const buffer = buffers[idx];
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      // Upstroke is higher pitched (+220 cents) with rapid decay
      source.detune.setValueAtTime(isSpace ? 90 : 220 + (Math.random() * 30 - 15), t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(releaseVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (isSpace ? 0.045 : 0.035));

      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(t);
      source.stop(t + 0.05);
    } else {
      // Procedural key release clack (crisp high-pass housing snap)
      this._playProceduralRelease(t, isSpace, releaseVolume);
    }
  }

  _playProceduralRelease(t, isSpace, releaseVolume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isSpace ? 520 : 840, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.025);

    filter.type = 'highpass';
    filter.frequency.value = isSpace ? 1400 : 2400;

    gain.gain.setValueAtTime(releaseVolume * 0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.035);
  }

  /* -----------------------------------------------------------
   * Procedural Acoustic Simulation (High Fidelity Fallbacks)
   * ----------------------------------------------------------- */
  _playThock(t, isSpace) {
    // Deep, creamy bottom-out sound (Holy Panda / NK Cream)
    const baseFreq = isSpace ? 105 : (145 + (Math.random() * 16 - 8));
    const masterGain = this.volume * 0.78;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 2.1, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.52, t + 0.06);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isSpace ? 850 : 1200, t);
    filter.frequency.exponentialRampToValueAtTime(240, t + 0.06);

    gain.gain.setValueAtTime(masterGain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.068);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    this._addSpacebarSubWeight(t, masterGain);

    // Key housing friction noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.035);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = isSpace ? 800 : 1200;
    noiseFilter.Q.value = 2.8;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(masterGain * 0.55, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.075);
    noise.start(t);
    noise.stop(t + 0.045);
  }

  _playClicky(t, isSpace) {
    // Cherry MX Blue: distinct tactile click leaf snap + body bottom-out
    const masterGain = this.volume * 0.72;

    const clickSize = Math.floor(this.ctx.sampleRate * 0.012);
    const clickBuffer = this.ctx.createBuffer(1, clickSize, this.ctx.sampleRate);
    const clickData = clickBuffer.getChannelData(0);
    for (let i = 0; i < clickSize; i++) {
      clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickSize * 0.16));
    }
    const clickSource = this.ctx.createBufferSource();
    clickSource.buffer = clickBuffer;

    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = isSpace ? 2300 : 3500;

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(masterGain * 0.88, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.016);

    clickSource.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.ctx.destination);

    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'triangle';
    popOsc.frequency.setValueAtTime(isSpace ? 1500 : 2500 + Math.random() * 300, t);
    popOsc.frequency.exponentialRampToValueAtTime(450, t + 0.019);

    popGain.gain.setValueAtTime(masterGain * 0.65, t);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);

    popOsc.connect(popGain);
    popGain.connect(this.ctx.destination);

    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(isSpace ? 200 : 360, t + 0.003);
    bodyOsc.frequency.exponentialRampToValueAtTime(80, t + 0.042);

    bodyGain.gain.setValueAtTime(masterGain * 0.45, t + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.ctx.destination);

    clickSource.start(t);
    clickSource.stop(t + 0.02);
    popOsc.start(t);
    popOsc.stop(t + 0.025);
    bodyOsc.start(t + 0.003);
    bodyOsc.stop(t + 0.05);
  }

  _playTypewriter(t, isSpace) {
    // Vintage typewriter: mechanical metallic strike + chassis ring
    const masterGain = this.volume * 0.74;

    const strikeSize = Math.floor(this.ctx.sampleRate * 0.026);
    const strikeBuffer = this.ctx.createBuffer(1, strikeSize, this.ctx.sampleRate);
    const strikeData = strikeBuffer.getChannelData(0);
    for (let i = 0; i < strikeSize; i++) {
      strikeData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (strikeSize * 0.2));
    }
    const strikeSource = this.ctx.createBufferSource();
    strikeSource.buffer = strikeBuffer;

    const strikeFilter = this.ctx.createBiquadFilter();
    strikeFilter.type = 'bandpass';
    strikeFilter.frequency.value = isSpace ? 1150 : 2200;
    strikeFilter.Q.value = 3.6;

    const strikeGain = this.ctx.createGain();
    strikeGain.gain.setValueAtTime(masterGain * 0.85, t);
    strikeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);

    strikeSource.connect(strikeFilter);
    strikeFilter.connect(strikeGain);
    strikeGain.connect(this.ctx.destination);

    const metalOsc = this.ctx.createOscillator();
    const metalGain = this.ctx.createGain();
    metalOsc.type = 'sawtooth';
    metalOsc.frequency.setValueAtTime(isSpace ? 470 : 940 + Math.random() * 120, t);
    metalOsc.frequency.exponentialRampToValueAtTime(170, t + 0.048);

    metalGain.gain.setValueAtTime(masterGain * 0.48, t);
    metalGain.gain.exponentialRampToValueAtTime(0.001, t + 0.052);

    const metalFilter = this.ctx.createBiquadFilter();
    metalFilter.type = 'lowpass';
    metalFilter.frequency.value = 1700;

    metalOsc.connect(metalFilter);
    metalFilter.connect(metalGain);
    metalGain.connect(this.ctx.destination);

    strikeSource.start(t);
    strikeSource.stop(t + 0.035);
    metalOsc.start(t);
    metalOsc.stop(t + 0.06);
  }

  _playSoft(t, isSpace) {
    // Quiet chiclet / membrane keyboard
    const masterGain = this.volume * 0.44;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isSpace ? 120 : 185 + (Math.random() * 14 - 7), t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.035);

    filter.type = 'lowpass';
    filter.frequency.value = 400;

    gain.gain.setValueAtTime(masterGain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  _playCherryBlack(t, isSpace) {
    // Cherry MX Black: heavy linear switch with solid bottom clack
    const baseFreq = isSpace ? 125 : 180 + (Math.random() * 15 - 7);
    const masterGain = this.volume * 0.75;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 2.2, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, t + 0.045);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isSpace ? 1100 : 1600, t);
    filter.frequency.exponentialRampToValueAtTime(320, t + 0.045);

    gain.gain.setValueAtTime(masterGain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.055);
  }

  /* -----------------------------------------------------------
   * UI & Performance Audio Feedback
   * ----------------------------------------------------------- */
  playError() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.linearRampToValueAtTime(95, t + 0.1);

    const masterGain = this.volume * 0.28;
    gain.gain.setValueAtTime(masterGain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  playStreak(comboCount) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const noteIdx = Math.min(this.comboNotes.length - 1, Math.floor(comboCount / 10));
    const freq = this.comboNotes[noteIdx];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.15);

    const masterGain = this.volume * 0.35;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(masterGain, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  playComplete() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.50]; // C Major triumph
    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const noteTime = t + idx * 0.08;
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(this.volume * 0.25, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.65);
    });
  }

  playSuccessChime() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const noteTime = t + idx * 0.07;
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(this.volume * 0.22, noteTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.36);
    });
  }
}

export const sound = new SoundEngine();
