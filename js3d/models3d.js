// 3D models: loads CandleStick's glTF models from art3d/manifest.json, and builds
// low-poly placeholder shapes for every key that has no model yet.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TEAM = { night: new THREE.Color('#b3122e'), dawn: new THREE.Color('#e0b030') };

// ---------- shared primitives ----------
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  ico: new THREE.IcosahedronGeometry(1, 0),
  sph: new THREE.SphereGeometry(1, 8, 6),
  dome: new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.08, 4, 10, Math.PI),
  ring: new THREE.TorusGeometry(1, 0.06, 4, 16)
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
// one part: [geo, color, [x,y,z], [sx,sy,sz], [rx,ry,rz]]
function part(geo, color, pos, scl, rot) {
  const g0 = G[geo].clone(), g = g0.index ? g0.toNonIndexed() : g0;
  g.deleteAttribute('uv');
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
  _m.compose(new THREE.Vector3(...pos), _q.setFromEuler(_e), new THREE.Vector3(...(scl || [1, 1, 1])));
  g.applyMatrix4(_m);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  _c.set(color); for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function merge(parts) { const g = mergeGeometries(parts.map(p => part(...p)), false); g.computeBoundingBox(); g.computeBoundingSphere(); return g; }

// ---------- placeholder units (metres, feet at y=0, facing +Z) ----------
const N = '#b3122e', D = '#e0b030';
const legs = (c, w = 0.15, h = 0.45) => [['box', c, [-w, h / 2, 0], [0.14, h, 0.14]], ['box', c, [w, h / 2, 0], [0.14, h, 0.14]]];
function wolf(fur, team, s = 1) {
  return [
    ['cyl8', fur, [0, 1.2 * s, 0.05], [0.48 * s, 1.1 * s, 0.42 * s], [0.5, 0, 0]],
    ['box', fur, [0, 1.85 * s, 0.5 * s], [0.42 * s, 0.4 * s, 0.55 * s]],
    ['box', '#2a1a14', [0, 1.78 * s, 0.85 * s], [0.22 * s, 0.2 * s, 0.35 * s]],
    ['cone4', fur, [-0.14 * s, 2.15 * s, 0.4 * s], [0.08 * s, 0.25 * s, 0.08 * s]], ['cone4', fur, [0.14 * s, 2.15 * s, 0.4 * s], [0.08 * s, 0.25 * s, 0.08 * s]],
    ['box', fur, [-0.55 * s, 1.0 * s, 0.35 * s], [0.2 * s, 0.95 * s, 0.2 * s], [0.4, 0, 0.15]], ['box', fur, [0.55 * s, 1.0 * s, 0.35 * s], [0.2 * s, 0.95 * s, 0.2 * s], [0.4, 0, -0.15]],
    ['box', fur, [-0.25 * s, 0.38 * s, -0.1], [0.26 * s, 0.76 * s, 0.26 * s]], ['box', fur, [0.25 * s, 0.38 * s, -0.1], [0.26 * s, 0.76 * s, 0.26 * s]],
    ['cyl8', team, [0, 1.62 * s, 0.38 * s], [0.32 * s, 0.14 * s, 0.32 * s], [0.5, 0, 0]],
    ['box', '#f0e8d8', [0.12 * s, 1.72 * s, 1.0 * s], [0.04, 0.1, 0.04]], ['box', '#f0e8d8', [-0.12 * s, 1.72 * s, 1.0 * s], [0.04, 0.1, 0.04]]
  ];
}
const UNIT_PARTS = {
  ghoul: [['cyl6', '#6f7f4f', [0, 0.78, 0.05], [0.3, 0.8, 0.3], [0.4, 0, 0]], ['ico', '#93a370', [0, 1.28, 0.3], [0.22, 0.22, 0.22]],
    ['box', '#6f7f4f', [-0.33, 0.78, 0.22], [0.11, 0.62, 0.11], [0.6, 0, 0]], ['box', '#6f7f4f', [0.33, 0.78, 0.22], [0.11, 0.62, 0.11], [0.6, 0, 0]],
    ['cyl6', N, [0, 0.42, 0], [0.34, 0.22, 0.34]], ...legs('#55603c')],
  archer: [['cyl6', '#d8cfb4', [0, 0.95, 0], [0.22, 0.8, 0.22]], ['ico', '#efe8d4', [0, 1.55, 0.02], [0.2, 0.22, 0.2]],
    ['torus', '#5a3a20', [0.38, 1.05, 0.22], [0.48, 0.48, 0.48], [0, 0, Math.PI / 2]], ['box', N, [0, 1.0, -0.2], [0.5, 0.75, 0.05]], ...legs('#c8bfa4')],
  thrall: [['cone8', '#2a0610', [0, 0.7, 0], [0.5, 1.4, 0.5]], ['cyl6', '#8a1426', [0, 1.35, 0], [0.22, 0.5, 0.22]], ['sph', '#ead6cc', [0, 1.75, 0], [0.18, 0.2, 0.18]],
    ['box', '#c8d0da', [0.42, 1.0, 0.32], [0.06, 0.95, 0.03], [0.6, 0, 0]], ['box', N, [0, 1.42, 0.18], [0.46, 0.1, 0.1]], ['box', '#1a0408', [0, 1.3, -0.25], [0.7, 1.0, 0.05]]],
  werewolf: wolf('#6b5038', N),
  bat: [['sph', '#2a1a30', [0, 0.3, 0], [0.25, 0.22, 0.35]], ['box', '#4a3060', [-0.7, 0.35, 0], [1.1, 0.05, 0.55], [0, 0, 0.3]], ['box', '#4a3060', [0.7, 0.35, 0], [1.1, 0.05, 0.55], [0, 0, -0.3]],
    ['sph', '#2a1a30', [-0.5, 0.2, 0.5], [0.15, 0.12, 0.2]], ['sph', '#2a1a30', [0.5, 0.2, -0.4], [0.15, 0.12, 0.2]], ['box', N, [0, 0.45, -0.2], [0.2, 0.05, 0.3]]],
  catapult: [['box', '#4a3a2a', [0, 0.55, 0], [1.6, 0.4, 2.2]], ['cyl8', '#2a2018', [-0.9, 0.42, 0.7], [0.42, 0.2, 0.42], [0, 0, Math.PI / 2]], ['cyl8', '#2a2018', [0.9, 0.42, 0.7], [0.42, 0.2, 0.42], [0, 0, Math.PI / 2]],
    ['cyl8', '#2a2018', [-0.9, 0.42, -0.7], [0.42, 0.2, 0.42], [0, 0, Math.PI / 2]], ['cyl8', '#2a2018', [0.9, 0.42, -0.7], [0.42, 0.2, 0.42], [0, 0, Math.PI / 2]],
    ['box', '#e0d8c0', [0, 1.35, -0.2], [0.16, 0.16, 2.1], [-0.6, 0, 0]], ['ico', '#f0e8d4', [0, 2.0, -1.0], [0.3, 0.3, 0.3]], ['box', N, [0, 1.2, 1.05], [1.2, 0.8, 0.06]]],
  torch: [['cyl6', '#6a5a4a', [0, 0.9, 0], [0.25, 0.85, 0.25]], ['box', D, [0, 0.95, 0.22], [0.38, 0.6, 0.06]], ['sph', '#e8c8a8', [0, 1.55, 0], [0.18, 0.2, 0.18]],
    ['box', '#5a3a20', [0.36, 1.15, 0.2], [0.06, 0.75, 0.06]], ...legs('#4a3a2a')],
  crossbow: [['cyl6', '#8a96a4', [0, 0.92, 0], [0.24, 0.85, 0.24]], ['box', D, [0, 0.95, 0.22], [0.38, 0.6, 0.06]], ['sph', '#e8c8a8', [0, 1.55, 0], [0.18, 0.2, 0.18]],
    ['cone8', '#b8c4d0', [0, 1.75, 0], [0.22, 0.25, 0.22]], ['box', '#5a3a20', [0, 1.15, 0.4], [0.62, 0.07, 0.07]], ['box', '#5a3a20', [0, 1.15, 0.45], [0.07, 0.07, 0.5]], ...legs('#5a6470')],
  priest: [['cone8', '#fff3cc', [0, 0.78, 0], [0.45, 1.56, 0.45]], ['sph', '#e8c8a8', [0, 1.7, 0], [0.18, 0.2, 0.18]], ['box', D, [0, 1.15, 0.2], [0.14, 0.9, 0.05]],
    ['box', '#c8a040', [0.38, 0.95, 0.05], [0.05, 1.8, 0.05]]],
  knight: [['box', '#d4dce6', [0, 1.05, 0], [0.62, 0.7, 1.6]], ['box', '#c4ccd6', [0, 1.55, 0.9], [0.3, 0.55, 0.6], [0.5, 0, 0]],
    ['box', '#b0b8c4', [-0.22, 0.4, 0.6], [0.14, 0.8, 0.14]], ['box', '#b0b8c4', [0.22, 0.4, 0.6], [0.14, 0.8, 0.14]], ['box', '#b0b8c4', [-0.22, 0.4, -0.6], [0.14, 0.8, 0.14]], ['box', '#b0b8c4', [0.22, 0.4, -0.6], [0.14, 0.8, 0.14]],
    ['box', D, [0, 0.82, 0], [0.68, 0.32, 1.66]], ['cyl6', '#9aa4b0', [0, 1.75, -0.05], [0.22, 0.6, 0.22]], ['cone8', '#d8dee6', [0, 2.2, -0.05], [0.2, 0.35, 0.2]],
    ['box', '#7a5a3a', [0.35, 1.75, 0.6], [0.06, 0.06, 2.2]]],
  ballista: [['box', '#5a4030', [0, 0.55, 0], [1.4, 0.4, 2.0]], ['cyl8', '#2a2018', [-0.8, 0.42, 0.6], [0.42, 0.2, 0.42], [0, 0, Math.PI / 2]], ['cyl8', '#2a2018', [0.8, 0.42, 0.6], [0.42, 0.2, 0.42], [0, 0, Math.PI / 2]],
    ['cyl8', '#2a2018', [-0.8, 0.42, -0.6], [0.42, 0.2, 0.42], [0, 0, Math.PI / 2]], ['cyl8', '#2a2018', [0.8, 0.42, -0.6], [0.42, 0.2, 0.42], [0, 0, Math.PI / 2]],
    ['box', '#6a4a30', [0, 1.1, 0.5], [2.2, 0.14, 0.14]], ['box', '#ff7020', [0, 1.15, 0.2], [0.07, 0.07, 1.7]], ['box', D, [0, 1.0, -1.0], [1.0, 0.6, 0.06]]],
  vael: [['cone8', '#22040c', [0, 0.85, 0], [0.62, 1.7, 0.62]], ['cyl6', '#c0102a', [0, 1.75, 0], [0.2, 0.5, 0.2]], ['sph', '#f2dcd4', [0, 2.12, 0], [0.18, 0.21, 0.18]],
    ['cone6', '#ffd24a', [0, 2.38, 0], [0.16, 0.2, 0.16]], ['box', N, [0, 1.4, -0.32], [1.0, 1.5, 0.05], [-0.15, 0, 0]], ['box', '#1a0206', [0, 2.0, -0.12], [0.6, 0.5, 0.05]]],
  grimfang: wolf('#55555c', N, 1.15).concat([['box', N, [0, 1.9, 0.0], [1.1, 0.15, 0.6]]]),
  ashen: [['cone8', '#efe6cc', [0, 0.8, 0], [0.55, 1.6, 0.55]], ['cyl6', '#d8d0b8', [0, 1.75, 0], [0.24, 0.55, 0.24]], ['box', D, [0, 1.4, 0.24], [0.3, 1.0, 0.05]],
    ['sph', '#e0bc9a', [0, 2.15, 0], [0.19, 0.21, 0.19]], ['box', '#7a5a3a', [0.45, 1.3, 0.1], [0.07, 1.3, 0.07]], ['box', '#c8ccd4', [0.45, 2.0, 0.1], [0.4, 0.28, 0.28]],
    ['ring', '#fff3a0', [0, 2.45, 0], [0.24, 0.24, 0.24], [Math.PI / 2, 0, 0]]]
};
const GLOW_PARTS = { torch: [['cone6', '#ffb030', [0.36, 1.62, 0.2], [0.13, 0.32, 0.13]]], priest: [['ico', '#fff6a0', [0.38, 1.9, 0.05], [0.12, 0.12, 0.12]]],
  thrall: [['box', '#ff2040', [0, 1.8, 0.16], [0.14, 0.04, 0.03]]], vael: [['box', '#ff2040', [0, 2.15, 0.16], [0.14, 0.04, 0.03]]],
  ghoul: [['box', '#c8ff60', [0, 1.3, 0.5], [0.16, 0.04, 0.03]]], werewolf: [['box', '#ffd040', [0, 1.92, 0.78], [0.26, 0.05, 0.03]]], grimfang: [['box', '#ffd040', [0, 2.2, 0.9], [0.3, 0.06, 0.03]]] };

const unitGeoCache = {};
export function unitGeometry(key) {
  if (unitGeoCache[key]) return unitGeoCache[key];
  const parts = UNIT_PARTS[key] || [['cyl6', '#888', [0, 0.9, 0], [0.3, 1.8, 0.3]]];
  const g = merge(parts), glow = GLOW_PARTS[key] ? merge(GLOW_PARTS[key]) : null;
  return (unitGeoCache[key] = { geo: g, glow, height: g.boundingBox.max.y });
}

// ---------- placeholder buildings (fit the plot, ~6-8 m; fortress ~13 m) ----------
const STYLE = {
  night: { stone: '#2e262c', dark: '#1a1418', roof: '#3c0a14', wood: '#2a1a14', team: N, glow: '#ff3a3a', crop: '#5a1a20' },
  dawn: { stone: '#cfc6ae', dark: '#9a8c70', roof: '#3a5a8a', wood: '#6a4a2a', team: D, glow: '#ffd070', crop: '#c8a440' }
};
function house(c, w, d, h, rh, x = 0, z = 0) { return [['box', c.stone, [x, h / 2, z], [w, h, d]], ['cone4', c.roof, [x, h + rh / 2, z], [w * 0.75, rh, d * 0.75], [0, Math.PI / 4, 0]], ['box', c.dark, [x, 0.8, z + d / 2 + 0.01], [w * 0.22, 1.6, 0.05]]]; }
function tower(c, r, h, x = 0, z = 0, spike) { return [['cyl8', c.stone, [x, h / 2, z], [r, h, r]], ['cyl8', c.dark, [x, h + 0.25, z], [r * 1.18, 0.5, r * 1.18]], ['cone8', c.roof, [x, h + 0.5 + (spike ? 1.6 : 1), z], [r * 1.1, spike ? 3.2 : 2, r * 1.1]]]; }
function banner(c, x, z, h) { return [['box', c.wood, [x, h / 2, z], [0.1, h, 0.1]], ['box', c.team, [x + 0.45, h - 0.6, z], [0.8, 1.0, 0.04]]]; }
const glowWin = (c, x, y, z, w = 0.4, h = 0.5) => ['box', c.glow, [x, y, z], [w, h, 0.06]];

function buildingParts(type, level, fac) {
  const c = STYLE[fac], L = level, p = [], gl = [], night = fac === 'night';
  const lv = (a) => p.push(...a);
  switch (NC_role(type)) {
    case 'fortress':
      lv([['box', c.dark, [0, 0.3, 0], [13, 0.6, 13]]]);
      [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([x, z]) => lv(tower(c, 1.5, 6.5, x, z, night)));
      lv([['box', c.stone, [0, 1.6, -5], [9, 3.2, 1]], ['box', c.stone, [0, 1.6, 5], [9, 3.2, 1]], ['box', c.stone, [-5, 1.6, 0], [1, 3.2, 9]], ['box', c.stone, [5, 1.6, 0], [1, 3.2, 9]]]);
      lv(house(c, 5.5, 5.5, 7, 4)); lv(tower(c, 1.2, 10, 0, -1, night)); lv(banner(c, 2.4, 2.4, 9)); lv(banner(c, -2.4, 2.4, 9));
      gl.push(glowWin(c, 0, 4.5, 2.79, 0.7, 1.0), glowWin(c, -1.6, 4.5, 2.79), glowWin(c, 1.6, 4.5, 2.79), ['box', c.glow, [0, 1.2, 5.52], [1.6, 2.2, 0.06]]);
      break;
    case 'barracks':
      if (type === 'crypt') { lv([['box', c.stone, [0, 1.2, 0], [6, 2.4, 5]], ['cone6', c.roof, [-2, 4, -1], [0.6, 3.4, 0.6]], ['cone6', c.roof, [2, 4, -1], [0.6, 3.4, 0.6]], ['cone6', c.roof, [0, 4.6, -1.5], [0.8, 4.4, 0.8]], ['box', c.dark, [0, 2.6, 0], [6.4, 0.4, 5.4]]]); gl.push(['box', c.glow, [0, 1, 2.52], [1.4, 1.9, 0.06]]); }
      else { lv(house(c, 6, 5, 3, 2.6)); lv(banner(c, 3.4, 2.4, 5)); gl.push(glowWin(c, -1.8, 1.8, 2.52), glowWin(c, 1.8, 1.8, 2.52)); }
      break;
    case 'barracks2':
      if (type === 'wolfden') { lv([['dome', '#3a2a20', [0, 0, 0], [3.4, 2.8, 3.4]], ['box', '#0a0606', [0, 0.9, 2.6], [1.8, 1.8, 1.4]], ['cyl6', '#e8e0cc', [-1.6, 2.2, 1.6], [0.12, 1.6, 0.12], [0.6, 0, 0.4]], ['cyl6', '#e8e0cc', [1.6, 2.2, 1.6], [0.12, 1.6, 0.12], [0.6, 0, -0.4]]]); lv(banner(c, 2.6, -1.5, 4.5)); gl.push(['box', '#ffd040', [0, 1.1, 3.31], [0.6, 0.12, 0.04]]); }
      else { lv(house(c, 7.4, 4.2, 2.6, 2.2)); lv([['box', c.wood, [0, 0.5, 3.2], [7, 0.12, 0.12]], ['box', c.wood, [0, 0.9, 3.2], [7, 0.12, 0.12]]]); lv(banner(c, -3.6, 2.4, 4.5)); }
      break;
    case 'forge':
      if (type === 'altar') { lv([['cyl12', c.stone, [0, 0.35, 0], [3.2, 0.7, 3.2]], ['cyl12', c.dark, [0, 0.9, 0], [2.2, 0.4, 2.2]]]); [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([x, z]) => lv([['box', c.stone, [x, 1.9, z], [0.5, 3.2, 0.5]], ['cone4', c.roof, [x, 3.8, z], [0.45, 0.8, 0.45]]])); gl.push(['ico', c.glow, [0, 2.6, 0], [0.75, 0.75, 0.75]], ['cyl12', '#8a0018', [0, 1.12, 0], [1.6, 0.06, 1.6]]); }
      else { lv(house(c, 5.6, 4.6, 2.8, 2.4)); lv([['box', c.dark, [1.8, 4.2, -1], [0.9, 3.4, 0.9]]]); gl.push(['box', '#ff8020', [0, 1.0, 2.32], [1.6, 1.4, 0.06]], ['box', '#ff8020', [1.8, 5.95, -1], [0.6, 0.12, 0.6]]); }
      break;
    case 'farm': case 'farm2': {
      const big = NC_role(type) === 'farm2';
      for (let i = 0; i < (big ? 4 : 3); i++) lv([['box', c.crop, [-1.8 + (i % 2) * 3.6 * (big ? 1 : 0.9), 0.15, -2 + Math.floor(i / 2) * 2.3], [3, 0.3, 1.8]]]);
      if (type === 'mill') { lv(tower(c, 1.3, 4.5, 1.4, 1.6)); }
      else if (type === 'granary') { lv([['cyl12', c.stone, [-1.6, 1.6, 1.8], [1.1, 3.2, 1.1]], ['dome', c.roof, [-1.6, 3.2, 1.8], [1.1, 0.9, 1.1]], ['cyl12', c.stone, [1.2, 1.4, 1.8], [1.0, 2.8, 1.0]], ['dome', c.roof, [1.2, 2.8, 1.8], [1.0, 0.8, 1.0]]]); }
      else { lv(house(c, big ? 5 : 3.6, 3, big ? 2.6 : 2.2, 1.8, 0.8, 1.8)); if (big) gl.push(['sph', c.glow, [-2.0, 2.4, 3.4], [0.2, 0.2, 0.2]]); }
      lv(banner(c, -3.2, 2.8, 3.6));
      break; }
    case 'tower':
      lv(tower(c, 1.7, 7, 0, 0, night)); gl.push(glowWin(c, 0, 5.5, 1.72, 0.4, 0.7)); lv(banner(c, 1.9, 0, 6));
      break;
  }
  // level 2 / 3 extras: side towers and banners make growth visible
  if (NC_role(type) !== 'fortress') {
    if (L >= 2) lv(tower(c, 0.7, 4.2, -3.1, -2.4, night));
    if (L >= 3) { lv(tower(c, 0.7, 5, 3.1, -2.4, night)); lv(banner(c, -3.4, 2.8, 5.5)); gl.push(['box', c.glow, [-3.1, 3.6, -1.68], [0.3, 0.4, 0.05]]); }
  }
  return { p, gl };
}
let NC_ref = null;
function NC_role(type) { return NC_ref.BUILDINGS[type].role; }
const bGeoCache = {};
export function buildingGeometry(NC, type, level) {
  NC_ref = NC;
  const k = type + level;
  if (bGeoCache[k]) return bGeoCache[k];
  const fac = NC.BUILDINGS[type].faction, { p, gl } = buildingParts(type, level, fac);
  const out = { geo: merge(p), glow: gl.length ? merge(gl) : null, blades: null };
  if (type === 'mill') out.blades = merge([['box', '#e8dcc0', [0, 0, 0], [0.3, 4.4, 0.08]], ['box', '#e8dcc0', [0, 0, 0], [4.4, 0.3, 0.08]]]);
  out.height = out.geo.boundingBox.max.y;
  return (bGeoCache[k] = out);
}

// ---------- outposts and props ----------
export function outpostGeometry(type) {
  const s = STYLE.night, gy = '#6a6a66';
  if (type === 'village') return { geo: merge([...house({ stone: '#7a6a50', roof: '#5a3a24', dark: '#2a1a10' }, 3, 2.6, 2, 1.6, -3, -2), ...house({ stone: '#7a6a50', roof: '#5a3a24', dark: '#2a1a10' }, 2.6, 2.4, 1.8, 1.4, 3, -2.5), ['box', '#4a3a2a', [0, 0.4, -5], [6, 0.8, 0.2]]]), glow: merge([['box', '#ffb050', [-3, 1.1, -0.68], [0.4, 0.4, 0.05]]]) };
  if (type === 'graveyard') { const p = []; for (let i = 0; i < 9; i++) p.push(['box', gy, [-4 + (i % 3) * 4, 0.6, -4 + Math.floor(i / 3) * 3], [0.8, 1.2, 0.25]]); p.push(['box', '#3a3a38', [0, 0.5, -6], [9, 1.0, 0.3]], ['cyl6', '#2a2420', [4.5, 2, -5], [0.25, 4, 0.25]]); return { geo: merge(p), glow: null }; }
  const p = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; p.push(['box', '#8a8e88', [Math.cos(a) * 4.5, 1.5, Math.sin(a) * 4.5], [1, 3, 0.8], [0, -a, 0]]); }
  p.push(['cyl12', '#5a5e58', [0, 0.25, 0], [2.2, 0.5, 2.2]]);
  return { geo: merge(p), glow: merge([['ico', '#70e8ff', [0, 2.6, 0], [0.7, 1.3, 0.7]]]) };
}
export const PROPS = {
  pine: merge([['cyl6', '#3a2a1a', [0, 0.8, 0], [0.22, 1.6, 0.22]], ['cone8', '#1e3a24', [0, 2.6, 0], [1.6, 3.0, 1.6]], ['cone8', '#24452a', [0, 4.0, 0], [1.1, 2.2, 1.1]]]),
  oak: merge([['cyl6', '#4a3420', [0, 1.1, 0], [0.3, 2.2, 0.3]], ['ico', '#2c4a26', [0, 3.2, 0], [2.1, 1.8, 2.1]], ['ico', '#365a2c', [0.8, 3.9, 0.4], [1.2, 1.1, 1.2]]]),
  dead: merge([['cyl6', '#4a3e34', [0, 1.6, 0], [0.22, 3.2, 0.22]], ['cyl6', '#4a3e34', [0.6, 2.6, 0], [0.1, 1.6, 0.1], [0, 0, -0.8]], ['cyl6', '#4a3e34', [-0.5, 2.3, 0.2], [0.1, 1.3, 0.1], [0.3, 0, 0.9]]]),
  rock: merge([['ico', '#5c5e58', [0, 0.3, 0], [1, 0.6, 0.9]]]),
  reed: merge([['cone4', '#5a6a3a', [0, 0.5, 0], [0.08, 1.0, 0.08]], ['cone4', '#6a7a40', [0.2, 0.45, 0.1], [0.07, 0.9, 0.07]], ['cone4', '#4a5a30', [-0.15, 0.4, -0.1], [0.07, 0.8, 0.07]]])
};

