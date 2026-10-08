/**
 * Realistic transparent hand guide
 * Long, curved, semi-transparent hands overlaid on the on-screen keyboard.
 * Skin is drawn opaque inside one group and the group gets a single opacity,
 * so overlapping fingers stay clean and the keys remain visible underneath.
 */

export class HandOverlay {
  constructor(keyboardContainerId) {
    this.keyboardContainer = document.getElementById(keyboardContainerId);
    this.svg = null;
    this.handsLayer = null;
    this.fadeGrad = null;
    this.activeFingerId = 'LI';
    this.shiftFingerId = null;
    this.targetKeyId = 'KeyF';
    this.isEnabled = true;
    this.mode = 'full';     // 'full', 'active', 'off'
    this.animFrame = null;
    this.boardWidth = 0;
    this.boardHeight = 0;
    this.keyW = 60;
    this.keyH = 40;

    // ---- Tuning knobs ----
    this.opacity = 0.58;    // 0.58 = realistic translucent skin
    this.handScale = 1;     // make the whole hand bigger / smaller

    this.skin = {
      base: '#efc9b5',
      shade: '#c99a86',
      light: '#fbe6da',
      line: '#9e6750',
      outline: '#8c5542',
      edge: '#7d4534'
    };

    // hx/hy = home position, x/y = current, tx/ty = target
    const mk = (homeCode, hand, name, extra = {}) => ({
      homeCode, hand, name, x: 0, y: 0, tx: 0, ty: 0, hx: 0, hy: 0, ...extra
    });
    this.fingers = {
      LP: mk('KeyA', 'left', 'pinky'),
      LR: mk('KeyS', 'left', 'ring'),
      LM: mk('KeyD', 'left', 'middle'),
      LI: mk('KeyF', 'left', 'index'),
      LT: mk('Space', 'left', 'thumb', { isLeftSpace: true }),
      RT: mk('Space', 'right', 'thumb', { isRightSpace: true }),
      RI: mk('KeyJ', 'right', 'index'),
      RM: mk('KeyK', 'right', 'middle'),
      RR: mk('KeyL', 'right', 'ring'),
      RP: mk('Semicolon', 'right', 'pinky')
    };

    // Finger radius (fraction of hand unit)
    this.radiusMap = { pinky: 0.34, ring: 0.39, middle: 0.41, index: 0.41, thumb: 0.42 };
    // Distance from home-row fingertip down to the knuckle (hand units)
    this.dropMap = { pinky: 1.35, ring: 1.65, middle: 1.8, index: 1.6 };
    // Longest a finger can stretch when reaching (hand units)
    this.maxLenMap = { pinky: 2.4, ring: 2.8, middle: 3.0, index: 2.8 };
  }

  get _U() { return this.keyW * this.handScale; }

  init() {
    if (!this.keyboardContainer) return;

    const board = this.keyboardContainer.querySelector('.keyboard-board');
    if (!board) {
      setTimeout(() => this.init(), 50);
      return;
    }

    board.style.position = 'relative';

    let overlay = board.querySelector('#keyboard-hand-overlay');
    if (!overlay) {
      overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      overlay.id = 'keyboard-hand-overlay';
      overlay.setAttribute('class', 'keyboard-hand-overlay-svg');
      board.appendChild(overlay);
    }
    this.svg = overlay;
    this._renderDefs();

    window.addEventListener('resize', () => this.updatePositions(true));
    setTimeout(() => {
      this.updatePositions(true);
      this._startRenderLoop();
    }, 60);
  }

