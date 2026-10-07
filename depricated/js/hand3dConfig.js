/**
 * 3D Hands Configuration & Constants
 * KeyVibe Touch Typing Studio
 *
 * Eliminates magic numbers with documented geometric, anatomical,
 * and rendering tokens.
 */

import * as THREE from 'three';

export const HAND_CONFIG = {
  // Rendering & Viewport
  CAMERA: {
    FOV: 26,
    NEAR: 0.1,
    FAR: 1000,
    POSITION: new THREE.Vector3(0, 24, 34),
    LOOK_AT: new THREE.Vector3(0, -0.5, 0),
  },

  LIGHTING: {
    HEMISPHERE: {
      SKY_COLOR: 0xfff7ed,
      GROUND_COLOR: 0x1e293b,
      INTENSITY: 1.45,
    },
    KEY_LIGHT: {
      COLOR: 0xffedd5,
      INTENSITY: 2.2,
      POSITION: new THREE.Vector3(6, 20, 14),
    },
    FILL_LIGHT: {
      COLOR: 0x93c5fd,
      INTENSITY: 0.9,
      POSITION: new THREE.Vector3(-10, 12, -4),
    },
    RIM_LIGHT: {
      COLOR: 0xf472b6,
      INTENSITY: 0.45,
      POSITION: new THREE.Vector3(0, -4, -8),
    },
  },

  MATERIAL: {
    COLOR: 0xdfa38f,
    ROUGHNESS: 0.55,
    METALNESS: 0.03,
    DEFAULT_OPACITY: 0.88,
    MIN_OPACITY: 0.1,
    MAX_OPACITY: 1.0,
  },

  // Raw GLB Geometry Reference Points (untransformed model space)
  GEOMETRY: {
    // Center point of the 4 home-row fingertips in raw mesh space
    LEFT_HAND_CENTER: new THREE.Vector3(0.946, 0.0, 0.385),
    RIGHT_HAND_CENTER: new THREE.Vector3(-1.472, 0.05, 0.151),

    // Multiplier converting 1 on-screen key width (in 3D world units) to hand scale
    // In model units, fingertip span from pinky to index is ~0.240. (3 key pitches / 0.240 = 12.5)
    KEY_SCALE_FACTOR: 12.5,

    // GLB file path
    MODEL_URL: './3D/hands_armature.glb',
  },

  // Natural Typing Posture Alignment
  POSTURE: {
    // Gentle inward forearm angle (elbows resting slightly wider than wrists)
    INWARD_YAW_DEG: 7.0,

    // Forward tilt angle (knuckles elevated slightly, fingers arching onto keycaps)
    PITCH_DEG: -6.0,

    // Vertical clearance above keyboard plane (Y = 0)
    DESK_HEIGHT_OFFSET: 0.18,

    // Home row alignment offsets
    HOME_ROW_Z_OFFSET: -0.5,
    HOME_ROW_X_INWARD_NUDGE: 0.0,

    // Scale multiplier limits
    MIN_SCALE_MULTIPLIER: 0.6,
    MAX_SCALE_MULTIPLIER: 1.6,
  },

  // Ergonomic Rest Pose Curls (radians of flexion at joint)
  REST_CURLS: {
    I: 0.28, // Index
    M: 0.30, // Middle
    R: 0.26, // Ring
    P: 0.22, // Pinky
    T: 0.15, // Thumb
  },

  // Deterministic Bone Hierarchy in mesh.skeleton.bones
  // [MCP, PIP, DIP/Tip] indices per finger
  BONE_CHAINS: {
    // Left Hand (MeshL skeleton)
    LI: [3, 4, 5],    // Index (Bone, Bone001, Bone002 under Bone012)
    LM: [15, 16, 17], // Middle (Bone003, Bone004, Bone005 under Bone013)
    LR: [7, 8, 9],    // Ring (Bone006, Bone007, Bone008 under Bone014)
    LP: [11, 12, 13], // Pinky (Bone009, Bone010, Bone011 under Bone015)
    LT: [23, 24, 25], // Thumb (Bone017, Bone018, Bone019 under Bone021)

    // Right Hand (MeshR skeleton)
    RI: [3, 4, 5],    // Index (Bone_1, Bone001_1, Bone002_1 under Bone012_1)
    RM: [15, 16, 17], // Middle (Bone003_1, Bone004_1, Bone005_1 under Bone013_1)
    RR: [7, 8, 9],    // Ring (Bone006_1, Bone007_1, Bone008_1 under Bone014_1)
    RP: [11, 12, 13], // Pinky (Bone009_1, Bone010_1, Bone011_1 under Bone015_1)
    RT: [23, 24, 25], // Thumb (Bone017_1, Bone018_1, Bone019_1 under Bone021_1)
  },

  // Base / metacarpal joints for opposition
  BASE_JOINTS: {
    LI: 2, LM: 14, LR: 6, LP: 10, LT: 22,
    RI: 2, RM: 14, RR: 6, RP: 10, RT: 22,
  },

  // Keystroke Animation
  ANIMATION: {
    TAP_SPEED: 0.16,
    STRIKE_MAGNITUDE: 0.45,
    THUMB_OPPOSITION_MAGNITUDE: 0.30,
    PROXIMAL_WEIGHT: 0.38,
    INTERMEDIATE_WEIGHT: 0.62,
    DISTAL_WEIGHT: 0.30,
  },

  // Default Fallback Key Layout Ratios (fraction of keyboard board width & height)
  FALLBACK_PROPORTIONS: {
    HOME_ROW_Y_RATIO: 0.55,
    KEY_A_X_RATIO: 0.21,
    KEY_F_X_RATIO: 0.39,
    KEY_J_X_RATIO: 0.61,
    KEY_SEMI_X_RATIO: 0.79,
  },

  // Designated home keys for each of the 10 fingers
  HOME_KEYS: {
    LP: 'KeyA',
    LR: 'KeyS',
    LM: 'KeyD',
    LI: 'KeyF',
    LT: 'Space',
    RI: 'KeyJ',
    RM: 'KeyK',
    RR: 'KeyL',
    RP: 'Semicolon',
    RT: 'Space',
  },
};
