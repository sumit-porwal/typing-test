/**
 * Results Modal, Performance Graph & Confetti Controller for KeyVibe Touch Typing Studio
 * Renders end-of-test diagnostic breakdown, SVG velocity chart, and celebratory animations.
 */

import { FINGERS } from './fingerMap.js';
import { LESSONS, generateWeakKeyDrill } from './lessons.js';

export class ResultsModal {
  constructor(app) {
    this.app = app;
    this.modalEl = document.getElementById('result-modal');
    this.toastEl = document.getElementById('toast-notification');
    this.confettiCanvas = document.getElementById('celebration-canvas');
    this._toastTimer = null;
    this.currentMissedKeys = {};

    this.attachListeners();
  }

  attachListeners() {
    const modalCloseBtn = document.getElementById('btn-modal-close');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => this.hide());

    const modalRetryBtn = document.getElementById('btn-modal-retry');
    if (modalRetryBtn) {
      modalRetryBtn.addEventListener('click', () => {
        this.hide();
        this.app.resetTest(false);
      });
    }

    const modalNextBtn = document.getElementById('btn-modal-next');
    if (modalNextBtn) {
      modalNextBtn.addEventListener('click', () => {
        this.hide();
        if (this.app.academy.mode === 'academy') {
          this.app.academy.nextLesson();
        } else {
          this.app.resetTest(true);
        }
      });
    }

    const modalCopyBtn = document.getElementById('btn-modal-copy');
    if (modalCopyBtn) modalCopyBtn.addEventListener('click', () => this.copyStatsSummary());

    const modalWeakBtn = document.getElementById('btn-practice-weak');
    if (modalWeakBtn) modalWeakBtn.addEventListener('click', () => this.startWeakKeysDrill());
  }

  show(stats, mode, currentLessonIdx, fingerStats, missedKeys, wpmHistory) {
    if (!this.modalEl) return;
    this.currentMissedKeys = missedKeys;

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
      if (mode === 'academy') {
        const l = LESSONS[currentLessonIdx];
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
    this.renderPerformanceChart(stats, wpmHistory);

    // Ergonomic Finger Precision Diagnostic
    this.renderFingerDiagnostics(fingerStats);

    // Missed Keys and Weak Keys Drill Prompt
    this.renderMissedKeys(missedKeys);

    // Update Next Button Label
    const nextLabelEl = document.getElementById('btn-modal-next-label');
    if (nextLabelEl) {
      nextLabelEl.textContent = mode === 'academy' ? 'Next Lesson →' : 'Next Words →';
    }

    this.modalEl.classList.add('open');
  }

  hide() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }

  isOpen() {
    return this.modalEl && this.modalEl.classList.contains('open');
  }

  renderFingerDiagnostics(fingerStats) {
    const fingerChartEl = document.getElementById('modal-finger-breakdown');
    if (!fingerChartEl) return;
    fingerChartEl.innerHTML = '';
    let leftTotal = 0, rightTotal = 0;

    Object.keys(fingerStats).forEach(fKey => {
      const data = fingerStats[fKey];
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

  renderMissedKeys(missedKeys) {
    const missedListEl = document.getElementById('modal-missed-keys');
    const weakDrillBox = document.getElementById('modal-weak-drill-box');
    const missedEntries = Object.entries(missedKeys).sort((a, b) => b[1] - a[1]);

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
  }

  renderPerformanceChart(stats, wpmHistory) {
    const svgEl = document.getElementById('modal-chart-svg');
    const tooltipEl = document.getElementById('modal-chart-tooltip');
    if (!svgEl) return;

    const history = [...wpmHistory];
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

    if (tooltipEl) {
      svgEl.onmousemove = (e) => {
        const rect = svgEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const normTime = Math.max(0, Math.min(maxTime, ((mouseX - padding.left) / chartW) * maxTime));

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

  startWeakKeysDrill() {
    this.hide();
    const weakKeys = Object.keys(this.currentMissedKeys);
    if (!weakKeys.length) return;

    this.app.targetText = generateWeakKeyDrill(weakKeys, 25);
    const modeTitle = document.getElementById('current-mode-title');
    const modeDesc = document.getElementById('current-mode-desc');
    if (modeTitle) modeTitle.textContent = `🎯 Weak Keys Drill (${weakKeys.slice(0, 5).join(', ')})`;
    if (modeDesc) modeDesc.textContent = 'Focused targeted training to calibrate muscle memory on missed keys.';

    this.app.resetTest(false);
    this.showToast('🎯 Targeted Weak Keys drill loaded!');
    if (this.app.textDisplayEl) this.app.textDisplayEl.focus();
  }

  copyStatsSummary() {
    const wpm = document.getElementById('modal-wpm')?.textContent || '0';
    const raw = document.getElementById('modal-wpm-sub')?.textContent || '0 raw';
    const acc = document.getElementById('modal-acc')?.textContent || '100%';
    const consistency = document.getElementById('modal-consistency')?.textContent || '95%';
    const streak = document.getElementById('modal-streak')?.textContent || '0';
    const time = document.getElementById('modal-time-elapsed')?.textContent || '';
    const mode = this.app.academy.mode.toUpperCase();

    const text = `⌨️ KeyVibe Touch Typing Report\n• Net Speed: ${wpm} WPM (${raw})\n• Accuracy: ${acc}\n• Consistency: ${consistency}\n• Max Streak: ${streak} 🔥\n• Duration: ${time}\n• Mode: ${mode}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('📋 Stats summary copied to clipboard!');
      }).catch(() => {
        this.showToast('⚠️ Could not access clipboard');
      });
    }
  }

  showToast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      if (this.toastEl) this.toastEl.classList.remove('show');
    }, 2400);
  }

  launchConfetti() {
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
}
