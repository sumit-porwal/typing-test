/**
 * 3D Hand Kinematics & Biomechanical Motion Controller
 * KeyVibe Touch Typing Studio
 *
 * Implements realistic touch typing articulation:
 * - Specific finger home-row resting posture on KeyA, KeyS, KeyD, KeyF, KeyJ, KeyK, KeyL, Semicolon, Space
 * - Natural reaching kinematics (MCP joint extension/flexion & lateral abduction/adduction)
 * - Organic whole-hand glide & subtle wrist pivot toward reaching targets
 * - Mechanical switch keystroke plunge with realistic tactile bottom-out & crisp spring rebound
 */

import { HAND_CONFIG } from './hand3dConfig.js?v=2.6';
import { getFingerPostureCalibration } from './fingerCalibration.js';

export class Hand3DKinematics {
  constructor() {
    this.chains = {};
    this.baseJoints = {};
    this.initialRotations = new Map();

    // Active targeting & reach state
    this.activeFingerId = null;
    this.targetKeyId = null;
    this.shiftFingerId = null;

    // Per-finger reach offsets { curl: number, yaw: number }
    this.fingerReach = {};
    this.currentFingerReach = {};

    // Whole-hand glide offsets { left: { x, z, yaw, dip }, right: { x, z, yaw, dip } }
    this.handGlide = {
      L: { x: 0, z: 0, yaw: 0, dip: 0 },
      R: { x: 0, z: 0, yaw: 0, dip: 0 },
    };
    this.targetHandGlide = {
      L: { x: 0, z: 0, yaw: 0, dip: 0 },
      R: { x: 0, z: 0, yaw: 0, dip: 0 },
    };

    // Active keystroke strike animations: fingerId -> { progress, speed }
    this.activeTaps = new Map();

    // Finger posture config: resting curls, stretch, and lateral splay
    this.posture = getFingerPostureCalibration();

    this._initFingerReachStates();
  }

  setFingerPosture(posture) {
    if (!posture) return;
    this.posture = { ...this.posture, ...posture };
  }


  _initFingerReachStates() {
    const fingerIds = ['LI', 'LM', 'LR', 'LP', 'LT', 'RI', 'RM', 'RR', 'RP', 'RT'];
    fingerIds.forEach((fId) => {
      this.fingerReach[fId] = { curl: 0, yaw: 0 };
      this.currentFingerReach[fId] = { curl: 0, yaw: 0 };
    });
  }

  /**
   * Bind skeletal meshes and record default bind-pose bone orientations
   * @param {THREE.SkinnedMesh} meshL - Left Hand SkinnedMesh
   * @param {THREE.SkinnedMesh} meshR - Right Hand SkinnedMesh
   */
  bindSkeletons(meshL, meshR) {
    const bL = meshL ? meshL.skeleton.bones : [];
    const bR = meshR ? meshR.skeleton.bones : [];

    [...bL, ...bR].forEach((bone) => {
      if (bone && !this.initialRotations.has(bone)) {
        this.initialRotations.set(bone, {
          x: bone.rotation.x,
          y: bone.rotation.y,
          z: bone.rotation.z,
        });
      }
    });

    const getChain = (bones, indices) => indices.map((idx) => bones[idx]).filter(Boolean);

    this.chains = {
      LI: getChain(bL, HAND_CONFIG.BONE_CHAINS.LI),
      LM: getChain(bL, HAND_CONFIG.BONE_CHAINS.LM),
      LR: getChain(bL, HAND_CONFIG.BONE_CHAINS.LR),
      LP: getChain(bL, HAND_CONFIG.BONE_CHAINS.LP),
      LT: getChain(bL, HAND_CONFIG.BONE_CHAINS.LT),

      RI: getChain(bR, HAND_CONFIG.BONE_CHAINS.RI),
      RM: getChain(bR, HAND_CONFIG.BONE_CHAINS.RM),
      RR: getChain(bR, HAND_CONFIG.BONE_CHAINS.RR),
      RP: getChain(bR, HAND_CONFIG.BONE_CHAINS.RP),
      RT: getChain(bR, HAND_CONFIG.BONE_CHAINS.RT),
    };

    this.baseJoints = {
      LI: bL[HAND_CONFIG.BASE_JOINTS.LI],
      LM: bL[HAND_CONFIG.BASE_JOINTS.LM],
      LR: bL[HAND_CONFIG.BASE_JOINTS.LR],
      LP: bL[HAND_CONFIG.BASE_JOINTS.LP],
      LT: bL[HAND_CONFIG.BASE_JOINTS.LT],

      RI: bR[HAND_CONFIG.BASE_JOINTS.RI],
      RM: bR[HAND_CONFIG.BASE_JOINTS.RM],
      RR: bR[HAND_CONFIG.BASE_JOINTS.RR],
      RP: bR[HAND_CONFIG.BASE_JOINTS.RP],
      RT: bR[HAND_CONFIG.BASE_JOINTS.RT],
    };

    this.applyRestPose();
  }

