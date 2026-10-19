// Three.js view of the game. Reads the sim every frame; never changes game rules.
import * as THREE from 'three';
import { S } from './camera3d.js';
import { unitGeometry, buildingGeometry, outpostGeometry, PROPS, ModelLib, TEAM } from './models3d.js';

export const UNIT_VIS = 1.6;    // units drawn 60% larger than life so they read on a phone screen
const WATER_Y = -0.12;
const _o = new THREE.Object3D(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Color(), _m = new THREE.Matrix4();
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class World3D {
  constructor(canvas, cam, NC, gfx) {
    this.NC = NC; this.cam = cam; this.gfx = gfx; this.high = gfx === 'high'; this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: this.high, powerPreference: 'high-performance', alpha: false });
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.high ? 2 : 1.5));
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.shadowMap.enabled = this.high; this.r.shadowMap.type = THREE.PCFShadowMap;
    this.models = new ModelLib('art3d/');
    this.modelsReady = this.models.load();
    this.raycaster = new THREE.Raycaster(); this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.frustum = new THREE.Frustum(); this.t = 0; this.fpsN = 0; this.fpsT = 0; this.fps = 0;
    const lam = (o) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true, flatShading: true }, o || {}));
    this.mat = { lit: lam(), glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      disc: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }),
      sel: new THREE.MeshBasicMaterial({ color: '#7dff7d', transparent: true, opacity: 0.95, depthWrite: false }),
      bar: new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true }),
      barBg: new THREE.MeshBasicMaterial({ color: '#000', depthTest: false, depthWrite: false, transparent: true, opacity: 0.75 }),
      proj: new THREE.MeshBasicMaterial({}), corpse: new THREE.MeshBasicMaterial({ color: '#2a0808', transparent: true, opacity: 0.6, depthWrite: false }) };
    this.labelCache = new Map();
  }

  resize() { const c = this.cam; this.r.setSize(c.vw, c.vh, false); }
  dispose() { this.r.dispose(); }

  // ground height in metres at a sim point: river bed is deep, fords are shallow
  height(x, y) {
    const W = this.NC.WORLD, inside = Math.min(y - W.riverTop, W.riverBot - y);
    let h = 0.18 * Math.sin(x * 0.011) * Math.cos(y * 0.008) + 0.1 * Math.sin(x * 0.031 + y * 0.017);
    if (inside > -40) {
      let ff = 0; for (const f of W.fords) { const d = Math.max(f.x1 - x, x - f.x2); ff = Math.max(ff, 1 - smooth(-10, 25, d)); }
      const depth = 1.7 * (1 - ff) + 0.32 * ff;
      h = h * (1 - smooth(-40, 0, inside)) - depth * smooth(-30, 25, inside);
    }
    return h;
  }

  setGame(g) {
    if (this.scene) { // free the previous match's big buffers (shared model geometry is kept)
      this.groundMesh.geometry.dispose(); this.groundTex.dispose(); this.water.geometry.dispose();
      this.plotRecs.forEach(r => { r.ring.geometry.dispose(); r.fill.geometry.dispose(); });
      this.r.renderLists.dispose();
    }
    this.g = g; const NC = this.NC, W = NC.WORLD, high = this.high;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#7d8c96'); scene.fog = new THREE.Fog('#7d8c96', 120, 420);
    this.hemi = new THREE.HemisphereLight('#bcd4ff', '#3a3020', 1.1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.4); scene.add(this.sun); scene.add(this.sun.target);
    if (high) { const sc = this.sun.shadow; this.sun.castShadow = true; sc.mapSize.set(1024, 1024); sc.camera.near = 1; sc.camera.far = 260; sc.bias = -0.0008; sc.normalBias = 0.05; }
    // terrain
    const segX = high ? 160 : 80, segY = high ? 240 : 120;
    const geo = new THREE.PlaneGeometry(W.w * S, W.h * S, segX, segY); geo.rotateX(-Math.PI / 2); geo.translate(W.w * S / 2, 0, W.h * S / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, this.height(pos.getX(i) / S, pos.getZ(i) / S));
    geo.computeVertexNormals();
    this.groundTex = new THREE.CanvasTexture(this.paintGround(false));
    this.groundTex.colorSpace = THREE.SRGBColorSpace; this.groundTex.anisotropy = high ? 4 : 1;
    this.groundMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this.groundTex }));
    this.groundMesh.receiveShadow = high; scene.add(this.groundMesh); this.groundArt = false;
    // water over the river band
    const wg = new THREE.PlaneGeometry(W.w * S, (W.riverBot - W.riverTop) * S + 8, high ? 64 : 1, high ? 6 : 1); wg.rotateX(-Math.PI / 2);
    wg.translate(W.w * S / 2, WATER_Y, (W.riverTop + W.riverBot) / 2 * S);
    this.water = new THREE.Mesh(wg, new THREE.MeshPhongMaterial({ color: '#1d4560', specular: '#9fc4e0', shininess: 90, transparent: true, opacity: 0.72, depthWrite: false }));
    this.water.renderOrder = 1; scene.add(this.water); this.waterBase = Float32Array.from(wg.attributes.position.array);
    this.buildProps();
    // instanced unit placeholders, one draw call per unit type
    this.inst = {}; this.instGlow = {};
    for (const k in NC.UNITS) {
      const ug = unitGeometry(k), cap = NC.UNITS[k].hero ? 2 : 60;
      const m = new THREE.InstancedMesh(ug.geo, this.mat.lit, cap); m.castShadow = high; m.count = 0; m.frustumCulled = false; scene.add(m); this.inst[k] = m;
      if (ug.glow) { const gm = new THREE.InstancedMesh(ug.glow, this.mat.glow, cap); gm.count = 0; gm.frustumCulled = false; scene.add(gm); this.instGlow[k] = gm; }
    }
    const ring = new THREE.RingGeometry(0.62, 0.82, 20); ring.rotateX(-Math.PI / 2);
    const mk = (geo, mat, cap, order) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; if (order) m.renderOrder = order; scene.add(m); return m; };
    this.discs = mk(ring, this.mat.disc, 220, 2); this.discs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(220 * 3), 3);
    this.sels = mk(ring, this.mat.sel, 120, 3);
    const bar = new THREE.PlaneGeometry(1, 1); bar.translate(0.5, 0, 0);
    this.barsBg = mk(bar, this.mat.barBg, 200, 10); this.bars = mk(bar, this.mat.bar, 200, 11);
    this.bars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(200 * 3), 3);
    const arrow = new THREE.BoxGeometry(0.07, 0.07, 1.0), ball = new THREE.IcosahedronGeometry(0.38, 0);
    this.arrows = mk(arrow, this.mat.proj, 200); this.arrows.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(200 * 3), 3);
    this.balls = mk(ball, this.mat.proj, 40); this.balls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(40 * 3), 3);
    const cg = new THREE.CircleGeometry(0.7, 8); cg.rotateX(-Math.PI / 2); this.corpses = mk(cg, this.mat.corpse, 160, 2);
    // per-entity records
    this.urec = new Map(); this.brec = new Map(); this.dying = []; this.models3 = [];
    this.bRoots = [];
    this.plotRecs = g.plots.map(p => this.makePlot(p));
    this.opRecs = g.outposts.map(o => this.makeOutpost(o));
    this.fxPool = [];
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd700', transparent: true, depthWrite: false }));
    this.rangeRing = new THREE.Mesh(this.selRing.geometry, new THREE.MeshBasicMaterial({ color: '#ffd700', transparent: true, opacity: 0.3, depthWrite: false }));
    scene.add(this.selRing, this.rangeRing);
    this.miniBg = null;
    this.modelsReady.then(() => { this.modelVer = -1; });
  }

  paintGround(art) {
    const NC = this.NC, W = NC.WORLD, g = this.g, A = NC.Assets, q = this.high ? 1 : 0.5;
    const cv = document.createElement('canvas'); cv.width = W.w * q; cv.height = W.h * q;
    const x = cv.getContext('2d'); x.scale(q, q);
    const rnd = NC.util.rng(7);
    const pat = (k) => { const i = art && A.sprite(k); return i ? x.createPattern(i, 'repeat') : null; };
    const grass = pat('tile_grass'), mud = pat('tile_mud'), ford = pat('tile_ford');
    x.fillStyle = grass || '#2c3a26'; x.fillRect(0, 0, W.w, W.h);
    x.fillStyle = 'rgba(8,14,10,0.22)'; x.fillRect(0, 0, W.w, W.h);
    for (let i = 0; i < 260; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(60,75,45,0.18)' : 'rgba(8,12,8,0.2)'; x.beginPath(); x.arc(rnd() * W.w, rnd() * W.h, 15 + rnd() * 50, 0, 7); x.fill(); }
    const fm = (W.riverTop + W.riverBot) / 2;
    x.strokeStyle = mud || '#5a4a36'; x.globalAlpha = 0.85; x.lineWidth = 34; x.lineCap = 'round';
    g.map.fortress.forEach(f => W.fords.forEach(fd => { x.beginPath(); x.moveTo(f.x, f.y); x.quadraticCurveTo((f.x + fd.x1 + fd.x2) / 3, (f.y + fm) / 2, (fd.x1 + fd.x2) / 2, fm); x.stroke(); }));
    g.outposts.forEach(o => { if (o.type === 'shrine') return; const f = g.map.fortress[o.y > fm ? 0 : 1]; x.beginPath(); x.moveTo(f.x, f.y); x.lineTo(o.x, o.y); x.stroke(); });
    x.fillStyle = mud || '#5a4a36'; x.globalAlpha = 0.6;
    g.map.fortress.forEach(f => { x.beginPath(); x.ellipse(f.x, f.y, 340, 250, 0, 0, 7); x.fill(); });
    g.outposts.forEach(o => { x.beginPath(); x.arc(o.x, o.y, 90, 0, 7); x.fill(); });
    x.globalAlpha = 1;
    // river bed (under the water) and the shallow fords
    x.fillStyle = '#1e2620'; x.fillRect(0, W.riverTop - 6, W.w, W.riverBot - W.riverTop + 12);
    x.fillStyle = 'rgba(70,60,40,0.6)'; x.fillRect(0, W.riverTop - 26, W.w, 20); x.fillRect(0, W.riverBot + 6, W.w, 20);
    W.fords.forEach(fd => { x.fillStyle = ford || '#6a6a52'; x.fillRect(fd.x1 - 10, W.riverTop - 20, fd.x2 - fd.x1 + 20, W.riverBot - W.riverTop + 40); });
    return cv;
  }

  buildProps() {
    const NC = this.NC, W = NC.WORLD, g = this.g, rnd = NC.util.rng(42), list = { pine: [], oak: [], dead: [], rock: [], reed: [] };
    const keep = [].concat(g.map.fortress.map(f => ({ x: f.x, y: f.y, r: 400 })), g.outposts.map(o => ({ x: o.x, y: o.y, r: 150 })));
    for (let i = 0; i < 300; i++) {
      const tx = rnd() * W.w, ty = rnd() * W.h;
      if (ty > W.riverTop - 40 && ty < W.riverBot + 40) continue;
      if (keep.some(k => (k.x - tx) ** 2 + (k.y - ty) ** 2 < k.r * k.r)) continue;
      if (Math.abs(tx - 800) < 120 || (tx > 120 && tx < 420 && Math.abs(ty - 1200) < 380) || (tx > 1180 && tx < 1480 && Math.abs(ty - 1200) < 380)) continue;
      const k = rnd(); list[k < 0.5 ? 'pine' : k < 0.82 ? 'oak' : k < 0.92 ? 'dead' : 'rock'].push([tx, ty, 0.8 + rnd() * 0.6, rnd() * 6.3]);
    }
    for (let i = 0; i < 120; i++) { const rx = rnd() * W.w; if (NC.util.fordAt(rx)) continue; list.reed.push([rx, rnd() < 0.5 ? W.riverTop - 4 - rnd() * 12 : W.riverBot + 4 + rnd() * 12, 0.8 + rnd() * 0.7, rnd() * 6]); }
    W.fords.forEach(fd => { for (let i = 0; i < 6; i++) list.rock.push([fd.x1 + 20 + rnd() * (fd.x2 - fd.x1 - 40), W.riverTop + 15 + rnd() * (W.riverBot - W.riverTop - 30), 0.35 + rnd() * 0.3, rnd() * 6]); });
    for (const k in list) {
      const arr = list[k]; if (!arr.length) continue;
      const m = new THREE.InstancedMesh(PROPS[k], this.mat.lit, arr.length);
      arr.forEach((p, i) => { _o.position.set(p[0] * S, this.height(p[0], p[1]) - 0.05, p[1] * S); _o.rotation.set(0, p[3], 0); _o.scale.setScalar(p[2]); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); });
      m.castShadow = this.high && k !== 'reed'; m.receiveShadow = false; this.scene.add(m);
    }
  }

  label(text, color) {
    const key = text + '|' + (color || '');
    let mat = this.labelCache.get(key);
    if (!mat) {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const x = cv.getContext('2d');
      x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = 'rgba(0,0,0,0.85)';
      x.strokeText(text, 256, 50); x.fillStyle = color || '#fff'; x.fillText(text, 256, 50);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
      this.labelCache.set(key, mat);
    }
    const s = new THREE.Sprite(mat); s.renderOrder = 12; s.scale.set(6, 1.125, 1); return s;
  }

  makePlot(p) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(p.r * S - 0.35, p.r * S, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    const plus = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 0.45), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    const plus2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 1.8), plus.material); plus.add(plus2);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(p.r * S - 0.35, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
    const h = this.height(p.x, p.y) + 0.06;
    ring.position.set(p.x * S, h, p.y * S); fill.position.copy(ring.position); plus.position.set(p.x * S, h + 0.3, p.y * S);
    ring.renderOrder = fill.renderOrder = 2;
    this.scene.add(ring, plus, fill);
    return { p, ring, plus, fill };
  }

  makeOutpost(o) {
    const grp = new THREE.Group(), og = outpostGeometry(o.type), h = this.height(o.x, o.y);
    const deco = new THREE.Mesh(og.geo, this.mat.lit); deco.castShadow = this.high; grp.add(deco);
    if (og.glow) { const gm = new THREE.Mesh(og.glow, this.mat.glow); grp.add(gm); grp.userData.crystal = o.type === 'shrine' ? gm : null; }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 6), new THREE.MeshLambertMaterial({ color: '#2a2a2a' })); pole.position.set(6.5, 3, 2); grp.add(pole);
    const flagMat = new THREE.MeshLambertMaterial({ color: '#999', side: THREE.DoubleSide });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3, 4, 1), flagMat); flag.position.set(7.6, 5.2, 2); grp.add(flag);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#999', transparent: true, opacity: 0.45, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(o.r * S - 0.3, o.r * S, 64).rotateX(-Math.PI / 2), ringMat); ring.position.y = 0.08; ring.renderOrder = 2; grp.add(ring);
    const arcMat = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
    const arc = new THREE.Mesh(new THREE.BufferGeometry(), arcMat); arc.position.y = 0.1; arc.renderOrder = 3; grp.add(arc);
    const lbl = this.label(o.name + (o.type === 'shrine' ? ' (+15%)' : ''), '#eee'); lbl.position.set(0, 7.5, 0); lbl.scale.set(9, 1.7, 1); grp.add(lbl);
    grp.position.set(o.x * S, o.type === 'shrine' ? Math.max(h, -0.3) : h, o.y * S);
    this.scene.add(grp);
    return { o, grp, flag, flagMat, ringMat, arc, arcMat, lastV: 99 };
  }

  makeBuilding(b) {
    const grp = new THREE.Group(), fac = this.NC.BUILDINGS[b.type].faction, lvl = b.def.role === 'fortress' ? 3 : b.level;
    let height;
    const mi = this.models.has(b.type, lvl) && this.models.instance(b.type, lvl, TEAM[this.g.sides[b.owner].faction]);
    if (mi) { grp.add(mi.root); height = mi.height; grp.userData.lvlScale = 1; }
    else {
      const bg = buildingGeometry(this.NC, b.type, lvl);
      const m = new THREE.Mesh(bg.geo, this.mat.lit); m.castShadow = this.high; m.receiveShadow = this.high; grp.add(m);
      if (bg.glow) grp.add(new THREE.Mesh(bg.glow, this.mat.glow));
      if (bg.blades) { const bl = new THREE.Mesh(bg.blades, this.mat.lit); bl.position.set(1.4, 4.2, 2.95); grp.add(bl); grp.userData.blades = bl; }
      height = bg.height; grp.userData.lvlScale = b.def.role === 'fortress' ? 1 : [0.8, 0.9, 1][b.level - 1];
    }
    const sc = b.r * S / (b.def.role === 'fortress' ? 6.2 : 3.6); // fit the footprint to the sim radius
    grp.userData.baseScale = sc * grp.userData.lvlScale;
    const stars = b.def.role === 'fortress' ? '' : ' ' + '★'.repeat(b.level);
    const lbl = this.label((this.NC.Assets.map[b.type] && this.NC.Assets.map[b.type].label || b.def.name) + stars, b.owner === this.g.player ? '#fff' : '#ffd0a0');
    lbl.position.set(0, height + 1.8, 0); lbl.scale.set(8, 1.5, 1); grp.add(lbl); grp.userData.label = lbl;
    grp.position.set(b.x * S, this.height(b.x, b.y), b.y * S);
    grp.traverse(o => { o.userData.entId = b.id; });
    this.scene.add(grp);
    return { grp, key: b.type + b.level + (mi ? 'm' : 'p'), height: height * grp.userData.baseScale, seen: 0 };
  }

  makeUnitModel(u) {
    const mi = this.models.instance(u.type, 1, TEAM[this.g.sides[u.owner].faction]); if (!mi) return null;
    mi.root.scale.setScalar(UNIT_VIS); this.scene.add(mi.root);
    mi.state = null; return mi;
  }
  playState(mi, st) {
    if (mi.state === st || !mi.mixer) return;
    const next = mi.actions[st] || (st === 'run' && mi.actions.walk) || mi.actions.idle; if (!next) return;
    const prev = mi.state && (mi.actions[mi.state] || (mi.state === 'run' && mi.actions.walk) || mi.actions.idle);
    next.reset().play(); if (prev && prev !== next) prev.crossFadeTo(next, 0.2, false);
    mi.state = st;
  }

  // ---------- per-frame ----------
  draw(ui) {
    const g = this.g, NC = this.NC, cam = this.cam, now = performance.now() / 1000, dt = Math.min(0.1, this.last ? now - this.last : 0.016); this.last = now; this.t += dt;
    this.fpsN++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.fpsN / this.fpsT; this.fpsN = 0; this.fpsT = 0; }
    cam.apply(dt);
    this.frustum.setFromProjectionMatrix(_m.multiplyMatrices(cam.cam.projectionMatrix, cam.cam.matrixWorldInverse));
    if (!this.groundArt && NC.Assets.loaded && NC.Assets.allReady(['tile_grass', 'tile_mud', 'tile_ford'])) { this.groundArt = true; if (NC.Assets.has('tile_grass')) { this.groundTex.image = this.paintGround(true); this.groundTex.needsUpdate = true; this.miniBg = null; } }
    if (this.modelVer !== this.models.version) { this.modelVer = this.models.version; this.rebuildModels(); }
    this.lighting();
    this.syncBuildings(ui); this.syncUnits(ui, dt); this.syncPlots(ui); this.syncOutposts(); this.syncProjectiles(); this.syncFx(); this.syncCorpses();
    if (this.high) { // gentle waves
      const p = this.water.geometry.attributes.position, b = this.waterBase;
      for (let i = 0; i < p.count; i++) p.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(b[i * 3] * 0.35 + this.t * 1.6) * 0.04 + Math.cos(b[i * 3 + 2] * 0.5 + this.t * 1.1) * 0.03;
      p.needsUpdate = true;
    }
    this.r.render(this.scene, cam.cam);
  }

  darkness() {
    const c = this.g.cycle(), n = this.NC.NIGHT_START, L = this.NC.DAY_LEN, fade = 15;
    if (c >= n + fade && c <= L - fade) return 1; if (c >= n && c < n + fade) return (c - n) / fade; if (c > L - fade) return (L - c) / fade; return 0;
  }
  lighting() {
    const dk = this.darkness(), cam = this.cam, tx = cam.x * S, tz = cam.y * S;
    this.sun.color.set('#fff1d6').lerp(_c.set('#8fa8ff'), dk); this.sun.intensity = 3.0 - 1.6 * dk;
    this.hemi.color.set('#cfe0ff').lerp(_c.set('#5a6aa8'), dk); this.hemi.groundColor.set('#4a4030').lerp(_c.set('#20182a'), dk); this.hemi.intensity = 1.5 - 0.3 * dk;
    const sky = this.scene.background.set('#8a98a2').lerp(_c.set('#141c34'), dk); this.scene.fog.color.copy(sky);
    const d = cam.dist(); this.scene.fog.near = d * 1.2; this.scene.fog.far = d * 3.5 + 80;
    // sun from the south-east by day, moon from the north-west by night
    const sx = dk > 0.5 ? -40 : 50, sz = dk > 0.5 ? -30 : 40;
    this.sun.position.set(tx + sx, 80, tz + sz); this.sun.target.position.set(tx, 0, tz); this.sun.target.updateMatrixWorld();
    if (this.high) { const sc = this.sun.shadow.camera, e = Math.min(90, d * 0.9); sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.updateProjectionMatrix(); }
    this.water.material.color.set('#1d4560').lerp(_c.set('#0a1a2c'), dk);
  }

  rebuildModels() {
    for (const [id, r] of this.brec) { this.scene.remove(r.grp); } this.brec.clear();
    for (const [id, r] of this.urec) if (r.mi) { this.scene.remove(r.mi.root); r.mi = null; }
  }

  syncBuildings(ui) {
    const g = this.g, frame = (this.frame = (this.frame || 0) + 1);
    let selB = null;
    for (const b of g.buildings) {
      let r = this.brec.get(b.id);
      const key = b.type + b.level + (this.models.has(b.type, b.def.role === 'fortress' ? 3 : b.level) ? 'm' : 'p');
      if (r && r.key !== key) { this.scene.remove(r.grp); r = null; }
      if (!r) { r = this.makeBuilding(b); this.brec.set(b.id, r); }
      r.seen = frame;
      const s = r.grp.userData.baseScale; r.grp.scale.set(s, s * (b.built < 1 ? 0.15 + 0.85 * b.built : 1), s);
      if (r.grp.userData.blades) r.grp.userData.blades.rotation.z += 0.02;
      r.grp.userData.label.scale.y = 1.5 / (r.grp.scale.y / s);
      if (ui && ui.sel.buildingId === b.id) selB = b;
    }
    for (const [id, r] of this.brec) if (r.seen !== frame) { this.scene.remove(r.grp); this.brec.delete(id); }
    this.bRoots = Array.from(this.brec.values()).map(r => r.grp);
    this.selRing.visible = !!selB; this.rangeRing.visible = !!(selB && selB.def.attack);
    if (selB) {
      const y = this.height(selB.x, selB.y) + 0.12, rr = (selB.r + 10) * S;
      this.selRing.position.set(selB.x * S, y, selB.y * S); this.selRing.scale.setScalar(rr); this.selRing.material.opacity = 0.6 + 0.3 * Math.sin(this.t * 6);
      if (selB.def.attack) { this.rangeRing.position.copy(this.selRing.position); this.rangeRing.scale.setScalar(selB.def.attack.range * S); }
    }
  }

  syncUnits(ui, dt) {
    const g = this.g, NC = this.NC, cam = this.cam.cam, frame = this.frame, sel = ui ? ui.sel.units : null;
    const counts = {}, gcounts = {}; for (const k in this.inst) { counts[k] = 0; gcounts[k] = 0; }
    let nd = 0, ns = 0, nb = 0;
    const camQ = cam.quaternion, right = _v2.set(1, 0, 0).applyQuaternion(camQ);
    const sideCol = g.sides.map(s => TEAM[s.faction]);
    const bar = (x, y, z, w, f, col) => {
      if (nb >= 200) return;
      _o.position.set(x - right.x * w / 2, y, z - right.z * w / 2); _o.quaternion.copy(camQ);
      _o.scale.set(w + 0.12, 0.26, 1); _o.position.addScaledVector(right, -0.06); _o.updateMatrix(); this.barsBg.setMatrixAt(nb, _o.matrix);
      _o.position.addScaledVector(right, 0.06); _o.scale.set(w * Math.max(0, f), 0.15, 1); _o.updateMatrix(); this.bars.setMatrixAt(nb, _o.matrix); this.bars.setColorAt(nb, _c.set(col)); nb++;
    };
    const place = (type, X, Y, Z, rotY, tilt, scale) => {
      const m = this.inst[type]; if (!m || counts[type] >= m.instanceMatrix.count) return;
      _o.position.set(X, Y, Z); _o.rotation.set(tilt, rotY, 0, 'YXZ'); _o.scale.setScalar(scale); _o.updateMatrix();
      m.setMatrixAt(counts[type]++, _o.matrix);
      const gm = this.instGlow[type]; if (gm) gm.setMatrixAt(gcounts[type]++, _o.matrix);
    };
    for (const u of g.units) {
      let r = this.urec.get(u.id);
      if (!r) { r = { id: u.id, type: u.type, rot: Math.PI / 2 - u.face, mi: null, owner: u.owner, hero: u.hero, label: null }; this.urec.set(u.id, r); }
      r.seen = frame; r.x = u.x; r.y = u.y;
      const want = Math.PI / 2 - u.face; let d = want - r.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); r.rot += d * Math.min(1, dt * 10);
      const gh = this.height(u.x, u.y), X = u.x * S, Z = u.y * S;
      let Y = Math.max(gh, -0.38);
      if (u.flying) Y = Math.max(0, gh) + 4 + Math.sin(this.t * 3 + u.id) * 0.4;
      if (u.hop) Y += u.hop * S * 3;
      const sc = UNIT_VIS * (u.hero ? 1.12 : 1);
      const vis = this.frustum.containsPoint(_v.set(X, Y + 1, Z));
      // model or placeholder
      if (!r.mi && this.models.has(u.type)) r.mi = this.makeUnitModel(u);
      let height;
      if (r.mi) {
        r.mi.root.position.set(X, Y, Z); r.mi.root.rotation.y = r.rot; r.mi.root.visible = vis;
        const st = u.leap ? 'ability' : (u.swing > 0 || (u.tgt && u.cd > u.def.cd - 0.35 && !u.moving)) ? 'attack' : u.moving ? (u.def.speed > 85 ? 'run' : 'walk') : 'idle';
        this.playState(r.mi, st);
        if (vis && r.mi.mixer) r.mi.mixer.update(dt);
        height = r.mi.height * UNIT_VIS;
      } else {
        let bob = 0, lunge = 0;
        if (u.moving && !u.flying) bob = Math.abs(Math.sin(this.t * 11 + u.id)) * 0.14;
        if (u.swing > 0) lunge = 0.35;
        const fx = Math.sin(r.rot) * lunge, fz = Math.cos(r.rot) * lunge;
        if (vis) place(u.type, X + fx, Y + bob, Z + fz, r.rot, u.swing > 0 ? 0.25 : 0, sc);
        height = unitGeometry(u.type).height * sc;
      }
      if (!vis) { if (r.label) r.label.visible = false; continue; }
      // team disc, selection ring, health bar, hero name
      if (nd < 220) { _o.position.set(X, Math.max(gh, -0.38) + 0.05, Z); _o.rotation.set(0, 0, 0); _o.scale.setScalar(u.r * S * 1.0 * (u.hero ? 1.2 : 1)); _o.updateMatrix(); this.discs.setMatrixAt(nd, _o.matrix); this.discs.setColorAt(nd, sideCol[u.owner]); nd++; }
      if (sel && sel.has(u.id) && ns < 120) { _o.position.set(X, Math.max(gh, -0.38) + 0.07, Z); _o.scale.setScalar(u.r * S * 1.35 * (u.hero ? 1.2 : 1)); _o.updateMatrix(); this.sels.setMatrixAt(ns++, _o.matrix); }
      if (u.hp < u.maxHp || u.hero) bar(X, Y + height + 0.45, Z, u.hero ? 2.2 : 1.3, u.hp / u.maxHp, u.owner === g.player ? '#5d5' : '#e44');
      if (u.hero) {
        if (!r.label) { r.label = this.label(u.def.name.split(' ').pop(), u.owner === g.player ? '#ffd0d8' : '#fff0b0'); r.label.scale.set(5.5, 1.03, 1); this.scene.add(r.label); }
        r.label.visible = true; r.label.position.set(X, Y + height + 1.3, Z);
      }
    }
    // units that just died: play Death, or tip the placeholder over and sink it
    for (const [id, r] of this.urec) {
      if (r.seen === frame) continue;
      this.urec.delete(id);
      if (r.label) this.scene.remove(r.label);
      this.dying.push({ r, t: 0 });
      if (r.mi) this.playState(r.mi, 'death');
    }
    this.dying = this.dying.filter(dd => {
      dd.t += dt; const r = dd.r;
      if (r.mi) { if (r.mi.mixer) r.mi.mixer.update(dt); if (!r.mi.actions.death) r.mi.root.position.y -= dt * 0.8; if (dd.t > 2.2) { this.scene.remove(r.mi.root); return false; } return true; }
      if (dd.t > 1.4) return false;
      const f = Math.min(1, dd.t / 0.5), X = r.x * S, Z = r.y * S, Y = Math.max(this.height(r.x, r.y), -0.38) - Math.max(0, dd.t - 0.6) * 1.2;
      if (this.frustum.containsPoint(_v.set(X, Y, Z))) place(r.type, X, Y, Z, r.rot, -f * Math.PI / 2, UNIT_VIS * (r.hero ? 1.12 : 1));
      return true;
    });
    for (const k in this.inst) { const m = this.inst[k]; m.count = counts[k]; m.instanceMatrix.needsUpdate = true; const gm = this.instGlow[k]; if (gm) { gm.count = gcounts[k]; gm.instanceMatrix.needsUpdate = true; } }
    // building bars
    for (const b of g.buildings) {
      if (nb >= 200) break;
      if (b.hp >= b.maxHp && b.built >= 1 && !b.queue.length) continue;
      const r = this.brec.get(b.id); if (!r) continue;
      const X = b.x * S, Z = b.y * S, Y = r.grp.position.y + r.height + 0.6;
      if (!this.frustum.containsPoint(_v.set(X, Y, Z))) continue;
      const w = b.r * S * 1.5;
      bar(X, Y, Z, w, b.hp / b.maxHp, b.owner === g.player ? '#5c5' : '#e44');
      if (b.built < 1) bar(X, Y - 0.35, Z, w, b.built, '#59f');
      else if (b.queue.length) bar(X, Y - 0.35, Z, w, b.trainT / NC.UNITS[b.queue[0]].time, '#fc4');
    }
    this.discs.count = nd; this.discs.instanceMatrix.needsUpdate = true; if (this.discs.instanceColor) this.discs.instanceColor.needsUpdate = true;
    this.sels.count = ns; this.sels.instanceMatrix.needsUpdate = true;
    this.bars.count = nb; this.barsBg.count = nb; this.bars.instanceMatrix.needsUpdate = true; this.barsBg.instanceMatrix.needsUpdate = true; if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true;
  }

  syncPlots(ui) {
    const g = this.g, me = g.player;
    for (const pr of this.plotRecs) {
      const p = pr.p, empty = !g.get(p.buildingId), mine = p.owner === me, selected = ui && ui.sel.plotId === p.id;
      pr.ring.visible = pr.fill.visible = empty; pr.plus.visible = empty && mine;
      if (!empty) continue;
      pr.ring.material.color.set(selected ? '#ffd700' : p.owner >= 0 ? (TEAM[g.sides[p.owner].faction]) : '#888');
      pr.ring.material.opacity = mine ? 0.95 : 0.35;
      if (pr.plus.visible) { pr.plus.position.y = this.height(p.x, p.y) + 0.5 + Math.sin(this.t * 3 + p.id) * 0.15; pr.plus.rotation.y = this.t * 0.8; }
    }
  }

  syncOutposts() {
    const g = this.g;
    for (const r of this.opRecs) {
      const o = r.o, col = o.owner >= 0 ? TEAM[g.sides[o.owner].faction] : _c.set('#9a9a9a');
      r.flagMat.color.copy(col); r.ringMat.color.copy(col);
      r.flag.rotation.y = Math.sin(this.t * 2 + o.id) * 0.25;
      if (r.grp.userData.crystal) { r.grp.userData.crystal.rotation.y = this.t; r.grp.userData.crystal.position.y = Math.sin(this.t * 2) * 0.25; }
      const v = Math.abs(o.v) < 1 ? o.v : 0;
      if (Math.abs(v - r.lastV) > 0.02) {
        r.lastV = v; r.arc.geometry.dispose();
        r.arc.geometry = Math.abs(v) > 0.01 ? new THREE.RingGeometry(o.r * S - 0.6, o.r * S + 0.1, 48, 1, Math.PI / 2, -Math.abs(v) * Math.PI * 2).rotateX(-Math.PI / 2) : new THREE.BufferGeometry();
        r.arcMat.color.copy(TEAM[g.sides[v > 0 ? 0 : 1].faction]);
      }
    }
  }

  syncProjectiles() {
    const g = this.g; let na = 0, nb = 0;
    for (const p of g.projectiles) {
      const tot = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, f = Math.min(1, Math.hypot(p.x - p.sx, p.y - p.sy) / tot);
      const big = p.kind === 'boulder' || p.kind === 'firebolt', arcH = big ? 6 : 1.2;
      const y = 1.4 + Math.sin(f * Math.PI) * arcH + this.height(p.x, p.y) * 0.5;
      _o.position.set(p.x * S, y, p.y * S);
      if (big && nb < 40) { _o.rotation.set(this.t * 4, this.t * 3, 0); _o.scale.setScalar(1); _o.updateMatrix(); this.balls.setMatrixAt(nb, _o.matrix); this.balls.setColorAt(nb, _c.set(p.kind === 'boulder' ? '#e0d8c0' : '#ff6a20')); nb++; }
      else if (na < 200) {
        const f2 = Math.min(1, f + 0.05), y2 = 1.4 + Math.sin(f2 * Math.PI) * arcH;
        _o.lookAt(_v.set((p.sx + (p.tx - p.sx) * f2) * S, y2, (p.sy + (p.ty - p.sy) * f2) * S)); _o.scale.setScalar(1); _o.updateMatrix();
        this.arrows.setMatrixAt(na, _o.matrix); this.arrows.setColorAt(na, _c.set(p.kind === 'spark' ? '#fff6a0' : p.kind === 'bolt' ? '#dfe8ff' : '#e8d8b0')); na++;
      }
    }
    this.arrows.count = na; this.balls.count = nb;
    this.arrows.instanceMatrix.needsUpdate = this.balls.instanceMatrix.needsUpdate = true;
    if (this.arrows.instanceColor) this.arrows.instanceColor.needsUpdate = true; if (this.balls.instanceColor) this.balls.instanceColor.needsUpdate = true;
  }

  syncCorpses() {
    let n = 0;
    for (const c of this.g.corpses) { if (n >= 160) break; _o.position.set(c.x * S, Math.max(this.height(c.x, c.y), -0.38) + 0.04, c.y * S); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1 - c.t / 12); _o.updateMatrix(); this.corpses.setMatrixAt(n++, _o.matrix); }
    this.corpses.count = n; this.corpses.instanceMatrix.needsUpdate = true;
  }

  syncFx() {
    const g = this.g; let i = 0;
    const get = (kind) => {
      let e = this.fxPool[i];
      if (!e || e.kind !== kind) {
        if (e) this.scene.remove(e.mesh);
        const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
        const geo = kind === 'ring' ? new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2) : new THREE.SphereGeometry(1, 12, 8);
        e = this.fxPool[i] = { kind, mesh: new THREE.Mesh(geo, mat) }; e.mesh.renderOrder = 5; this.scene.add(e.mesh);
      }
      i++; e.mesh.visible = true; return e.mesh;
    };
    for (const e of g.effects) {
      if (i >= 40) break;
      const f = e.t / e.dur, X = e.x * S, Z = e.y * S, Y = Math.max(this.height(e.x, e.y), -0.3);
      let m;
      if (e.type === 'ring' || e.type === 'move') { m = get('ring'); m.position.set(X, Y + 0.15, Z); m.scale.setScalar(e.type === 'move' ? 0.6 + f * 1.4 : e.r * S * (0.3 + 0.7 * f)); m.material.color.set(e.color || '#7f7'); m.material.opacity = 1 - f; }
      else if (e.type === 'flash' || e.type === 'boom') { m = get('sph'); m.position.set(X, Y + 0.5, Z); m.scale.setScalar(e.r * S * (0.4 + 0.6 * f)); m.scale.y *= 0.6; m.material.color.set(e.type === 'boom' ? '#ff9030' : e.color); m.material.opacity = 0.55 * (1 - f); }
      else if (e.type === 'heal') { m = get('sph'); m.position.set(X, Y + 2.4 + f * 1.2, Z); m.scale.setScalar(0.22); m.material.color.set('#80ff80'); m.material.opacity = 1 - f; }
    }
    for (let k = i; k < this.fxPool.length; k++) this.fxPool[k].mesh.visible = false;
  }

  // ---------- picking ----------
  ndc(sx, sy) { return new THREE.Vector2(sx / this.cam.vw * 2 - 1, -(sy / this.cam.vh) * 2 + 1); }
  groundPoint(sx, sy) {
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.cam.cam);
    const hit = this.raycaster.ray.intersectPlane(this.ground, _v); if (!hit) return null;
    return { x: hit.x / S, y: hit.z / S };
  }
  pickUnit(sx, sy) {
    let best = null, bd = 1e9; const p0 = {}, p1 = {};
    for (const u of this.g.units) {
      const r = this.urec.get(u.id); const hgt = (r && r.mi ? r.mi.height : unitGeometry(u.type).height) * UNIT_VIS;
      const base = u.flying ? 4 : Math.max(this.height(u.x, u.y), -0.38);
      this.cam.project(u.x, u.y, base, p0); this.cam.project(u.x, u.y, base + hgt, p1); if (p0.behind) continue;
      // distance from tap to the unit's screen-space body (feet to head)
      const vx = p1.x - p0.x, vy = p1.y - p0.y, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((sx - p0.x) * vx + (sy - p0.y) * vy) / l2));
      const dx = sx - (p0.x + vx * t), dy = sy - (p0.y + vy * t), d = Math.sqrt(dx * dx + dy * dy);
      const tol = Math.max(16, Math.sqrt(l2) * 0.45);
      if (d < tol && d < bd) { bd = d; best = u; }
    }
    return best;
  }
  pickBuilding(sx, sy) {
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.cam.cam);
    const hits = this.raycaster.intersectObjects(this.bRoots, true);
    for (const h of hits) { if (h.object.isSprite) continue; const id = h.object.userData.entId; const b = id && this.g.get(id); if (b) return b; }
    return null;
  }
  screenOf(x, y, h) { return this.cam.project(x, y, h || 1); }

  drawMinimap(mc) {
    const g = this.g, x = mc.getContext('2d'), s = mc.width / this.NC.WORLD.w;
    if (!this.miniBg) { const c = document.createElement('canvas'); c.width = mc.width; c.height = mc.height; const cx = c.getContext('2d'); cx.drawImage(this.groundTex.image, 0, 0, c.width, c.height); const W = this.NC.WORLD; cx.fillStyle = 'rgba(20,60,90,0.8)'; cx.fillRect(0, W.riverTop * s, c.width, (W.riverBot - W.riverTop) * s); cx.fillStyle = 'rgba(140,140,110,0.8)'; W.fords.forEach(f => cx.fillRect(f.x1 * s, W.riverTop * s, (f.x2 - f.x1) * s, (W.riverBot - W.riverTop) * s)); this.miniBg = c; }
    x.drawImage(this.miniBg, 0, 0);
    const cols = g.sides.map(sd => this.NC.FACTIONS[sd.faction].color);
    g.outposts.forEach(o => { x.fillStyle = o.owner >= 0 ? cols[o.owner] : '#aaa'; x.fillRect(o.x * s - 3, o.y * s - 3, 6, 6); });
    g.buildings.forEach(b => { x.fillStyle = cols[b.owner]; const r = b.def.role === 'fortress' ? 6 : 3; x.fillRect(b.x * s - r, b.y * s - r, r * 2, r * 2); });
    g.units.forEach(u => { x.fillStyle = u.owner === g.player ? '#ff5070' : '#ffe060'; x.fillRect(u.x * s - 1, u.y * s - 1, u.hero ? 3 : 2, u.hero ? 3 : 2); });
    // camera footprint on the ground
    const c = this.cam, pts = [[0, 0], [c.vw, 0], [c.vw, c.vh], [0, c.vh]].map(p => this.groundPoint(p[0], p[1]));
    if (pts.every(Boolean)) { x.strokeStyle = '#fff'; x.lineWidth = 1; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p.x * s, p.y * s) : x.moveTo(p.x * s, p.y * s)); x.closePath(); x.stroke(); }
  }
}
