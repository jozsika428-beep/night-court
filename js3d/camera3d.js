// Angled RTS camera. Keeps the same fields the HUD code uses (x, y = target in sim units, z = zoom).
import * as THREE from 'three';

// SCALE: 1 sim unit = 0.1 m. The 1600 x 2400 map is 160 m x 240 m. Sim x -> world X, sim y -> world Z, Y is up.
export const S = 0.1;
export const toWorld = (x, y) => [x * S, y * S];

export class Camera3D {
  constructor(NC) {
    this.NC = NC;
    this.x = 800; this.y = 2000; this.z = 1; this.yaw = 0; this.yawTarget = 0;
    this.minZ = 0.45; this.maxZ = 3.2; this.vw = 1; this.vh = 1; this.dpr = 1;
    this.cam = new THREE.PerspectiveCamera(42, 1, 1, 900);
    this._v = new THREE.Vector3();
  }
  // distance chosen so about 40 m of ground fits across the screen at zoom 1, in portrait or landscape
  dist() {
    const aspect = this.vw / this.vh, tan = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    const base = Math.min(140, Math.max(50, 40 / (2 * tan * aspect)));
    return base / this.z;
  }
  // closer = flatter view (BFME-like), far = more top-down
  pitch() { const t = (this.z - this.minZ) / (this.maxZ - this.minZ); return THREE.MathUtils.lerp(1.08, 0.7, Math.max(0, Math.min(1, t))); }
  clamp() {
    const W = this.NC.WORLD;
    this.z = Math.max(this.minZ, Math.min(this.maxZ, this.z));
    this.x = Math.max(40, Math.min(W.w - 40, this.x));
    this.y = Math.max(60, Math.min(W.h - 40, this.y));
  }
  rotateBy(rad) { this.yawTarget += rad; }
  apply(dt) {
    if (dt) this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * 10);
    const d = this.dist(), p = this.pitch(), tx = this.x * S, tz = this.y * S;
    this.cam.aspect = this.vw / this.vh;
    this.cam.position.set(tx + Math.sin(this.yaw) * Math.cos(p) * d, Math.sin(p) * d, tz + Math.cos(this.yaw) * Math.cos(p) * d);
    this.cam.lookAt(tx, 0, tz);
    this.cam.far = d * 4 + 200;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
  }
  // screen position of a sim point (h = metres above ground)
  project(x, y, h, out) {
    const v = this._v.set(x * S, h || 0, y * S).project(this.cam);
    out = out || {};
    out.x = (v.x + 1) / 2 * this.vw; out.y = (1 - v.y) / 2 * this.vh; out.behind = v.z > 1;
    return out;
  }
  inView(x, y) { const p = this.project(x, y, 1); return !p.behind && p.x > -20 && p.x < this.vw + 20 && p.y > -20 && p.y < this.vh + 20; }
}
