/**
 * 3D Scene & Camera Controller for Hand Overlay
 * KeyVibe Touch Typing Studio
 *
 * Manages Three.js rendering, lighting, camera frustum,
 * and high-precision screen-to-3D keyboard plane raycasting.
 */

import * as THREE from 'three';
import { HAND_CONFIG } from './hand3dConfig.js?v=2.6';

export class Hand3DScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.keyboardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.leftArmGroup = null;
    this.rightArmGroup = null;

    this._initScene();
  }

  _initScene() {
    this.scene = new THREE.Scene();

    // Perspective Camera matching typist downward viewpoint
    const { FOV, NEAR, FAR, POSITION, LOOK_AT } = HAND_CONFIG.CAMERA;
    this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, NEAR, FAR);
    this.camera.position.copy(POSITION);
    this.camera.lookAt(LOOK_AT);
    this.camera.updateMatrixWorld(true);

    // High performance WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this._setupLighting();

    // Container groups for left and right arm positioning
    this.leftArmGroup = new THREE.Group();
    this.rightArmGroup = new THREE.Group();
    this.scene.add(this.leftArmGroup);
    this.scene.add(this.rightArmGroup);
  }

  _setupLighting() {
    const { HEMISPHERE, KEY_LIGHT, FILL_LIGHT, RIM_LIGHT } = HAND_CONFIG.LIGHTING;

    const hemiLight = new THREE.HemisphereLight(
      HEMISPHERE.SKY_COLOR,
      HEMISPHERE.GROUND_COLOR,
      HEMISPHERE.INTENSITY
    );
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(KEY_LIGHT.COLOR, KEY_LIGHT.INTENSITY);
    keyLight.position.copy(KEY_LIGHT.POSITION);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(FILL_LIGHT.COLOR, FILL_LIGHT.INTENSITY);
    fillLight.position.copy(FILL_LIGHT.POSITION);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(RIM_LIGHT.COLOR, RIM_LIGHT.INTENSITY);
    rimLight.position.copy(RIM_LIGHT.POSITION);
    this.scene.add(rimLight);
  }

  /**
   * Resize renderer & adjust projection matrix to match keyboard dimensions
   */
  resize(width, height) {
    if (!this.renderer || !this.camera) return;
    const safeW = Math.max(300, width);
    const safeH = Math.max(150, height);

    this.camera.aspect = safeW / safeH;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.renderer.setSize(safeW, safeH, false);
  }

  /**
   * Project a DOM element's center onto the 3D keyboard plane (Y = 0)
   * @param {HTMLElement} element - Target DOM element (e.g. key-cap)
   * @param {DOMRect} boardRect - Bounding rectangle of the keyboard board
   * @returns {THREE.Vector3|null} Projected 3D coordinate on plane
   */
  projectElementTo3D(element, boardRect) {
    if (!element || !boardRect || boardRect.width === 0 || boardRect.height === 0) {
      return null;
    }

    const r = element.getBoundingClientRect();
    const cx = (r.left + r.right) * 0.5 - boardRect.left;
    const cy = (r.top + r.bottom) * 0.5 - boardRect.top;

    const ndcX = (cx / boardRect.width) * 2 - 1;
    const ndcY = -(cy / boardRect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3();
    const intersected = this.raycaster.ray.intersectPlane(this.keyboardPlane, hit);

    return intersected ? hit : null;
  }

  /**
   * Project a normalized relative point [0..1] inside the keyboard onto the 3D plane
   */
  projectNormalizedPoint(relX, relY) {
    const ndcX = relX * 2 - 1;
    const ndcY = -(relY * 2 - 1);

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3();
    const intersected = this.raycaster.ray.intersectPlane(this.keyboardPlane, hit);
    return intersected ? hit : null;
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }
}