  /**
   * Set active target key reach displacement
   * @param {string|null} targetKeyId
   * @param {string|null} fingerId - e.g. 'LI', 'LM', 'RI'
   * @param {string|null} shiftFingerId - e.g. 'RP', 'LP'
   * @param {object} reachInfo - { deltaX: number, deltaZ: number, dCol: number, dRow: number, keyWidth3D: number }
   */
  setTarget(targetKeyId, fingerId, shiftFingerId, reachInfo = null) {
    this.targetKeyId = targetKeyId;
    this.activeFingerId = fingerId;
    this.shiftFingerId = shiftFingerId;

    // Reset all target reaches to resting state (0)
    Object.keys(this.fingerReach).forEach((fId) => {
      this.fingerReach[fId].curl = 0;
      this.fingerReach[fId].yaw = 0;
    });

    this.targetHandGlide.L = { x: 0, z: 0, yaw: 0, dip: 0 };
    this.targetHandGlide.R = { x: 0, z: 0, yaw: 0, dip: 0 };

    if (!fingerId || !reachInfo) return;

    const { deltaX = 0, deltaZ = 0, keyWidth3D = 3.5 } = reachInfo;
    const handSide = fingerId[0]; // 'L' or 'R'

    // ── 1. Whole-Hand Organic Glide Coordination ──
    // A real typist's hand glides partially toward the target key
    const glideX = deltaX * 0.25;
    const glideZ = deltaZ * 0.15;
    const glideYaw = (handSide === 'L' ? -1 : 1) * (deltaX / keyWidth3D) * 0.035;

    this.targetHandGlide[handSide] = {
      x: glideX,
      z: glideZ,
      yaw: glideYaw,
      dip: 0,
    };

    // ── 2. Active Finger Precise Reach Kinematics ──
    // Finger extension/flexion covers the remaining distance to position directly over keycap:
    const reachStretchMult = this.posture?.reachStretch ?? 1.0;
    const reachCurl = (deltaZ / keyWidth3D) * 0.26 * reachStretchMult;

    // Lateral reach (MCP knuckle yaw):
    // In Left Hand: deltaX > 0 (inward to G/T/B) -> negative yaw
    // In Right Hand: deltaX < 0 (inward to H/Y/N) -> positive yaw
    const reachYaw = -(deltaX / keyWidth3D) * 0.20;

    this.fingerReach[fingerId] = {
      curl: reachCurl,
      yaw: reachYaw,
    };

    // ── 3. Shift Finger Reach (if capital / symbol) ──
    if (shiftFingerId && this.fingerReach[shiftFingerId]) {
      const shiftSide = shiftFingerId[0];
      const shiftGlideX = keyWidth3D * 0.8;
      this.fingerReach[shiftFingerId] = { curl: 0.15, yaw: shiftSide === 'L' ? -0.25 : 0.25 };
      this.targetHandGlide[shiftSide] = {
        x: shiftSide === 'L' ? -shiftGlideX : shiftGlideX,
        z: keyWidth3D * 0.35,
        yaw: 0,
        dip: 0,
      };
    }
  }

  /**
   * Start physical mechanical switch keystroke tap animation
   * @param {string} fingerId - e.g. 'LI', 'RI', 'LT', 'RP'
   */
  startTap(fingerId) {
    if (!this.chains[fingerId]) return;
    this.activeTaps.set(fingerId, {
      progress: 0,
      speed: HAND_CONFIG.ANIMATION.TAP_SPEED,
    });

    // Subtly dip the corresponding hand anchor on key strike bottom-out
    const side = fingerId[0];
    if (this.targetHandGlide[side]) {
      this.targetHandGlide[side].dip = -0.06;
    }
  }

