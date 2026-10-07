/**
 * 3D Rigged Hand Overlay for KeyVibe Touch Typing Studio
 *
 * Dynamically scales and positions anatomical 3D hands according to
 * the exact physical on-screen keyboard dimensions.
 * Modularized into Hand3DScene, Hand3DKinematics, and Hand3DConfig.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HAND_CONFIG } from './hand3dConfig.js?v=2.6';
import { Hand3DScene } from './hand3dScene.js?v=2.6';
import { Hand3DKinematics } from './hand3dKinematics.js?v=2.6';
import { getKeyCalibration, getGlobalHandCalibration, getFingerPostureCalibration } from './fingerCalibration.js';

export class Hand3DOverlay {
  constructor(keyboardContainerId) {
    this.keyboardContainerId = keyboardContainerId;
    this.keyboardContainer = document.getElementById(keyboardContainerId);
    this.board = null;
    this.canvas = null;

    // Subsystem Controllers
    this.sceneCtrl = null;
    this.kinematics = new Hand3DKinematics();

    // Model nodes & meshes
    this.nodeLeft = null;
    this.nodeRight = null;
    this.meshL = null;
    this.meshR = null;

    // Animation & State
    this.animFrame = null;
    this.isLoaded = false;
    this.isEnabled = true;
    this.opacity = HAND_CONFIG.MATERIAL.DEFAULT_OPACITY;
    this.scaleMultiplier = 1.0;

    // Active targeting & positioning anchors
    this.targetKeyId = null;
    this.activeFingerId = null;
    this.shiftFingerId = null;
    this.baseHomePositions = null;
    this.keyWidth3D = 3.5;

    this.resizeObserver = null;
    this.keyOffsets = {};
    this.globalHandTransform = getGlobalHandCalibration();
    this.fingerPosture = getFingerPostureCalibration();

    this._loadSettings();
  }

  _loadSettings() {
    try {
      const savedOp = localStorage.getItem('keyvibe_3d_opacity');
      if (savedOp !== null) {
        this.opacity = parseFloat(savedOp);
      }
      const savedScale = localStorage.getItem('keyvibe_3d_thickness');
      if (savedScale !== null) {
        this.scaleMultiplier = parseFloat(savedScale);
      }
      
      const savedOffsets = localStorage.getItem('keyvibe_finger_offsets');
      if (savedOffsets) {
        this.keyOffsets = JSON.parse(savedOffsets);
      }

      const savedGlobal = localStorage.getItem('keyvibe_hand_global_calibration');
      if (savedGlobal) {
        const parsed = JSON.parse(savedGlobal);
        if (parsed && Math.abs(parsed.posZ || 0) < 15 && Math.abs(parsed.spacing || 0) < 15) {
          this.globalHandTransform = { ...this.globalHandTransform, ...parsed };
          if (parsed.scale && parsed.scale <= 2.5) this.scaleMultiplier = parsed.scale;
        }
      }

      const savedPosture = localStorage.getItem('keyvibe_finger_posture');
      if (savedPosture) {
        const parsedP = JSON.parse(savedPosture);
        this.fingerPosture = { ...this.fingerPosture, ...parsedP };
      }
    } catch (_) {}
  }

  applyFingerPosture(posture) {
    if (!posture) return;
    this.fingerPosture = { ...this.fingerPosture, ...posture };
    try {
      localStorage.setItem('keyvibe_finger_posture', JSON.stringify(this.fingerPosture));
    } catch (_) {}
    if (this.kinematics) {
      this.kinematics.setFingerPosture(this.fingerPosture);
    }
  }

  applyGlobalHandTransform(transform) {

    if (!transform) return;
    this.globalHandTransform = { ...this.globalHandTransform, ...transform };
    if (transform.scale !== undefined) {
      this.scaleMultiplier = transform.scale;
    }
    try {
      localStorage.setItem('keyvibe_hand_global_calibration', JSON.stringify(this.globalHandTransform));
    } catch (_) {}
    this._applyHandRotations();
    this.updatePositions();
  }

  _applyHandRotations() {
    if (!this.sceneCtrl || !this.sceneCtrl.leftArmGroup || !this.sceneCtrl.rightArmGroup) return;
    const yawDeg = this.globalHandTransform.yaw !== undefined ? this.globalHandTransform.yaw : HAND_CONFIG.POSTURE.INWARD_YAW_DEG;
    const pitchDeg = this.globalHandTransform.pitch !== undefined ? this.globalHandTransform.pitch : HAND_CONFIG.POSTURE.PITCH_DEG;
    const rollDeg = this.globalHandTransform.roll || 0.0;

    const yawRad = THREE.MathUtils.degToRad(yawDeg);
    const pitchRad = THREE.MathUtils.degToRad(pitchDeg);
    const rollRad = THREE.MathUtils.degToRad(rollDeg);

    this.sceneCtrl.leftArmGroup.rotation.order = 'YXZ';
    this.sceneCtrl.leftArmGroup.rotation.y = Math.PI - yawRad;
    this.sceneCtrl.leftArmGroup.rotation.x = pitchRad;
    this.sceneCtrl.leftArmGroup.rotation.z = Math.PI + rollRad;

    this.sceneCtrl.rightArmGroup.rotation.order = 'YXZ';
    this.sceneCtrl.rightArmGroup.rotation.y = Math.PI + yawRad;
    this.sceneCtrl.rightArmGroup.rotation.x = pitchRad;
    this.sceneCtrl.rightArmGroup.rotation.z = Math.PI - rollRad;
  }

  setKeyOffset(keyId, offsetX, offsetZ) {
    this.keyOffsets[keyId] = { x: offsetX, z: offsetZ };
    try {
      localStorage.setItem('keyvibe_finger_offsets', JSON.stringify(this.keyOffsets));
    } catch (_) {}
  }
  
  getKeyOffset(keyId) {
    if (this.keyOffsets && this.keyOffsets[keyId]) {
      return this.keyOffsets[keyId];
    }
    const calib = getKeyCalibration(keyId);
    return { x: calib.offsetX || 0, z: calib.offsetZ || 0, y: calib.offsetY || 0 };
  }

  init() {
    if (!this.keyboardContainer) return;
    this.board = this.keyboardContainer.querySelector('.keyboard-board');
    if (!this.board) {
      setTimeout(() => this.init(), 60);
      return;
    }

    this.board.style.position = 'relative';

    // Remove old canvas if exists
    const existing = this.board.querySelector('#keyboard-3d-overlay');
    if (existing) existing.remove();

    // Create and attach 3D canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'keyboard-3d-overlay';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '15';
    this.canvas.style.overflow = 'visible';
    this.canvas.style.transition = 'opacity 0.25s ease';
    this.canvas.style.opacity = this.isEnabled ? String(this.opacity) : '0';
    this.board.appendChild(this.canvas);

    // Initialize 3D scene & camera controller
    this.sceneCtrl = new Hand3DScene(this.canvas);

    // Load rigged hands model
    this._loadHandsModel();

    // Watch for size changes on the keyboard board
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.updatePositions());
      this.resizeObserver.observe(this.board);
    }
    window.addEventListener('resize', () => this.updatePositions());

    this._startRenderLoop();
  }

  _loadHandsModel() {
    const loader = new GLTFLoader();

    // Premium PBR Skin Material with realistic translucency & soft sheen
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: HAND_CONFIG.MATERIAL.COLOR,
      roughness: HAND_CONFIG.MATERIAL.ROUGHNESS,
      metalness: HAND_CONFIG.MATERIAL.METALNESS,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: this.opacity,
    });

    loader.load(
      HAND_CONFIG.GEOMETRY.MODEL_URL,
      (gltf) => {
        const root = gltf.scene;

        // Extract skinned meshes and apply custom skin material
        root.traverse((child) => {
          if (child.isSkinnedMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = skinMaterial.clone();

            if (child.name && child.name.includes('R')) {
              this.meshR = child;
            } else {
              this.meshL = child;
            }
          }
        });

        this.nodeLeft = root.getObjectByName('Hand_Left');
        this.nodeRight = root.getObjectByName('Hand_Right');

        if (!this.nodeLeft || !this.nodeRight) {
          console.error('Hand3DOverlay: Hand nodes missing in GLB model');
          return;
        }

        // Center each hand at its home-row resting knuckle/fingertip pivot (0, 0, 0)
        // Eliminates model-space origin translation offsets
        this.nodeLeft.position.sub(HAND_CONFIG.GEOMETRY.LEFT_HAND_CENTER);
        this.nodeRight.position.sub(HAND_CONFIG.GEOMETRY.RIGHT_HAND_CENTER);

        // Mount each hand inside its dedicated positioning anchor group
        this.sceneCtrl.leftArmGroup.add(this.nodeLeft);
        this.sceneCtrl.rightArmGroup.add(this.nodeRight);

        // Orient hands: Typing Posture
        // - Roll (Z) = 180° pronates forearms so palms face DOWN onto keys and knuckles face UP
        // - Yaw (Y) = 180° points fingertips away into the keyboard (-Z), wrists extend towards user (+Z)
        // - Inward Yaw (±8°) creates natural ergonomic arm angle from elbows on desk
        // - Pitch (X) (-4°) elevates knuckles slightly with natural keycap clearance
        const yawRad = THREE.MathUtils.degToRad(HAND_CONFIG.POSTURE.INWARD_YAW_DEG);
        const pitchRad = THREE.MathUtils.degToRad(HAND_CONFIG.POSTURE.PITCH_DEG);

        this.sceneCtrl.leftArmGroup.rotation.order = 'YXZ';
        this.sceneCtrl.leftArmGroup.rotation.y = Math.PI - yawRad;
        this.sceneCtrl.leftArmGroup.rotation.x = pitchRad;
        this.sceneCtrl.leftArmGroup.rotation.z = Math.PI;

        this.sceneCtrl.rightArmGroup.rotation.order = 'YXZ';
        this.sceneCtrl.rightArmGroup.rotation.y = Math.PI + yawRad;
        this.sceneCtrl.rightArmGroup.rotation.x = pitchRad;
        this.sceneCtrl.rightArmGroup.rotation.z = Math.PI;

        // Initialize skeletal bone kinematics & resting curls
        this.kinematics.bindSkeletons(this.meshL, this.meshR);
        this.kinematics.setFingerPosture(this.fingerPosture);

        this.isLoaded = true;
        this.updatePositions();
      },
      undefined,
      (err) => {
        console.error('Hand3DOverlay: Error loading 3D hands model:', err);
      }
    );
  }

  /**
   * Dynamically project on-screen keyboard keys to 3D world space
   * and scale/position both hands according to current keyboard dimensions.
   */
  updatePositions() {
    if (!this.board || !this.sceneCtrl || !this.isLoaded) return;

    const boardRect = this.board.getBoundingClientRect();
    if (boardRect.width === 0 || boardRect.height === 0) return;

    // Resize viewport & camera projection
    this.sceneCtrl.resize(boardRect.width, boardRect.height);

    // Retrieve home-row reference keys from DOM
    const keyA = this.board.querySelector('[data-code="KeyA"]');
    const keyF = this.board.querySelector('[data-code="KeyF"]');
    const keyJ = this.board.querySelector('[data-code="KeyJ"]');
    const keySemi = this.board.querySelector('[data-code="Semicolon"]');
    const keyD = this.board.querySelector('[data-code="KeyD"]');
    const keyK = this.board.querySelector('[data-code="KeyK"]');

    // Raycast key centers onto the 3D keyboard plane (Y = 0)
    let posA = this.sceneCtrl.projectElementTo3D(keyA, boardRect);
    let posF = this.sceneCtrl.projectElementTo3D(keyF, boardRect);
    let posJ = this.sceneCtrl.projectElementTo3D(keyJ, boardRect);
    let posSemi = this.sceneCtrl.projectElementTo3D(keySemi, boardRect);
    let posD = this.sceneCtrl.projectElementTo3D(keyD, boardRect);
    let posK = this.sceneCtrl.projectElementTo3D(keyK, boardRect);

    // Fallback: If DOM keys are temporarily unrendered or zero-sized,
    // project standard ANSI keyboard proportions
    if (!posA || !posF || !posJ || !posSemi) {
      const { HOME_ROW_Y_RATIO, KEY_A_X_RATIO, KEY_F_X_RATIO, KEY_J_X_RATIO, KEY_SEMI_X_RATIO } =
        HAND_CONFIG.FALLBACK_PROPORTIONS;
      posA = posA || this.sceneCtrl.projectNormalizedPoint(KEY_A_X_RATIO, HOME_ROW_Y_RATIO);
      posF = posF || this.sceneCtrl.projectNormalizedPoint(KEY_F_X_RATIO, HOME_ROW_Y_RATIO);
      posJ = posJ || this.sceneCtrl.projectNormalizedPoint(KEY_J_X_RATIO, HOME_ROW_Y_RATIO);
      posSemi = posSemi || this.sceneCtrl.projectNormalizedPoint(KEY_SEMI_X_RATIO, HOME_ROW_Y_RATIO);
      posD = posD || this.sceneCtrl.projectNormalizedPoint((KEY_A_X_RATIO + KEY_F_X_RATIO) * 0.5, HOME_ROW_Y_RATIO);
      posK = posK || this.sceneCtrl.projectNormalizedPoint((KEY_J_X_RATIO + KEY_SEMI_X_RATIO) * 0.5, HOME_ROW_Y_RATIO);
    }

    if (!posA || !posF || !posJ || !posSemi || !posD || !posK) return;

    // Calculate key pitch width (1 key unit in 3D world coordinates)
    // Left: Pinky (A) -> Index (F) is 3 key pitches
    // Right: Index (J) -> Pinky (;) is 3 key pitches
    const spanLeft = Math.abs(posF.x - posA.x);
    const spanRight = Math.abs(posSemi.x - posJ.x);
    const keyWidth3D = Math.max(spanLeft, spanRight) / 3.0;

    // Retrieve calibrated micro-offsets for home row anchoring keys
    const offsetA = this.getKeyOffset('KeyA');
    const offsetJ = this.getKeyOffset('KeyJ');

    // Scale factor so calibrated offsets remain visually identical across keyboard dimensions
    const offsetScale = keyWidth3D / 3.5;

    // Dynamic Scale:
    // In model units, resting 4-finger span from pinky to index is ~0.240.
    // Scaling by (3 * keyWidth3D / 0.240) ensures the 4 fingers span the 4 home keys (3 key units)
    // precisely across all screen sizes and keyboard dimensions.
    const HAND_SPAN_MODEL_UNITS = 0.240;
    const baseScale = (keyWidth3D * 3.0) / HAND_SPAN_MODEL_UNITS;
    const userScaleMult = (this.globalHandTransform.scale || this.scaleMultiplier || 1.0);
    const finalScale = baseScale * userScaleMult;

    this.sceneCtrl.leftArmGroup.scale.set(finalScale, finalScale, finalScale);
    this.sceneCtrl.rightArmGroup.scale.set(finalScale, finalScale, finalScale);

    // Apply hand angles & rotations
    this._applyHandRotations();

    // Symmetrical positioning with global offsets and spacing
    const spacing = (this.globalHandTransform.spacing !== undefined ? this.globalHandTransform.spacing : 0.0) * offsetScale;
    const posX = (this.globalHandTransform.posX || 0.0) * offsetScale;
    const posY = (this.globalHandTransform.posY !== undefined ? this.globalHandTransform.posY : HAND_CONFIG.POSTURE.DESK_HEIGHT_OFFSET) * offsetScale;
    const posZ = (this.globalHandTransform.posZ !== undefined ? this.globalHandTransform.posZ : HAND_CONFIG.POSTURE.HOME_ROW_Z_OFFSET) * offsetScale;

    // Local fingertip offsets in armGroup coordinate space (at finalScale)
    // In left armGroup space: LP is at x = -0.125, z = 0.007
    // In right armGroup space: RI is at x = -0.116, z = 0.037
    const localLP_X = -0.125 * finalScale;
    const localLP_Z = 0.007 * finalScale;
    const localRI_X = -0.116 * finalScale;
    const localRI_Z = 0.037 * finalScale;

    // Left hand anchored so L Pinky rests directly on KeyA (matching KeyA calibrated offset)
    const targetA_X = posA.x + (offsetA.x || 0) * offsetScale;
    const targetA_Z = posA.z + (offsetA.z || 0) * offsetScale;
    const leftHomeX = targetA_X - localLP_X + spacing + posX;
    const leftHomeZ = targetA_Z - localLP_Z + posZ;

    // Right hand anchored so R Index rests directly on KeyJ (matching KeyJ calibrated offset)
    const targetJ_X = posJ.x + (offsetJ.x || 0) * offsetScale;
    const targetJ_Z = posJ.z + (offsetJ.z || 0) * offsetScale;
    const rightHomeX = targetJ_X - localRI_X - spacing + posX;
    const rightHomeZ = targetJ_Z - localRI_Z + posZ;

    this.baseHomePositions = {
      left: new THREE.Vector3(leftHomeX, posY, leftHomeZ),
      right: new THREE.Vector3(rightHomeX, posY, rightHomeZ),
    };
    this.keyWidth3D = keyWidth3D;

    this.sceneCtrl.leftArmGroup.position.copy(this.baseHomePositions.left);
    this.sceneCtrl.rightArmGroup.position.copy(this.baseHomePositions.right);

    // Re-evaluate target reach with updated geometry
    if (this.targetKeyId && this.activeFingerId) {
      this.setTarget(this.targetKeyId, this.activeFingerId, this.shiftFingerId);
    }
  }

  /**
   * Trigger physical mechanical keycap tap animation on finger
   * @param {string} fingerId - e.g. 'LI', 'RI', 'LT', 'RP'
   */
  animateTap(fingerId) {
    if (!this.isLoaded) return;
    this.kinematics.startTap(fingerId);
  }

  /**
   * Set target key and active finger with realistic biomechanical reach
   */
  setTarget(targetKeyId, fingerId, shiftFingerId) {
    this.targetKeyId = targetKeyId;
    this.activeFingerId = fingerId;
    this.shiftFingerId = shiftFingerId;

    if (!this.isLoaded) return;

    let reachInfo = null;
    if (fingerId && targetKeyId && this.board) {
      const homeCode = HAND_CONFIG.HOME_KEYS[fingerId] || 'KeyF';
      const homeEl = this.board.querySelector(`[data-code="${homeCode}"]`);
      const targetEl = this.board.querySelector(`[data-code="${targetKeyId}"]`);

      if (homeEl && targetEl) {
        const boardRect = this.board.getBoundingClientRect();
        const homeRect = homeEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const keyPitchW = Math.max(1, homeRect.width);
        const keyPitchH = Math.max(1, homeRect.height);

        // Compute physical on-screen delta in columns and rows
        const dCol = ((targetRect.left + targetRect.right) * 0.5 - (homeRect.left + homeRect.right) * 0.5) / keyPitchW;
        const dRow = ((targetRect.top + targetRect.bottom) * 0.5 - (homeRect.top + homeRect.bottom) * 0.5) / keyPitchH;

        let deltaX = dCol * (this.keyWidth3D || 3.5);
        let deltaZ = dRow * (this.keyWidth3D || 3.5);
        const pHome = this.sceneCtrl.projectElementTo3D(homeEl, boardRect);
        const pTarget = this.sceneCtrl.projectElementTo3D(targetEl, boardRect);
        if (pHome && pTarget) {
          deltaX = pTarget.x - pHome.x;
          deltaZ = pTarget.z - pHome.z;
        }

        // Apply custom manual calibration offset for this specific key
        // scaled proportionally so offsets maintain identical keycap fraction on any keyboard size
        const customOffset = this.getKeyOffset(targetKeyId);
        const offsetScale = (this.keyWidth3D || 3.5) / 3.5;
        deltaX += (customOffset.x || 0) * offsetScale;
        deltaZ += (customOffset.z || 0) * offsetScale;

        reachInfo = {
          deltaX,
          deltaZ,
          dCol,
          dRow,
          keyWidth3D: this.keyWidth3D || 3.5,
          offsetY: (customOffset.y || 0) * offsetScale,
        };
      }
    }

    this.kinematics.setTarget(targetKeyId, fingerId, shiftFingerId, reachInfo);
  }

  /**
   * Set skin opacity [0.1 .. 1.0]
   */
  setOpacity(val) {
    this.opacity = Math.max(
      HAND_CONFIG.MATERIAL.MIN_OPACITY,
      Math.min(HAND_CONFIG.MATERIAL.MAX_OPACITY, val)
    );

    if (this.canvas) {
      this.canvas.style.opacity = this.isEnabled ? String(this.opacity) : '0';
    }
    if (this.meshL && this.meshL.material) this.meshL.material.opacity = this.opacity;
    if (this.meshR && this.meshR.material) this.meshR.material.opacity = this.opacity;

    try {
      localStorage.setItem('keyvibe_3d_opacity', this.opacity.toFixed(2));
    } catch (_) {}
  }

  /**
   * Adjust thickness / scale multiplier [0.6 .. 1.6]
   */
  setThickness(val) {
    this.scaleMultiplier = Math.max(
      HAND_CONFIG.POSTURE.MIN_SCALE_MULTIPLIER,
      Math.min(HAND_CONFIG.POSTURE.MAX_SCALE_MULTIPLIER, val)
    );

    try {
      localStorage.setItem('keyvibe_3d_thickness', this.scaleMultiplier.toFixed(2));
    } catch (_) {}

    this.updatePositions();
  }

  /**
   * Toggle 3D hand overlay visibility
   */
  toggleOverlay() {
    this.isEnabled = !this.isEnabled;
    if (this.canvas) {
      this.canvas.style.opacity = this.isEnabled ? String(this.opacity) : '0';
    }
    return this.isEnabled;
  }

  _startRenderLoop() {
    const loop = () => {
      this.animFrame = requestAnimationFrame(loop);

      if (!this.isEnabled || !this.isLoaded) return;

      // Update kinematic joint strokes, reaches, and organic hand glide
      this.kinematics.update(
        this.sceneCtrl.leftArmGroup,
        this.sceneCtrl.rightArmGroup,
        this.baseHomePositions
      );

      // Render 3D scene
      this.sceneCtrl.render();
    };

    loop();
  }

  destroy() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.sceneCtrl) {
      this.sceneCtrl.dispose();
      this.sceneCtrl = null;
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
  }
}