  _renderDefs() {
    this.svg.innerHTML = `
      <defs>
        <linearGradient id="dorsalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#efc9b5"/>
          <stop offset="55%" stop-color="#efc9b5"/>
          <stop offset="100%" stop-color="#dfaf98"/>
        </linearGradient>
        <linearGradient id="nailGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fff5ee"/>
          <stop offset="100%" stop-color="#f3d3bd"/>
        </linearGradient>
        <linearGradient id="activeFingerGlow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.34"/>
          <stop offset="65%" stop-color="#0284c7" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#0369a1" stop-opacity="0.05"/>
        </linearGradient>
        <linearGradient id="shiftFingerGlow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f472b6" stop-opacity="0.34"/>
          <stop offset="65%" stop-color="#db2777" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#be185d" stop-opacity="0.05"/>
        </linearGradient>
        <filter id="handBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7"/>
        </filter>
        <filter id="softEdge" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.0"/>
        </filter>
        <filter id="glowBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5"/>
        </filter>

        <!-- Fades the wrists out below the keyboard -->
        <linearGradient id="fadeGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
          <stop offset="0%" stop-color="#fff"/>
          <stop offset="0.6" stop-color="#a0a0a0"/>
          <stop offset="1" stop-color="#000"/>
        </linearGradient>
        <mask id="handFade" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="9000" height="9000">
          <rect x="-3000" y="-3000" width="9000" height="9000" fill="url(#fadeGrad)"/>
        </mask>
      </defs>
      <g id="hands-layer" mask="url(#handFade)"></g>
    `;
    this.handsLayer = this.svg.querySelector('#hands-layer');
    this.fadeGrad = this.svg.querySelector('#fadeGrad');
  }

  toggleOverlay() {
    this.isEnabled = !this.isEnabled;
    if (this.svg) this.svg.style.display = this.isEnabled ? 'block' : 'none';
    return this.isEnabled;
  }

  setMode(mode) {
    if (!['full', 'active', 'off'].includes(mode)) return;
    this.mode = mode;
    this.isEnabled = (mode !== 'off');
    if (this.svg) {
      this.svg.style.display = this.isEnabled ? 'block' : 'none';
    }
    this._draw();
  }

  setOpacity(val) {
    this.opacity = Math.max(0.05, Math.min(1.0, val));
    this._draw();
  }

  setThickness(val) {
    this.handScale = Math.max(0.6, Math.min(1.6, val));
    this.updatePositions(true);
  }

  /* ------------------------------------------------------------------ */
  /*  Positioning                                                        */
  /* ------------------------------------------------------------------ */