  /**
   * Update joint kinematics, smooth interpolation, and hand positioning
   * @param {THREE.Group} leftArmGroup
   * @param {THREE.Group} rightArmGroup
   * @param {object} baseHomePositions - { left: THREE.Vector3, right: THREE.Vector3 }
   */
  update(leftArmGroup, rightArmGroup, baseHomePositions) {
    const LERP_FACTOR = 0.22;

    // Smoothly interpolate hand glide
    ['L', 'R'].forEach((side) => {
      const cur = this.handGlide[side];
      const target = this.targetHandGlide[side];
      cur.x += (target.x - cur.x) * LERP_FACTOR;
      cur.z += (target.z - cur.z) * LERP_FACTOR;
      cur.yaw += (target.yaw - cur.yaw) * LERP_FACTOR;
      cur.dip += (target.dip - cur.dip) * 0.35; // Fast dip and rebound
      target.dip *= 0.6; // Auto-decay dip back to 0
    });

    // Apply coordinated hand glide & micro-reaction to arm groups
    if (leftArmGroup && baseHomePositions?.left) {
      const homeL = baseHomePositions.left;
      leftArmGroup.position.x = homeL.x + this.handGlide.L.x;
      leftArmGroup.position.y = homeL.y + this.handGlide.L.dip;
      leftArmGroup.position.z = homeL.z + this.handGlide.L.z;
    }
    if (rightArmGroup && baseHomePositions?.right) {
      const homeR = baseHomePositions.right;
      rightArmGroup.position.x = homeR.x + this.handGlide.R.x;
      rightArmGroup.position.y = homeR.y + this.handGlide.R.dip;
      rightArmGroup.position.z = homeR.z + this.handGlide.R.z;
    }

    // ── Update Finger Joints ──
    Object.keys(this.chains).forEach((fId) => {
      const chain = this.chains[fId];
      if (!chain || chain.length === 0) return;

      const type = fId[1]; // 'I', 'M', 'R', 'P', 'T'
      const { restCurl, restSplay } = this._getFingerRestParams(fId);

      // Smoothly interpolate reaching state
      const curReach = this.currentFingerReach[fId];
      const targetReach = this.fingerReach[fId];
      curReach.curl += (targetReach.curl - curReach.curl) * LERP_FACTOR;
      curReach.yaw += (targetReach.yaw - curReach.yaw) * LERP_FACTOR;

      // Physical Keystroke Tap strike curve (sinusoidal pulse with crisp bottom-out)
      let strikeOffset = 0;
      const tap = this.activeTaps.get(fId);
      if (tap) {
        tap.progress += tap.speed;
        const strokeFactor = Math.sin(Math.min(1.0, tap.progress) * Math.PI);
        strikeOffset = strokeFactor * HAND_CONFIG.ANIMATION.STRIKE_MAGNITUDE;

        if (tap.progress >= 1.0) {
          this.activeTaps.delete(fId);
        }
      }

      // Total flexion = restPose + reachUnfurl + keystrokeStrike
      const totalCurl = restCurl + curReach.curl + strikeOffset;

      // Index finger armature alignment compensation:
      // Neutralizes the GLB armature's inward 19.1° metacarpal twist so the index finger curls
      // strictly straight and parallel with the hand, eliminating unnatural sideways curve and hook.
      const sideSign = fId.startsWith('L') ? -1 : 1;
      const indexAlignComp = (type === 'I') ? (0.52 * totalCurl * sideSign) : 0;

      // Apply curl across phalanges [MCP, PIP, DIP]
      chain.forEach((bone, idx) => {
        const init = this.initialRotations.get(bone);
        if (!init) return;

        let weight = HAND_CONFIG.ANIMATION.PROXIMAL_WEIGHT;
        if (idx === 1) weight = HAND_CONFIG.ANIMATION.INTERMEDIATE_WEIGHT;
        else if (idx === 2) weight = HAND_CONFIG.ANIMATION.DISTAL_WEIGHT;

        bone.rotation.x = init.x - totalCurl * weight;

        // Apply knuckle lateral yaw & resting splay + index alignment compensation
        if (idx === 0) {
          bone.rotation.z = init.z + restSplay + (curReach.yaw || 0) + (indexAlignComp * 0.45);
        } else if (idx === 1) {
          bone.rotation.z = init.z + (indexAlignComp * 0.35);
        } else if (idx === 2) {
          bone.rotation.z = init.z + (indexAlignComp * 0.20);
        }
      });

      // Thumb opposition motion around local Z on metacarpal base
      if (type === 'T' && this.baseJoints[fId]) {
        const base = this.baseJoints[fId];
        const initB = this.initialRotations.get(base);
        if (initB) {
          const sideSignT = fId.startsWith('L') ? 1 : -1;
          base.rotation.z = initB.z - sideSignT * (strikeOffset * HAND_CONFIG.ANIMATION.THUMB_OPPOSITION_MAGNITUDE);
        }
      }
    });
  }

