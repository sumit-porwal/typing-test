/**
 * Settings & Preferences Manager for KeyVibe Touch Typing Studio
 * Handles local persistence, drawer controls, and toolbar synchronization.
 */

import { sound } from './audio.js';
import { tts } from './tts.js';

export class SettingsManager {
  constructor(app) {
    this.app = app;

    // Cursor Style
    this.cursorStyle = 'line';
    try {
      const savedCursor = localStorage.getItem('keyvibe_cursor_style');
      if (savedCursor && ['line', 'block', 'underline', 'outline'].includes(savedCursor)) {
        this.cursorStyle = savedCursor;
      }
    } catch (_) { }

    // Keyboard Appearance & Geometry
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

    // Keyboard Visibility
    this.showKeyboard = true;
    try {
      const savedKb = localStorage.getItem('keyvibe_show_keyboard');
      if (savedKb !== null) this.showKeyboard = (savedKb === 'true');
    } catch (_) { }

    // Words Configuration
    this.wordCount = 25;
    this.timeLimit = 0; // 0 for word sprint, or 15/30/60 for countdown
    this.punctuation = false;
    this.numbers = false;
    this.dictionary = 'standard';

    try {
      const savedWords = localStorage.getItem('keyvibe_words');
      if (savedWords) this.wordCount = Math.max(10, parseInt(savedWords, 10) || 25);
      const savedTime = localStorage.getItem('keyvibe_time');
      if (savedTime) this.timeLimit = parseInt(savedTime, 10);
      if (localStorage.getItem('keyvibe_punct') === 'true') this.punctuation = true;
      if (localStorage.getItem('keyvibe_num') === 'true') this.numbers = true;
      const savedDict = localStorage.getItem('keyvibe_dict');
      if (savedDict) this.dictionary = savedDict;
    } catch (_) { }
  }

  init() {
    this.syncSoundUI();
    this.syncVoiceUI();
    this.syncCursorUI();
    this.applyKeyboardSettings();
    this.syncHandSettingsUI();
    this.syncWordsSettingsUI();
    this.syncKeyboardVisibilityUI();
    this.populateVoiceList();
    this.attachListeners();
  }

