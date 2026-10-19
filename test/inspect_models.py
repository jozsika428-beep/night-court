# Loads every model in art3d/manifest.json in headless Chrome and reports real size, feet height, centre offset, clips.
import json, sys
from playwright.sync_api import sync_playwright
URL = 'http://localhost:8765/index.html?2d=1'
JS = """async () => {
  const THREE = await import('three'); const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const m = await (await fetch('art3d/manifest.json')).json(); const L = new GLTFLoader(); const out = {};
  for (const k in m) { const e = m[k]; const files = e.levels ? e.levels.map(f => (e.dir || '') + f) : (e.file ? [e.file] : []);
    for (let i = 0; i < files.length; i++) { const g = await L.loadAsync('art3d/' + files[i]); const root = g.scene;
      let mixer; if (g.animations.length) { mixer = new THREE.AnimationMixer(root); const c = THREE.AnimationClip.findByName(g.animations, 'Idle') || g.animations[0]; mixer.clipAction(c).play(); mixer.update(0.4); }
      root.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(root, true); const mats = new Set(); let skinned = 0;
      root.traverse(o => { if (o.isMesh) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => mats.add(x.name + (x.vertexColors ? '' : '!novc'))); if (o.isSkinnedMesh) skinned++; } });
      out[files[i]] = { key: k, h: +(b.max.y - b.min.y).toFixed(2), minY: +b.min.y.toFixed(2), cx: +((b.min.x + b.max.x) / 2).toFixed(2), cz: +((b.min.z + b.max.z) / 2).toFixed(2), w: +(b.max.x - b.min.x).toFixed(2), d: +(b.max.z - b.min.z).toFixed(2), want: Array.isArray(e.height) ? e.height[i] : e.height, clips: g.animations.map(a => a.name + ':' + a.duration.toFixed(2)).join(' '), mats: [...mats].join(','), skinned };
    } }
  return out; }"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(); pg.goto(URL); pg.wait_for_timeout(500)
    pg.add_script_tag(content='{"imports":{"three":"./vendor/three/three.module.min.js","three/addons/":"./vendor/three/addons/"}}', type='importmap') if False else None
    r = pg.evaluate(JS)
    json.dump(r, open('/tmp/model_inspect.json', 'w'), indent=1)
    for f, v in r.items(): print(f, json.dumps(v))
    b.close()