// ---------- glTF models from art3d/manifest.json ----------
// Agreed spec: .glb, Y-up, 1 unit = 1 m, faces +Z, origin at feet; clips Idle/Walk/Attack/Death (+Run, Ability);
// recolourable material named "Team". Manifest: { key: { file | levels:[l1,l2,l3], faction, scale, height, clips:{...} } }
export class ModelLib {
  // opts: { hd: 'art3d_hd/' (HD set; per-key fallback to base), renderer, high }
  constructor(base = 'art3d/', opts = {}) {
    this.base = base; this.opts = opts; this.high = !!opts.high;
    this.entries = {}; this.protos = {}; this.far = {}; this.source = {}; this.roots = {};
    this.loader = new GLTFLoader(); this.tints = new Map(); this.version = 0;
    this.glowMats = []; this.glowCache = new Map(); this.terrain = {}; this.issues = []; this.propCache = {};
    // compressed assets: Meshopt geometry, KTX2/Basis textures (transcoder vendored, fetched only when a .ktx2 is used)
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    if (opts.renderer) {
      this.ktx2 = new KTX2Loader().setTranscoderPath(new URL('../vendor/three/addons/libs/basis/', import.meta.url).href).detectSupport(opts.renderer);
      this.loader.setKTX2Loader(this.ktx2);
      this.aniso = this.high ? Math.min(4, opts.renderer.capabilities.getMaxAnisotropy()) : 1;
    } else this.aniso = 1;
  }
  dispose() { if (this.ktx2) this.ktx2.dispose(); }
  async manifest(base) {
    try { const r = await fetch(base + 'manifest.json', { cache: 'no-cache' }); if (!r.ok) return null; const m = await r.json(); return { m, root: typeof m.base === 'string' ? m.base : base }; } catch (e) { return null; }
  }
  static flat(m) { return m.models || Object.assign({}, m.units || {}, m.heroes || {}, m.buildings || {}, m.props || {}, (m.units || m.buildings) ? {} : m); }
  async load() {
    const std = await this.manifest(this.base), hd = this.opts.hd ? await this.manifest(this.opts.hd) : null;
    if (!std && !hd) return 0;
    this.root = std ? std.root : hd.root; this.set = hd ? 'hd' : 'std';
    const S0 = std ? ModelLib.flat(std.m) : {}, S1 = hd ? ModelLib.flat(hd.m) : {};
    const jobs = [], keys = new Set([...Object.keys(S0), ...Object.keys(S1)]);
    this.nDone = 0; this.nTotal = 0; // for the loading bar
    const get = (k, i, f, slot) => (this.nTotal++, jobs.push(this.loader.loadAsync(f).finally(() => this.nDone++).then(gltf => { gltf.scene.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => this.prep(m)); }); (slot[k] = slot[k] || [])[i] = gltf; this.version++; })
      .catch(err => { this.issues.push(k + ': ' + f + ' failed to load'); console.warn('model failed', k, f, err && err.message); })));
    for (const k of keys) {
      const useHd = S1[k] && typeof S1[k] === 'object', e = useHd ? S1[k] : S0[k], root = useHd ? hd.root : std.root;
      if (!e || typeof e !== 'object') continue;
      if (e.type === 'terrain' || /^terrain_/.test(k)) { this.terrain[k] = Object.assign({ root }, e); continue; }
      // buildings: { dir, levels:[...] }; units: { file }; optional lod: { far: file | [files per level] }
      const files = e.levels ? e.levels.map(f => f ? (e.dir || '') + f : null) : (e.file ? [e.file] : null); if (!files) continue;
      this.entries[k] = e; this.source[k] = useHd ? 'hd' : 'std'; this.roots[k] = root;
      const farSpec = e.lod && e.lod.far, fars = farSpec ? (Array.isArray(farSpec) ? farSpec : files.map(() => farSpec)) : [];
      files.forEach((f, i) => {
        if (!f) return;
        const near = root + f, ff = fars[i], farUrl = ff ? (ff.includes('/') ? root + ff : near.replace(/[^/]*$/, '') + ff) : null;
        if (farUrl && !this.high) get(k, i, farUrl, this.protos);   // Low graphics: always the far model
        else { get(k, i, near, this.protos); if (farUrl) get(k, i, farUrl, this.far); }
      });
    }
    await Promise.all(jobs);
    this.done = true; this.version++;
    return Object.keys(this.protos).length;
  }
  hasFar(key, level) { const p = this.far[key]; return !!(p && (p[(level || 1) - 1] || p[0])); }
  has(key, level) { const p = this.protos[key]; return !!(p && (p[(level || 1) - 1] || p[0])); }
  entryHeight(key, level) { const e = this.entries[key] || {}; return Array.isArray(e.height) ? e.height[(level || 1) - 1] : e.height; }
  footprint(key, level) { const e = this.entries[key] || {}, f = e.footprint; if (!f) return null; return Array.isArray(f[0]) ? f[(level || 1) - 1] : f; }
  tint(mat, color) {
    const k = mat.uuid + color.getHexString(); let t = this.tints.get(k);
    if (!t) { t = mat.clone(); t.color = color.clone(); this.tints.set(k, t); }
    return t;
  }
  // "Glow" -> unlit vertex-coloured material, shared, brightened at night by setGlow()
  glow(mat) {
    let g = this.glowCache.get(mat.uuid);
    if (!g) {
      const base = (mat.emissive && mat.emissive.getHex()) ? mat.emissive.clone() : (mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1));
      g = new THREE.MeshBasicMaterial({ vertexColors: !!mat.vertexColors, color: base, map: mat.emissiveMap || mat.map || null, side: mat.side, toneMapped: false, transparent: mat.transparent, opacity: mat.opacity });
      g.name = 'Glow'; g.userData.base = base.clone(); this.glowCache.set(mat.uuid, g); this.glowMats.push(g);
    }
    return g;
  }
  setGlow(k) { this.glowMats.forEach(g => g.color.copy(g.userData.base).multiplyScalar(k)); }
  // once per loaded material: graphics-level tweaks
  prep(mat) {
    if (!mat || mat.userData.prepped) return; mat.userData.prepped = true;
    if (this.frontSide && mat.side !== THREE.FrontSide) mat.side = THREE.FrontSide; // Low graphics: skip back faces
    if (!this.high && mat.normalMap) { mat.normalMap.dispose(); mat.normalMap = null; mat.needsUpdate = true; } // no normal maps on Low
    for (const t of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) if (mat[t]) mat[t].anisotropy = this.aniso;
  }
  fixMat(mat, teamColor, uniqueTeam) {
    this.prep(mat);
    if (/glow/i.test(mat.name)) return this.glow(mat);
    if (/metal/i.test(mat.name) && mat.metalness !== undefined) { // no environment map, so very metallic parts would render black
      if (!mat.userData.fixed) { mat.metalness = Math.min(mat.metalness, 0.35); mat.roughness = Math.max(mat.roughness, 0.45); mat.userData.fixed = true; }
      return mat;
    }
    if (/team/i.test(mat.name) && teamColor) { if (uniqueTeam) { const t = mat.clone(); t.color = teamColor.clone(); uniqueTeam.push(t); return t; } return this.tint(mat, teamColor); }
    return mat;
  }
  // returns { root, mixer, actions, height, teamMats } or null
  instance(key, level, teamColor, opts) {
    opts = opts || {};
    const p = (opts.far && this.far[key]) || this.protos[key]; if (!p) return null;
    const gltf = p[(level || 1) - 1] || p[0], e = this.entries[key] || {};
    const root = SkeletonUtils.clone(gltf.scene), teamMats = opts.uniqueTeam ? [] : null;
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = !!opts.shadow; o.receiveShadow = false; o.frustumCulled = !o.isSkinnedMesh;
      if (Array.isArray(o.material)) o.material = o.material.map(m => this.fixMat(m, teamColor, teamMats));
      else if (o.material) o.material = this.fixMat(o.material, teamColor, teamMats);
    });
    const holder = new THREE.Group(); holder.add(root);
    // measure in the Idle pose; the manifest height wins when the model disagrees by more than 15%
    let mixer = null, actions = {};
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(root);
      const names = Object.assign({ idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Attack', death: 'Death', ability: 'Ability' }, e.clips || {});
      for (const st in names) {
        const clip = THREE.AnimationClip.findByName(gltf.animations, names[st]) || gltf.animations.find(a => a.name.toLowerCase() === String(names[st]).toLowerCase());
        if (clip) { const a = mixer.clipAction(clip); if (st === 'death' || st === 'ability') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } actions[st] = a; }
      }
    }
    const want = this.entryHeight(key, level);
    let pc = this.protoMeasure(key + (opts.far ? '~far' : ''), level, gltf);
    // the manifest heights are measured from the files, so trust the file scale. Flying units (bat) keep their own
    // hover (minY); siege engines move parts in their clips, so their animated bbox is never used for fitting.
    const s = e.scale || 1;
    root.scale.multiplyScalar(s);
    const trustY = e.flying || e.minY !== undefined || e.type === 'siege';
    if (!trustY && Math.abs(pc.minY) > 0.05) { root.position.y = -pc.minY * s; this.note(key + (level ? '_l' + level : '') + ': feet ' + pc.minY.toFixed(2) + ' m off the ground (corrected)'); }
    if (want && pc.h > 0 && e.type !== 'siege' && !e.flying && Math.abs(pc.h / want - 1) > 0.15) this.note(key + (level ? '_l' + level : '') + ': height ' + pc.h.toFixed(2) + ' m vs manifest ' + want);
    const top = (want || pc.h * s) + (e.flying ? (e.minY || 0) * s : 0);
    return { root: holder, mixer, actions, teamMats, height: top, flying: !!e.flying, far: !!opts.far, footprint: [pc.w * s, pc.d * s] };
  }
  note(t) { this.notes = this.notes || []; if (!this.notes.includes(t)) this.notes.push(t); }
  protoMeasure(key, level, gltf) {
    const k = key + (level || 1); if (this.propCache[k]) return this.propCache[k];
    const c = SkeletonUtils.clone(gltf.scene);
    if (gltf.animations && gltf.animations.length) { const mx = new THREE.AnimationMixer(c); const cl = THREE.AnimationClip.findByName(gltf.animations, 'Idle') || gltf.animations[0]; mx.clipAction(cl).play(); mx.update(0.4); }
    c.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(c, true);
    return (this.propCache[k] = { h: b.max.y - b.min.y, minY: b.min.y, w: b.max.x - b.min.x, d: b.max.z - b.min.z });
  }
  // static props: geometry with node transforms baked in, for InstancedMesh
  propParts(key) {
    const p = this.far[key] || this.protos[key]; if (!p || !p[0]) return null; // scenery: the cheap model when there is one
    const out = []; p[0].scene.updateMatrixWorld(true);
    p[0].scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); out.push({ geo: g, mat: this.fixMat(o.material) }); } });
    return out;
  }
  terrainURL(k) { const t = this.terrain[k]; return t && t.map ? t.root + t.map : null; }
}