  attachListeners() {
    // Sound Toggle Button (Header)
    const toggleSoundBtn = document.getElementById('btn-toggle-sound');
    if (toggleSoundBtn) {
      toggleSoundBtn.addEventListener('click', (e) => {
        if (e.shiftKey) {
          sound.toggleMute();
        } else {
          sound.cycleProfile();
        }
        this.syncSoundUI();
      });
    }

    // Sound Profile Select (Drawer)
    const soundProfileSelect = document.getElementById('select-sound-profile');
    if (soundProfileSelect) {
      soundProfileSelect.value = sound.getProfile();
      soundProfileSelect.addEventListener('change', (e) => {
        sound.setProfile(e.target.value, true);
        this.syncSoundUI();
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
        this.syncSoundUI();
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

    // Voice Coach Toggle (Header)
    const toggleVoiceBtn = document.getElementById('btn-toggle-voice');
    if (toggleVoiceBtn) {
      toggleVoiceBtn.addEventListener('click', (e) => {
        if (e.shiftKey) {
          const newMode = tts.cycleMode();
          this.app.showToast(`🗣️ Voice Coach: ${newMode.toUpperCase()}`);
        } else {
          const enabled = tts.toggle();
          this.app.showToast(enabled ? `🗣️ Voice Coach: ${tts.mode.toUpperCase()}` : '🔇 Voice Coach: MUTED');
        }
        this.syncVoiceUI();
      });
    }

    // Voice Coach Settings (Drawer)
    const ttsModeSelect = document.getElementById('select-tts-mode');
    if (ttsModeSelect) {
      ttsModeSelect.addEventListener('change', (e) => {
        tts.setMode(e.target.value);
        this.syncVoiceUI();
      });
    }

    const settingVoiceToggleBtn = document.getElementById('btn-setting-voice-toggle');
    if (settingVoiceToggleBtn) {
      settingVoiceToggleBtn.addEventListener('click', () => {
        const enabled = tts.toggle();
        this.app.showToast(enabled ? `🗣️ Voice Coach: ${tts.mode.toUpperCase()}` : '🔇 Voice Coach: MUTED');
        this.syncVoiceUI();
      });
    }

    const dockWaveContainer = document.getElementById('tts-wave-container');
    if (dockWaveContainer) {
      dockWaveContainer.addEventListener('click', () => {
        const enabled = tts.toggle();
        this.app.showToast(enabled ? `🗣️ Voice Coach: ${tts.mode.toUpperCase()}` : '🔇 Voice Coach: MUTED');
        this.syncVoiceUI();
      });
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

    // Cursor Style Toggle (Header)
    const toggleCursorBtn = document.getElementById('btn-toggle-cursor');
    if (toggleCursorBtn) {
      toggleCursorBtn.addEventListener('click', () => {
        this.cycleCursorStyle();
      });
    }

    const cursorPresets = document.getElementById('cursor-presets');
    if (cursorPresets) {
      cursorPresets.querySelectorAll('.sub-opt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const style = e.currentTarget.dataset.cursor;
          if (style) this.setCursorStyle(style);
        });
      });
    }

    // Keyboard Appearance
    const kbThemeSelect = document.getElementById('select-kb-theme');
    if (kbThemeSelect) {
      kbThemeSelect.addEventListener('change', (e) => {
        this.setKeyboardTheme(e.target.value);
      });
    }

    const themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.dataset.theme;
        if (theme) this.setKeyboardTheme(theme);
      });
    });

    const kbWidthSlider = document.getElementById('slider-kb-width');
    if (kbWidthSlider) {
      kbWidthSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setKeyboardSize(val, undefined);
        const badge = document.getElementById('val-kb-width');
        if (badge) badge.textContent = `${val}%`;
      });
    }

    const kbHeightSlider = document.getElementById('slider-kb-height');
    if (kbHeightSlider) {
      kbHeightSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setKeyboardSize(undefined, val);
        const badge = document.getElementById('val-kb-height');
        if (badge) badge.textContent = `${val}px`;
      });
    }

    // Keyboard Visibility
    const toggleKbBtn = document.getElementById('btn-toggle-keyboard');
    if (toggleKbBtn) {
      toggleKbBtn.addEventListener('click', () => this.toggleKeyboard());
    }

    const settingKbToggleBtn = document.getElementById('btn-setting-kb-toggle');
    if (settingKbToggleBtn) {
      settingKbToggleBtn.addEventListener('click', () => this.toggleKeyboard());
    }

    // Hands Overlay Sliders & Toggle
    const handOpacitySlider = document.getElementById('slider-hand-opacity');
    if (handOpacitySlider) {
      handOpacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.app.overlay) this.app.overlay.setOpacity(val / 100);
        const badge = document.getElementById('val-hand-opacity');
        if (badge) badge.textContent = `${val}%`;
      });
    }

    const handThicknessSlider = document.getElementById('slider-hand-thickness');
    if (handThicknessSlider) {
      handThicknessSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.app.overlay) this.app.overlay.setThickness(val / 100);
        const badge = document.getElementById('val-hand-thickness');
        if (badge) badge.textContent = `${val}%`;
      });
    }

    const toggleHandsBtn = document.getElementById('btn-toggle-hands');
    if (toggleHandsBtn) {
      toggleHandsBtn.addEventListener('click', () => {
        if (!this.showKeyboard) return;
        const isEnabled = this.app.overlay ? this.app.overlay.toggleOverlay() : true;
        toggleHandsBtn.classList.toggle('active', isEnabled);
        const handsRoom = document.querySelector('.hands-room');
        if (handsRoom) handsRoom.classList.toggle('collapsed', !isEnabled);
      });
    }

    // Settings Drawer Filter Tabs
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

    // Reset Defaults
    const resetSettingsBtn = document.getElementById('btn-reset-settings');
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', () => this.resetDefaults());
    }
  }

  syncSoundUI() {
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
    if (toggleLabel) toggleLabel.textContent = isMuted ? 'Muted' : 'Sound';
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', !isMuted);
      toggleBtn.title = isMuted
        ? 'Keyboard Sound: Muted (Click to cycle profile, Shift+Click to unmute)'
        : `Keyboard Sound: ${profileLabels[profile] || profile} (Click to cycle profile, Shift+Click to mute)`;
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

  syncVoiceUI() {
    const isEnabled = tts.isEnabled();
    const mode = tts.mode;

    const modeLabels = {
      coach: 'Coach',
      letter: 'Letter',
      word: 'Word',
      off: 'Muted'
    };

    const modeIcons = {
      coach: '🗣️',
      letter: '🔤',
      word: '📖',
      off: '🔇'
    };

    const toggleBtn = document.getElementById('btn-toggle-voice');
    const toggleIcon = document.getElementById('voice-toggle-icon');
    const toggleLabel = document.getElementById('voice-toggle-label');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', isEnabled);
      toggleBtn.classList.toggle('off', !isEnabled);
      toggleBtn.setAttribute('aria-pressed', String(isEnabled));
      toggleBtn.title = isEnabled
        ? `Voice Coach: ${modeLabels[mode] || mode} mode (Click to mute, Shift+Click to cycle) [Alt+V]`
        : 'Voice Coach: Muted (Click to enable, Shift+Click to cycle) [Alt+V]';
    }
    if (toggleIcon) toggleIcon.textContent = modeIcons[mode] || (isEnabled ? '🗣️' : '🔇');
    if (toggleLabel) toggleLabel.textContent = isEnabled ? (modeLabels[mode] || 'Coach') : 'Voice Off';

    const settingToggleBtn = document.getElementById('btn-setting-voice-toggle');
    const settingToggleIcon = document.getElementById('setting-voice-toggle-icon');
    const settingToggleLabel = document.getElementById('setting-voice-toggle-label');
    if (settingToggleBtn) {
      settingToggleBtn.classList.toggle('active', isEnabled);
      if (settingToggleIcon) settingToggleIcon.textContent = isEnabled ? '🗣️' : '🔇';
      if (settingToggleLabel) settingToggleLabel.textContent = isEnabled ? 'Enabled' : 'Muted';
    }

    const ttsModeSelect = document.getElementById('select-tts-mode');
    if (ttsModeSelect && ttsModeSelect.value !== mode) {
      ttsModeSelect.value = mode;
    }

    const ttsRateSlider = document.getElementById('slider-tts-rate');
    const ttsRateVal = document.getElementById('val-tts-rate');
    if (ttsRateSlider && tts.rate) {
      ttsRateSlider.value = tts.rate;
      if (ttsRateVal) ttsRateVal.textContent = `${tts.rate}x`;
    }

    if (this.app.hands) {
      this.app.hands.setTTSMode(mode);
    }
  }

  setCursorStyle(style) {
    if (!['line', 'block', 'underline', 'outline'].includes(style)) return;
    this.cursorStyle = style;
    try {
      localStorage.setItem('keyvibe_cursor_style', style);
    } catch (_) { }
    this.syncCursorUI();
    this.app.updateCaretPosition();
  }

  cycleCursorStyle() {
    const styles = ['line', 'block', 'underline', 'outline'];
    const idx = styles.indexOf(this.cursorStyle);
    const nextStyle = styles[(idx + 1) % styles.length];
    this.setCursorStyle(nextStyle);
    return nextStyle;
  }

  syncCursorUI() {
    const style = this.cursorStyle;
    const styleLabels = { line: 'Line', block: 'Block', underline: 'Underline', outline: 'Outline' };
    const styleIcons = { line: '|', block: '█', underline: '_', outline: '▢' };

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

    if (this.app.caretEl) {
      this.app.caretEl.classList.remove('cursor-line', 'cursor-block', 'cursor-underline', 'cursor-outline');
      this.app.caretEl.classList.add(`cursor-${style}`);
    }
  }

  setKeyboardTheme(theme) {
    this.kbTheme = theme;
    try {
      localStorage.setItem('keyvibe_kb_theme', theme);
    } catch (_) { }
    this.applyKeyboardSettings();
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
    this.applyKeyboardSettings();
  }

  applyKeyboardSettings() {
    document.body.setAttribute('data-kb-theme', this.kbTheme);
    document.documentElement.style.setProperty('--kb-width', `${this.kbWidth}%`);
    document.documentElement.style.setProperty('--kb-key-height', `${this.kbHeight}px`);

    setTimeout(() => {
      if (this.app.overlay) this.app.overlay.updatePositions(true);
    }, 40);
    this.syncHandSettingsUI();
  }

  syncHandSettingsUI() {
    if (this.app.overlay) {
      const opacitySlider = document.getElementById('slider-hand-opacity');
      const opacityVal = document.getElementById('val-hand-opacity');
      if (opacitySlider) {
        const pct = Math.round(this.app.overlay.opacity * 100);
        opacitySlider.value = pct;
        if (opacityVal) opacityVal.textContent = `${pct}%`;
      }

      const thicknessSlider = document.getElementById('slider-hand-thickness');
      const thicknessVal = document.getElementById('val-hand-thickness');
      if (thicknessSlider) {
        const pct = Math.round((this.app.overlay.handScale || 1.0) * 100);
        thicknessSlider.value = pct;
        if (thicknessVal) thicknessVal.textContent = `${pct}%`;
      }
    }

    const themeSelect = document.getElementById('select-kb-theme');
    if (themeSelect && themeSelect.value !== this.kbTheme) {
      themeSelect.value = this.kbTheme;
    }

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

    this.syncVoiceUI();
  }

  populateVoiceList() {
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

    this.syncKeyboardVisibilityUI();
    if (this.showKeyboard) {
      this.app.showToast('⌨️ Virtual Keyboard Visible');
    } else {
      this.app.showToast('⌨️ Virtual Keyboard Hidden');
    }
  }

  syncKeyboardVisibilityUI() {
    const kbSection = document.querySelector('.keyboard-section');
    const handsRoom = document.querySelector('.hands-room');
    const kbToggleBtn = document.getElementById('btn-toggle-keyboard');
    const handsBtn = document.getElementById('btn-toggle-hands');
    const settingKbBtn = document.getElementById('btn-setting-kb-toggle');

    if (kbSection) {
      kbSection.classList.toggle('hidden', !this.showKeyboard);
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

    if (!this.showKeyboard) {
      if (this.app.overlay && this.app.overlay.svg) this.app.overlay.svg.style.display = 'none';
    } else {
      if (this.app.overlay && this.app.overlay.svg) {
        this.app.overlay.svg.style.display = this.app.overlay.isEnabled ? 'block' : 'none';
        this.app.overlay.updatePositions(true);
      }
    }
  }

  syncWordsSettingsUI() {
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

  resetDefaults() {
    sound.setProfile('thock', false);
    sound.setVolume(0.5);
    if (sound.isMuted) sound.toggleMute();

    if (this.app.overlay) {
      this.app.overlay.setOpacity(0.5);
      this.app.overlay.setThickness(1.0);
      if (!this.app.overlay.isEnabled) this.app.overlay.toggleOverlay();
    }

    this.kbTheme = 'cyber-dark';
    this.kbWidth = 100;
    this.kbHeight = 35;
    try {
      localStorage.setItem('keyvibe_kb_theme', 'cyber-dark');
      localStorage.setItem('keyvibe_kb_width', '100');
      localStorage.setItem('keyvibe_kb_height', '35');
    } catch (_) { }
    this.applyKeyboardSettings();

    this.setCursorStyle('line');

    tts.setMode('coach');
    tts.setRate(1.1);

    this.syncSoundUI();
    this.syncVoiceUI();
    this.syncCursorUI();
    this.syncHandSettingsUI();

    const resetSettingsBtn = document.getElementById('btn-reset-settings');
    if (resetSettingsBtn) {
      const origText = resetSettingsBtn.innerHTML;
      resetSettingsBtn.innerHTML = '✓ Restored!';
      resetSettingsBtn.style.borderColor = '#4ade80';
      resetSettingsBtn.style.color = '#4ade80';
      setTimeout(() => {
        resetSettingsBtn.innerHTML = origText;
        resetSettingsBtn.style.borderColor = '';
        resetSettingsBtn.style.color = '';
      }, 1500);
    }

    sound.playSuccessChime();
  }
}