  _keyPoint(board, boardRect, code, fx = 0.5, fy = 0.5) {
    const el = board.querySelector(`[data-code="${code}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width * fx - boardRect.left,
      y: r.top + r.height * fy - boardRect.top
    };
  }

  updatePositions(forceSnap = false) {
    if (!this.keyboardContainer || !this.svg) return;

    const board = this.keyboardContainer.querySelector('.keyboard-board');
    if (!board) return;

    const boardRect = board.getBoundingClientRect();
    if (boardRect.width === 0 || boardRect.height === 0) return;

    this.boardWidth = boardRect.width;
    this.boardHeight = boardRect.height;

    this.svg.setAttribute('viewBox', `0 0 ${this.boardWidth} ${this.boardHeight}`);
    this.svg.style.width = `${this.boardWidth}px`;
    this.svg.style.height = `${this.boardHeight}px`;

    // Key pitch (key + 4px gap)
    const refKey = board.querySelector('[data-code="KeyF"]');
    if (refKey) {
      const rr = refKey.getBoundingClientRect();
      this.keyW = rr.width + 4;
      this.keyH = rr.height + 4;
    }

    // Fade the wrists out before they run off the viewport
    if (this.fadeGrad) {
      const spaceBelow = window.innerHeight - boardRect.bottom;
      const fadeLen = Math.min(this.keyW * 2.2, Math.max(this.keyH * 1.6, spaceBelow - 6));
      const start = this.boardHeight - this.keyH * 0.3;
      this.fadeGrad.setAttribute('y1', start);
      this.fadeGrad.setAttribute('y2', start + fadeLen);
    }

    Object.keys(this.fingers).forEach(id => {
      const f = this.fingers[id];

      // Fingertips rest centered in keycap dish (0.50 X, 0.44 Y)
      let hfx = 0.5, hfy = 0.44;
      if (f.isLeftSpace) { hfx = 0.35; hfy = 0.42; }
      if (f.isRightSpace) { hfx = 0.65; hfy = 0.42; }
      const home = this._keyPoint(board, boardRect, f.homeCode, hfx, hfy);
      if (home) { f.hx = home.x; f.hy = home.y; }

      let targetCode = f.homeCode;
      let fx = hfx, fy = hfy;

      if (id === this.activeFingerId && this.targetKeyId) {
        targetCode = this.targetKeyId;
        fx = 0.5; fy = 0.44;
        if (targetCode === 'Space') {
          fx = f.isLeftSpace ? 0.35 : 0.65;
          fy = 0.42;
        }
      } else if (id === this.shiftFingerId) {
        targetCode = id === 'LP' ? 'ShiftLeft' : 'ShiftRight';
        fx = 0.5; fy = 0.44;
      }

      let pt = this._keyPoint(board, boardRect, targetCode, fx, fy);

      // Thumbs rest on the spacebar just inboard of their own index finger
      // (not at a fixed % of the bar), so they angle toward the centre.
      if (pt && f.name === 'thumb' && targetCode === 'Space') {
        const idx = this._keyPoint(board, boardRect, f.hand === 'left' ? 'KeyF' : 'KeyJ');
        const sl = this._keyPoint(board, boardRect, 'Space', 0, fy);
        const sr = this._keyPoint(board, boardRect, 'Space', 1, fy);
        if (idx && sl && sr) {
          const dir = f.hand === 'left' ? 1 : -1;
          const m = this.keyW * 0.4;
          pt = {
            x: Math.max(sl.x + m, Math.min(sr.x - m, idx.x + dir * this.keyW * 1.0)),
            y: pt.y
          };
        }
      }

      if (pt) {
        f.tx = pt.x;
        f.ty = pt.y;
        if (forceSnap || f.x === 0) {
          f.x = f.tx;
          f.y = f.ty;
        }
      }
    });

    this._draw();
  }

  setTarget(targetKeyId, fingerId, shiftFingerId) {
    this.targetKeyId = targetKeyId;
    this.activeFingerId = fingerId;
    this.shiftFingerId = shiftFingerId;
    this.updatePositions(false);
  }

  animateTap(fingerId) {
    const f = this.fingers[fingerId];
    if (f) {
      f.isTapping = true;
      f.tapProgress = 0;
    }
  }

  _startRenderLoop() {
    const render = () => {
      if (this.isEnabled) {
        let needsUpdate = false;
        Object.keys(this.fingers).forEach(id => {
          const f = this.fingers[id];
          const dx = f.tx - f.x;
          const dy = f.ty - f.y;

          if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
            f.x += dx * 0.25;
            f.y += dy * 0.25;
            needsUpdate = true;
          } else {
            f.x = f.tx;
            f.y = f.ty;
          }

          if (f.isTapping) {
            f.tapProgress += 0.16;
            if (f.tapProgress >= 1) {
              f.isTapping = false;
              f.tapProgress = 0;
            }
            needsUpdate = true;
          }
        });
        if (needsUpdate) this._draw();
      }
      this.animFrame = requestAnimationFrame(render);
    };
    render();
  }

  /* ------------------------------------------------------------------ */
  /*  Geometry helpers                                                   */
  /* ------------------------------------------------------------------ */

  _f(n) { return Math.round(n * 10) / 10; }

  // Closed smooth path through points (Catmull-Rom -> cubic bezier)
  _smoothClosed(pts, k = 1) {
    const n = pts.length;
    let d = `M ${this._f(pts[0].x)} ${this._f(pts[0].y)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const c1x = p1.x + ((p2.x - p0.x) / 6) * k;
      const c1y = p1.y + ((p2.y - p0.y) / 6) * k;
      const c2x = p2.x - ((p3.x - p1.x) / 6) * k;
      const c2y = p2.y - ((p3.y - p1.y) / 6) * k;
      d += ` C ${this._f(c1x)} ${this._f(c1y)}, ${this._f(c2x)} ${this._f(c2y)}, ${this._f(p2.x)} ${this._f(p2.y)}`;
    }
    return d + ' Z';
  }

  // Open smooth path (sides and tip without closing across knuckle base)
  _smoothOpen(pts, k = 1) {
    const n = pts.length;
    if (n < 2) return '';
    let d = `M ${this._f(pts[0].x)} ${this._f(pts[0].y)}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(n - 1, i + 2)];
      const c1x = p1.x + ((p2.x - p0.x) / 6) * k;
      const c1y = p1.y + ((p2.y - p0.y) / 6) * k;
      const c2x = p2.x - ((p3.x - p1.x) / 6) * k;
      const c2y = p2.y - ((p3.y - p1.y) / 6) * k;
      d += ` C ${this._f(c1x)} ${this._f(c1y)}, ${this._f(c2x)} ${this._f(c2y)}, ${this._f(p2.x)} ${this._f(p2.y)}`;
    }
    return d;
  }

  _polyline(pts) {
    return pts.map((p, i) => `${i ? 'L' : 'M'} ${this._f(p.x)} ${this._f(p.y)}`).join(' ');
  }

  // A finger: smooth, tapered tube from knuckle to fingertip with a rounded end
  _fingerGeom(id, knuckle, tip, side) {
    const f = this.fingers[id];
    const isThumb = f.name === 'thumb';
    const r = this._U * this.radiusMap[f.name];

    const dx = tip.x - knuckle.x;
    const dy = tip.y - knuckle.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;

    // The thumb is chunky at the base and tapers toward the tip
    const rStart = isThumb ? 1.08 : 1.0;
    const rEnd = isThumb ? 0.78 : 0.82;

    // Pull centerline end back by (r * rEnd) so the forward apex of the
    // rounded cap (radius r * rEnd) lands precisely on tip.x, tip.y
    const end = { x: tip.x - ux * (r * rEnd), y: tip.y - uy * (r * rEnd) };

    // Relaxed curve: thumb has a gentle natural sweep toward spacebar;
    // typing fingers extend straight toward their target key without lateral banana distortion
    const outward = side === 'left' ? -1 : 1;
    const curl = isThumb ? d * 0.08 * outward : 0;
    const ctrl = {
      x: (knuckle.x + end.x) / 2 + -uy * curl,
      y: (knuckle.y + end.y) / 2 + ux * curl
    };

    const N = 12;
    const cs = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const px = (1 - t) * (1 - t) * knuckle.x + 2 * (1 - t) * t * ctrl.x + t * t * end.x;
      const py = (1 - t) * (1 - t) * knuckle.y + 2 * (1 - t) * t * ctrl.y + t * t * end.y;
      let tx = 2 * (1 - t) * (ctrl.x - knuckle.x) + 2 * t * (end.x - ctrl.x);
      let ty = 2 * (1 - t) * (ctrl.y - knuckle.y) + 2 * t * (end.y - ctrl.y);
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      cs.push({ x: px, y: py, tx, ty, nx: -ty, ny: tx, r: r * (rStart + (rEnd - rStart) * t) });
    }

    // Ensure terminal slice is oriented directly along reach direction (ux, uy)
    // so cap apex and nail are perfectly centered on the target key
    cs[N].tx = ux;
    cs[N].ty = uy;
    cs[N].nx = -uy;
    cs[N].ny = ux;

    // Outline polygon: left side, rounded cap, right side
    const left = cs.map(c => ({ x: c.x + c.nx * c.r, y: c.y + c.ny * c.r }));
    const e = cs[N];
    const cap = [];
    for (let k = 1; k <= 4; k++) {
      const th = (k * Math.PI) / 5;
      cap.push({
        x: e.x + (e.nx * Math.cos(th) + e.tx * Math.sin(th)) * e.r,
        y: e.y + (e.ny * Math.cos(th) + e.ty * Math.sin(th)) * e.r
      });
    }
    const right = cs.slice().reverse().map(c => ({ x: c.x - c.nx * c.r, y: c.y - c.ny * c.r }));
    const contour = left.concat(cap, right);

    return {
      id, f, r, cs, knuckle, tip,
      path: this._smoothClosed(contour, 0.9),
      openPath: this._smoothOpen(contour, 0.9)
    };
  }

  // Fill, light/shade sides, joint creases and nail for one finger
  _fingerDetail(g) {
    const C = this.skin;
    const { cs, r } = g;
    const N = cs.length - 1;
    let s = `<path d="${g.path}" fill="${C.base}"/>`;

    // Light comes from the upper left
    const mid = cs[Math.floor(N / 2)];
    const sgn = (-mid.nx - mid.ny) >= 0 ? 1 : -1;
    const side = off => cs.slice(1, N - 1).map(c => ({
      x: c.x + c.nx * sgn * c.r * off,
      y: c.y + c.ny * sgn * c.r * off
    }));

    s += `<path d="${this._polyline(side(-0.5))}" stroke="${C.shade}" stroke-width="${this._f(r * 0.5)}"
      stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.32"/>`;
    s += `<path d="${this._polyline(side(0.42))}" stroke="${C.light}" stroke-width="${this._f(r * 0.45)}"
      stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.5"/>`;

    // Joint creases
    [[4, 0.85, 0.34], [8, 0.72, 0.28]].forEach(([i, lenF, op]) => {
      const c = cs[i];
      const len = c.r * lenF;
      s += `<line x1="${this._f(c.x + c.nx * len)}" y1="${this._f(c.y + c.ny * len)}"
        x2="${this._f(c.x - c.nx * len)}" y2="${this._f(c.y - c.ny * len)}"
        stroke="${C.line}" stroke-width="1" stroke-opacity="${op}" stroke-linecap="round"/>`;
    });

    // Nail
    const e = cs[N];
    const ang = (Math.atan2(e.ty, e.tx) * 180) / Math.PI;
    const ncx = e.x + e.tx * r * 0.12;
    const ncy = e.y + e.ty * r * 0.12;
    const nrx = r * 0.6, nry = r * (g.f.name === 'thumb' ? 0.55 : 0.48);
    s += `<ellipse cx="${this._f(ncx)}" cy="${this._f(ncy)}" rx="${this._f(nrx)}" ry="${this._f(nry)}"
      transform="rotate(${this._f(ang)} ${this._f(ncx)} ${this._f(ncy)})"
      fill="url(#nailGrad)" stroke="#c89472" stroke-width="0.6" stroke-opacity="0.45"/>`;
    s += `<ellipse cx="${this._f(ncx - e.tx * r * 0.1 - e.nx * r * 0.1)}" cy="${this._f(ncy - e.ty * r * 0.1 - e.ny * r * 0.1)}"
      rx="${this._f(nrx * 0.4)}" ry="${this._f(nry * 0.28)}"
      transform="rotate(${this._f(ang)} ${this._f(ncx)} ${this._f(ncy)})" fill="#fff" opacity="0.4"/>`;
    return s;
  }

  /* ------------------------------------------------------------------ */
  /*  Hand construction                                                  */
  /* ------------------------------------------------------------------ */

  _buildHand(side) {
    const isLeft = side === 'left';
    const s = isLeft ? 1 : -1;               // direction toward the thumb side
    const U = this._U;
    const ids = isLeft ? ['LP', 'LR', 'LM', 'LI'] : ['RP', 'RR', 'RM', 'RI']; // outer -> inner
    const thumbId = isLeft ? 'LT' : 'RT';
    const fs = ids.map(id => this.fingers[id]);

    // Palm drifts slightly with average finger movement
    const cx = fs.reduce((a, f) => a + f.hx, 0) / fs.length;
    let ax = 0, ay = 0;
    fs.forEach(f => { ax += f.x - f.hx; ay += f.y - f.hy; });
    ax /= fs.length; ay /= fs.length;
    const shiftX = ax * 0.35;
    const shiftY = ay * 0.25;

    // Knuckles aligned directly below home row keys (eliminates inward squeeze offset)
    const knuckles = {};
    ids.forEach(id => {
      const f = this.fingers[id];
      let kx = f.hx + shiftX * 0.5 + (f.x - f.hx) * 0.12;
      let ky = f.hy + U * this.dropMap[f.name] + shiftY * 0.5 + (f.y - f.hy) * 0.15;

      let dx = kx - f.x, dy = ky - f.y;
      let d = Math.hypot(dx, dy);
      if (d < 0.001) { dx = 0; dy = 1; d = 1; }
      const maxL = U * this.maxLenMap[f.name];
      const minL = U * 0.9;
      const L = Math.min(maxL, Math.max(minL, d));
      kx = f.x + (dx / d) * L;
      ky = f.y + (dy / d) * L;
      knuckles[id] = { x: kx, y: ky };
    });

    const kP = knuckles[ids[0]];
    const kR = knuckles[ids[1]];
    const kM = knuckles[ids[2]];
    const kI = knuckles[ids[3]];
    const rP = U * this.radiusMap.pinky;
    const rR = U * this.radiusMap.ring;
    const rM = U * this.radiusMap.middle;
    const rI = U * this.radiusMap.index;

    const maxKy = Math.max(kP.y, kR.y, kM.y, kI.y);

    // Wrist sits BELOW and OUTWARD of the knuckles (forearms flare away from centre)
    const wc = { x: cx - s * U * 0.28 + shiftX * 0.5, y: maxKy + U * 3.3 };

    // ---- Thumb joint: inner side of the lower palm, close to the index knuckle ----
    const tf = this.fingers[thumbId];
    let thumbTipY = tf.y;
    if (tf.isTapping) thumbTipY += Math.sin(tf.tapProgress * Math.PI) * U * 0.08;
    const tb = {
      x: kI.x + s * U * 0.25,
      y: kI.y + U * 1.9
    };

    // ---- Palm silhouette: sculpted with interdigital webs and full index knuckle wrap ----
    const palmPts = [
      { x: kP.x - s * rP * 1.15, y: kP.y + rP * 0.3 },          // outer top corner
      { x: kP.x - s * rP * 0.2, y: kP.y - rP * 0.55 },
      { x: (kP.x + kR.x) / 2, y: (kP.y + kR.y) / 2 - rP * 0.28 }, // web pinky-ring
      { x: kR.x, y: kR.y - rR * 0.6 },
      { x: (kR.x + kM.x) / 2, y: (kR.y + kM.y) / 2 - rR * 0.28 }, // web ring-middle
      { x: kM.x, y: kM.y - rM * 0.65 },
      { x: (kM.x + kI.x) / 2, y: (kM.y + kI.y) / 2 - rM * 0.28 }, // web middle-index
      { x: kI.x, y: kI.y - rI * 0.6 },
      { x: kI.x + s * rI * 1.15, y: kI.y - rI * 0.15 },        // wrap around top of index knuckle
      { x: kI.x + s * rI * 1.12, y: kI.y + rI * 0.6 },         // index inner flank (fully encloses finger!)
      { x: kI.x + s * U * 0.52, y: kI.y + U * 1.4 },           // smooth thumb web sweep
      { x: kI.x + s * U * 0.36, y: kI.y + U * 2.2 },           // thenar mound
      { x: kI.x + s * U * 0.1, y: kI.y + U * 3.0 },            // thenar base
      { x: wc.x + s * U * 0.45, y: wc.y },                     // inner wrist
      { x: wc.x - s * U * 0.85, y: wc.y },                     // outer wrist
      { x: kP.x - s * U * 0.45, y: kP.y + U * 1.9 }            // hypothenar edge
    ];
    const palmPath = this._smoothClosed(palmPts, 0.9);

    // ---- Thumb ----
    const thumbGeom = this._fingerGeom(thumbId, tb, { x: tf.x, y: thumbTipY }, side);

    // ---- Fingers (outer -> inner so the index sits on top) ----
    const geoms = ids.map(id => {
      const f = this.fingers[id];
      let tipY = f.y;
      if (f.isTapping) tipY += Math.sin(f.tapProgress * Math.PI) * U * 0.08;
      return this._fingerGeom(id, knuckles[id], { x: f.x, y: tipY }, side);
    });
    const all = [thumbGeom, ...geoms];

    if (this.mode === 'off' || !this.isEnabled) {
      return '';
    }

    // ---- Active / Shift identification ----
    const activeGeoms = all.filter(g => g.id === this.activeFingerId || g.id === this.shiftFingerId);
    const C = this.skin;

    // Compact fingertip halo ring (centered right on target key dish)
    let activeHalo = '';
    activeGeoms.forEach(g => {
      const isShift = g.id === this.shiftFingerId;
      const col = isShift ? '#ec4899' : '#38bdf8';
      const haloR = Math.min(13, this.keyH * 0.32);
      const haloY = g.tip.y; // placed exactly on key center dish
      activeHalo += `
        <circle cx="${this._f(g.tip.x)}" cy="${this._f(haloY)}" r="${this._f(haloR)}"
          fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="1.8" class="overlay-halo-pulse"
          style="transform-box:fill-box;transform-origin:center" opacity="0.95"/>
        <circle cx="${this._f(g.tip.x)}" cy="${this._f(haloY)}" r="3"
          fill="#fff" opacity="0.9"/>
      `;
    });

    // If active-only mode, draw only the active finger(s) on this hand with realistic translucent skin & blue glow
    if (this.mode === 'active') {
      if (activeGeoms.length === 0) return '';

      let actShadow = '';
      let actOutline = '';
      let actFill = '';
      let actHighlights = '';
      activeGeoms.forEach(g => {
        const isShift = g.id === this.shiftFingerId;
        const gradId = isShift ? 'shiftFingerGlow' : 'activeFingerGlow';
        const col = isShift ? '#ec4899' : '#38bdf8';

        actShadow += `<path d="${g.path}" fill="#000"/>`;
        actOutline += `<path d="${g.path}" fill="${C.outline}" stroke="${C.edge}" stroke-width="2.2" stroke-linejoin="round"/>`;
        actFill += this._fingerDetail(g);
        actHighlights += `<path d="${g.path}" fill="url(#${gradId})"/>`;
        actHighlights += `<path d="${g.path}" fill="none" stroke="${col}" stroke-width="2.4" stroke-opacity="0.6" filter="url(#glowBlur)"/>`;
        actHighlights += `<path d="${g.path}" fill="none" stroke="${col}" stroke-width="1.3" stroke-opacity="0.85"/>`;
      });

      return `
        <g class="hand-${side} hand-active-only">
          <g filter="url(#handBlur)" opacity="${this._f(Math.min(0.35, this.opacity * 0.38))}" transform="translate(0 ${this._f(U * 0.08)})">${actShadow}</g>
          <g opacity="${this._f(Math.min(1.0, this.opacity + 0.1))}">
            <g filter="url(#softEdge)">${actOutline}</g>
            ${actFill}
            ${actHighlights}
          </g>
          ${activeHalo}
        </g>`;
    }

    // ---- Mode: FULL (Anatomical hand: unified translucent skin with cohesive blue active finger glow) ----
    // 1. Unified shadow for palm and all fingers
    let handShadow = `<path d="${palmPath}" fill="#000"/>`;
    all.forEach(g => {
      handShadow += `<path d="${g.path}" fill="#000"/>`;
    });

    // 2. Crisp anatomical edge outlines (flanks and fingers only — no stroke across knuckles)
    let handOutline = `<path d="${palmPath}" fill="${C.outline}"/>`;
    // Outer hand flank (outer wrist -> hypothenar -> pinky)
    handOutline += `<path d="${this._smoothOpen([palmPts[14], palmPts[15], palmPts[0]], 0.8)}" fill="none" stroke="${C.edge}" stroke-width="2.2" stroke-linecap="round"/>`;
    // Inner hand flank (index -> thumb web -> thenar -> inner wrist)
    handOutline += `<path d="${this._smoothOpen([palmPts[8], palmPts[9], palmPts[10], palmPts[11], palmPts[12], palmPts[13]], 0.8)}" fill="none" stroke="${C.edge}" stroke-width="2.2" stroke-linecap="round"/>`;
    // Finger side outlines
    all.forEach(g => {
      handOutline += `<path d="${g.openPath}" fill="none" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    });

    // 3. Seamless dorsal skin fill & subtle extensor tendons (blends fingers smoothly into hand)
    let palmFill = `<path d="${palmPath}" fill="url(#dorsalGrad)"/>`;
    // Subtle dorsal extensor tendons extending from knuckles toward wrist
    const tendonKnuckles = [kP, kR, kM, kI];
    tendonKnuckles.forEach(k => {
      palmFill += `<line x1="${this._f(k.x)}" y1="${this._f(k.y - U * 0.1)}"
        x2="${this._f(wc.x + (k.x - wc.x) * 0.35)}" y2="${this._f(wc.y - U * 0.9)}"
        stroke="${C.light}" stroke-width="1.4" stroke-opacity="0.22" stroke-linecap="round"/>`;
      palmFill += `<line x1="${this._f(k.x - s * 1.4)}" y1="${this._f(k.y)}"
        x2="${this._f(wc.x + (k.x - wc.x) * 0.35 - s * 1.4)}" y2="${this._f(wc.y - U * 0.85)}"
        stroke="${C.shade}" stroke-width="1.0" stroke-opacity="0.12" stroke-linecap="round"/>`;
    });

    // 4. Render ALL fingers in the SAME natural translucent skin!
    let fingersFill = '';
    all.forEach(g => {
      fingersFill += this._fingerDetail(g);
      if (g.id === thumbId) {
        fingersFill += `<path d="${g.path}" fill="none" stroke="${C.line}" stroke-width="1.2"
          stroke-opacity="0.35" stroke-linejoin="round"/>`;
      }
    });

    // 5. Active finger blue tint & luminous edge glow (SAME skin, illuminated like part of the hand)
    let activeHighlights = '';
    activeGeoms.forEach(g => {
      const isShift = g.id === this.shiftFingerId;
      const gradId = isShift ? 'shiftFingerGlow' : 'activeFingerGlow';
      const col = isShift ? '#ec4899' : '#38bdf8';

      // Translucent cyan/blue wash overlay
      activeHighlights += `<path d="${g.path}" fill="url(#${gradId})"/>`;
      // Luminous blue outer blur (open contour: sides and tip only, dives smoothly into palm)
      activeHighlights += `<path d="${g.openPath}" fill="none" stroke="${col}" stroke-width="2.5" stroke-opacity="0.6" filter="url(#glowBlur)" stroke-linecap="round"/>`;
      // Crisp neon accent rim (open contour: sides and tip only)
      activeHighlights += `<path d="${g.openPath}" fill="none" stroke="${col}" stroke-width="1.4" stroke-opacity="0.85" stroke-linecap="round"/>`;
    });

    // The whole hand renders as ONE cohesive entity with user-selected transparency.
    // Fingers are drawn first, then palm fill covers knuckle transitions seamlessly.
    return `
      <g class="hand-${side}">
        <!-- Soft realistic contact shadow -->
        <g filter="url(#handBlur)" opacity="${this._f(Math.min(0.35, this.opacity * 0.38))}" transform="translate(0 ${this._f(U * 0.08)})">${handShadow}</g>
        <!-- Unified hand geometry (same skin, realistic edge line, illuminated active finger) -->
        <g opacity="${this._f(this.opacity)}">
          <g filter="url(#softEdge)">${handOutline}</g>
          ${fingersFill}
          ${palmFill}
          ${activeHighlights}
        </g>
        <!-- Fingertip halo ring -->
        ${activeHalo}
      </g>`;
  }

  _draw() {
    if (!this.handsLayer || !this.boardWidth) return;
    this.handsLayer.innerHTML = this._buildHand('left') + this._buildHand('right');
  }
}