  _getFingerRestParams(fId) {
    const type = fId[1]; // 'I', 'M', 'R', 'P', 'T'
    const side = fId[0]; // 'L', 'R'
    const p = this.posture || {};
    const masterCurl = p.masterCurl ?? 1.0;

    let baseCurl = 0.25;
    if (type === 'I') baseCurl = p.curlIndex ?? (HAND_CONFIG.REST_CURLS.I ?? 0.28);
    else if (type === 'M') baseCurl = p.curlMiddle ?? (HAND_CONFIG.REST_CURLS.M ?? 0.30);
    else if (type === 'R') baseCurl = p.curlRing ?? (HAND_CONFIG.REST_CURLS.R ?? 0.26);
    else if (type === 'P') baseCurl = p.curlPinky ?? (HAND_CONFIG.REST_CURLS.P ?? 0.22);
    else if (type === 'T') baseCurl = p.curlThumb ?? (HAND_CONFIG.REST_CURLS.T ?? 0.15);
    const restCurl = baseCurl * masterCurl;

    // Lateral splay / spread
    const sideSign = side === 'L' ? 1 : -1;
    let splayAngle = 0;
    const mSplay = p.masterSplay || 0;
    if (type === 'I') splayAngle = (p.splayIndex || 0) + (-mSplay * 0.5);
    else if (type === 'M') splayAngle = p.splayMiddle || 0;
    else if (type === 'R') splayAngle = (p.splayRing || 0) + (mSplay * 0.5);
    else if (type === 'P') splayAngle = (p.splayPinky || 0) + (mSplay * 1.0);
    else if (type === 'T') splayAngle = (p.splayThumb || 0) + (-mSplay * 1.2);
    const restSplay = splayAngle * sideSign;

    return { restCurl, restSplay };
  }

  applyRestPose() {
    this._initFingerReachStates();
    Object.keys(this.chains).forEach((fId) => {
      const type = fId[1];
      const { restCurl, restSplay } = this._getFingerRestParams(fId);
      const bones = this.chains[fId];
      if (!bones) return;

      const sideSign = fId.startsWith('L') ? -1 : 1;
      const indexAlignComp = (type === 'I') ? (0.52 * restCurl * sideSign) : 0;

      bones.forEach((bone, idx) => {
        const init = this.initialRotations.get(bone);
        if (!init) return;
        let weight = HAND_CONFIG.ANIMATION.PROXIMAL_WEIGHT;
        if (idx === 1) weight = HAND_CONFIG.ANIMATION.INTERMEDIATE_WEIGHT;
        else if (idx === 2) weight = HAND_CONFIG.ANIMATION.DISTAL_WEIGHT;

        bone.rotation.x = init.x - restCurl * weight;
        if (idx === 0) {
          bone.rotation.z = init.z + restSplay + (indexAlignComp * 0.45);
        } else if (idx === 1) {
          bone.rotation.z = init.z + (indexAlignComp * 0.35);
        } else if (idx === 2) {
          bone.rotation.z = init.z + (indexAlignComp * 0.20);
        }
        bone.updateMatrix();
      });

      if (type === 'T' && this.baseJoints[fId]) {
        const base = this.baseJoints[fId];
        const initB = this.initialRotations.get(base);
        if (initB) base.rotation.z = initB.z;
      }
    });
  }

  reset() {
    this.activeTaps.clear();
    this.applyRestPose();
  }
}
