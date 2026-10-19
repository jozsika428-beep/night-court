# 3D view check: headless Chrome with SwiftShader WebGL at phone sizes. Touch tap/drag/pinch, no console errors,
# fps with ~100 units, screenshots to screens/3d_*.png.  Usage: python3 test/browser3d_test.py [url] [gfx]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
GFX = sys.argv[2] if len(sys.argv) > 2 else 'low'
# models: std | hd (HD chosen in the menu; falls back to Standard while art3d_hd/ has no manifest) | hdfix (test fixture HD set with LOD/KTX2/meshopt)
MODELS = sys.argv[3] if len(sys.argv) > 3 else 'std'
if MODELS == 'hdfix': URL += ('&' if '?' in URL else '?') + 'hd=1&hdset=test/fixtures/hd/'
OUT = '/workspace/game/screens/'
PFX = '3d_b2_double_' if 'double=1' in URL else '3d_b2_'  # double=1: the artist's double-sided materials on Low (for comparison)
errors = []
ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

def step(pg, secs):
    pg.evaluate("(n) => { const g = NC_GAME, b = NC_BOT; for (let i = 0; i < n; i++) { b.update(1/30); g.update(1/30); } }", int(secs * 30))

def run(p, w, h, name):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    def con(m):
        if m.type not in ('error', 'warning') or 'GPU stall' in m.text or 'GL Driver' in m.text: return
        errors.append(f'{name} console.{m.type}: {m.text} {(m.location or {}).get("url", "")}')
    pg.on('console', con)
    pg.on('pageerror', lambda e: errors.append(f'{name} pageerror: {e}'))
    pg.on('requestfailed', lambda r: errors.append(f'{name} requestfailed: {r.url}'))
    pg.on('response', lambda r: r.status >= 400 and errors.append(f'{name} HTTP {r.status}: {r.url}'))
    pg.add_init_script(f"localStorage.setItem('nc_gfx', '{GFX}'); localStorage.setItem('nc_models', '{'hd' if MODELS != 'std' else 'std'}')")
    pg.goto(URL); pg.wait_for_timeout(1500)
    if name == 'portrait': pg.screenshot(path=OUT + '3d_menu_390x844.png')
    mtxt = pg.inner_text('#models').replace('\n', ' '); hd_dis = pg.evaluate("() => { const b = document.querySelector('[data-models=hd]'); return b ? b.disabled : null; }")
    print(name, 'models menu:', mtxt, '| HD disabled:', hd_dis)
    if MODELS == 'hd' and not hd_dis and 'coming soon' not in mtxt: print(name, '(HD set is available)')
    pg.tap('#play'); pg.wait_for_timeout(2500)
    view = pg.evaluate("() => NC_VIEW"); print(name, 'view:', view, 'gfx:', GFX)
    pg.wait_for_function("() => NC_WORLD.models.done", timeout=60000); pg.wait_for_timeout(500)
    ml = pg.evaluate("() => ({ loaded: Object.keys(NC_WORLD.models.protos).length, entries: Object.keys(NC_WORLD.models.entries).length, terrain: Object.keys(NC_WORLD.models.terrain).length, issues: NC_WORLD.models.issues })")
    print(name, 'models:', json.dumps(ml))
    hd = pg.evaluate("""() => { const M = NC_WORLD.models, src = Object.values(M.source); let ktx = 0, nrm = 0;
      for (const k of ['vael']) for (const p of [M.protos[k], M.far[k]]) if (p && p[0]) p[0].scene.traverse(o => { if (o.isMesh) { if (o.material.map && o.material.map.isCompressedTexture) ktx++; if (o.material.normalMap) nrm++; } });
      return { set: NC_WORLD.modelSet, hdKeys: src.filter(x => x === 'hd').length, stdKeys: src.filter(x => x === 'std').length, lodKeys: Object.keys(M.far), ktx2Maps: ktx, normalMaps: nrm }; }""")
    print(name, 'model set:', json.dumps(hd))
    if MODELS == 'hdfix' and (hd['set'] != 'hd' or hd['hdKeys'] != 3 or hd['ktx2Maps'] < 1): errors.append(name + ' HD fixture not used ' + json.dumps(hd))
    if MODELS == 'hdfix' and GFX == 'low' and (hd['lodKeys'] or hd['normalMaps']): errors.append(name + ' Low should use far models only, without normal maps')
    if MODELS == 'hdfix' and GFX == 'high' and (len(hd['lodKeys']) != 3 or hd['normalMaps'] < 1): errors.append(name + ' High should load near+far with normal maps')
    if MODELS != 'hdfix' and hd['set'] != 'std': errors.append(name + ' expected Standard set (HD not available yet)')
    if ml['issues'] or ml['loaded'] < ml['entries']: errors.append(name + ' model load issues ' + json.dumps(ml))
    if view != '3d': errors.append(name + ' did not start in 3D')
    # tap an empty plot (projected to screen) -> build menu -> build Crypt
    sp = pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM; const p = g.plots.filter(p => p.base && p.owner === 0)[4]; c.x = p.x; c.y = p.y - 40; c.clamp(); c.apply();
      const s = c.project(p.x, p.y, 0); return { x: s.x, y: s.y, id: p.id }; }""")
    pg.wait_for_timeout(300)
    pg.touchscreen.tap(sp['x'], sp['y']); pg.wait_for_timeout(500)
    menu_ok = 'Empty plot' in pg.inner_text('#panel')
    if menu_ok: pg.tap('[data-a="build"][data-v="crypt"]'); pg.wait_for_timeout(300)
    built = pg.evaluate("(id) => !!NC_GAME.get(NC_GAME.get(id).buildingId)", sp['id'])
    print(name, 'tap plot -> build menu:', menu_ok, '| Crypt built:', built)
    if not (menu_ok and built): errors.append(name + ' touch build flow failed')
    # tap the building (raycast) -> building panel
    bp = pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM, f = g.get(g.sides[0].fortressId); NC_UI.clear(); NC_UI.refresh(true); c.x = f.x; c.y = f.y - 30; c.clamp(); c.apply(); const s = c.project(f.x, f.y, 4); return s; }""")
    # wait for the view to settle: in headless SwiftShader the first frames on new models can stall long enough
    # (shader compile) that a tap is read as a long-press; one retry covers that
    for attempt in range(2):
        pg.wait_for_timeout(800); pg.touchscreen.tap(bp['x'], bp['y']); pg.wait_for_timeout(400)
        fort_ok = 'Fortress' in pg.inner_text('#panel')
        if fort_ok: break
        print(name, 'Fortress tap missed on attempt', attempt + 1)
    print(name, 'raycast tap on Fortress opens it:', fort_ok)
    if not fort_ok: errors.append(name + ' building raycast pick failed: ' + pg.inner_text('#panel')[:120].replace('\n', ' '))
    # drag to pan, pinch to zoom, twist to rotate (raw CDP touch events)
    cdp = ctx.new_cdp_session(pg)
    def touch(kind, pts): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    c0 = pg.evaluate("() => [NC_CAM.x, NC_CAM.y, NC_CAM.z, NC_CAM.yaw]")
    pg.evaluate("() => { NC_UI.clear(); NC_UI.refresh(true); }"); pg.wait_for_timeout(150)
    for attempt in range(2):  # one retry: a drag that starts on a unit can turn into a hold-select instead of a pan
        touch('touchStart', [(w/2, h/3)]); [touch('touchMove', [(w/2 + k*8, h/3 + k*12)]) for k in range(1, 9)]; touch('touchEnd', [])
        c1 = pg.evaluate("() => [NC_CAM.x, NC_CAM.y, NC_CAM.z, NC_CAM.yaw]")
        if c1[:2] != c0[:2]: break
        print(name, 'drag did not pan on attempt', attempt + 1); pg.wait_for_timeout(300)
    cx, cy = w/2, h/3
    touch('touchStart', [(cx-40, cy), (cx+40, cy)])
    for k in range(1, 9): touch('touchMove', [(cx-40-k*8, cy - k*3), (cx+40+k*8, cy + k*3)])
    touch('touchEnd', [])
    c2 = pg.evaluate("() => [NC_CAM.x, NC_CAM.y, NC_CAM.z, NC_CAM.yaw]")
    print(name, 'drag pans:', c1[:2] != c0[:2], '| pinch zooms:', round(c2[2]/c1[2], 2), '| twist rotates yaw:', round(c2[3]-c1[3], 2))
    if c1[:2] == c0[:2] or c2[2] <= c1[2]: errors.append(name + ' camera gestures failed')
    pg.evaluate("() => { NC_CAM.yaw = NC_CAM.yawTarget = 0; }")
    # play: build a base, recruit, fight at the middle ford
    pg.evaluate("""() => { const g = NC_GAME; g.sides[0].res = 4000; const pl = g.plots.filter(p => p.base && p.owner === 0);
      window.__b = { crypt: g.build(0, pl[1].id, 'crypt').id, den: g.build(0, pl[2].id, 'wolfden').id, farm: g.build(0, pl[0].id, 'bloodfarm').id, alt: g.build(0, pl[3].id, 'altar').id, tw: g.build(0, pl[5].id, 'ntower').id }; }""")
    step(pg, 20)
    pg.evaluate("""() => { const g = NC_GAME, B = window.__b; g.levelUp(0, B.crypt); g.levelUp(0, B.crypt); g.levelUp(0, B.farm); g.research(0, B.alt, 'melee');
      ['ghoul','ghoul','archer','thrall','catapult'].forEach(t => g.train(0, B.crypt, t)); ['werewolf','bat','werewolf'].forEach(t => g.train(0, B.den, t));
      g.summonHero(0, 'vael'); g.sides[0].res += 800; g.summonHero(0, 'grimfang'); }""")
    step(pg, 60)
    pg.evaluate("() => { const g = NC_GAME; g.orderUnits(0, g.units.filter(u => u.owner === 0).map(u => u.id), { type: 'amove', x: 800, y: 1420 }); }")
    step(pg, 25)
    pg.evaluate("""() => { const g = NC_GAME; ['knight','knight','torch','torch','torch','crossbow','crossbow','priest','ballista'].forEach((t, i) => { const u = g.spawnUnit(t, 1, 690 + i * 25, 1180); u.order = { type: 'amove', x: 800, y: 1400 }; });
      g.sides[1].res += 500; g.summonHero(1, 'ashen'); const a = g.units.find(u => u.type === 'ashen'); if (a) { a.x = 800; a.y = 1200; a.order = { type: 'amove', x: 800, y: 1400 }; } }""")
    pg.evaluate("(n) => { for (let i = 0; i < n; i++) NC_GAME.update(1/30); }", 70)
    pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM; const gf = g.units.find(u => u.type === 'grimfang'); if (gf) g.useAbility(0, gf.id, 0);
      NC_UI.selectArmy(); const ar = g.units.filter(u => u.owner === 0 && u.y < 1700); c.x = ar.reduce((a,u)=>a+u.x,0)/ar.length; c.y = ar.reduce((a,u)=>a+u.y,0)/ar.length + 20; c.z = 1.7; c.clamp(); }""")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT + f'{PFX}battle_{w}x{h}.png')
    # base in daylight
    pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM, f = g.get(g.sides[0].fortressId); NC_UI.clear(); g.t += (240 - g.cycle()) + 20; g.updateDayNight(); c.x = f.x; c.y = f.y - 60; c.z = 1.15; c.yaw = c.yawTarget = 0.35; c.clamp(); }""")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT + f'{PFX}base_{w}x{h}.png')
    # base at night: Glow parts should light up
    pg.evaluate("() => { const g = NC_GAME; g.t += (g.NC ? 0 : 0) + (NC.NIGHT_START + 40 - g.cycle()); g.updateDayNight(); }")
    pg.wait_for_timeout(1200)
    pg.screenshot(path=OUT + f'{PFX}night_{w}x{h}.png')
    # line-up of every unit + hero model in daylight, close camera: scale, facing, feet
    pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM; g.t += (NC.DAY_LEN - g.cycle()) + 30; g.updateDayNight();
      const T = ['ghoul','thrall','werewolf','archer','vael','grimfang','bat','catapult','crossbow','knight','priest','torch','ashen','ballista'];
      window.__line = T.map((t, i) => { const u = g.spawnUnit(t, i < 8 ? 0 : 1, 640 + (i < 8 ? i : i - 8) * 26, 1740 + (i < 8 ? 0 : 50)); u.order = { type: 'idle' }; u.face = Math.PI / 2; return u.id; });
      window.__upd = g.update; g.update = function () {};
      c.x = 730; c.y = 1760; c.z = 2.0; c.yaw = c.yawTarget = 0; c.clamp(); }""")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT + f'{PFX}lineup_{w}x{h}.png')
    # every unit swings: Attack pose (siege fire, bat), then building line-ups (3 levels per row), night + dawn
    pg.evaluate("() => { NC_GAME.units.forEach(u => { if (window.__line.includes(u.id)) u.swing = 9; }); }"); pg.wait_for_timeout(700)
    pg.screenshot(path=OUT + f'{PFX}lineup_attack_{w}x{h}.png')
    # siege + bat close-up from the side (facing: they should point at the camera's left = south)
    pg.evaluate("() => { const g = NC_GAME, c = NC_CAM; g.units.forEach(u => { if (window.__line.includes(u.id)) u.swing = 0; }); const s = g.units.filter(u => window.__line.includes(u.id) && /bat|catapult|ballista/.test(u.type)); g.units = g.units.filter(u => !window.__line.includes(u.id) || s.includes(u)); s.forEach((u, i) => { u.x = 1000 + i * 45; u.y = 1830; }); c.x = 1045; c.y = 1850; c.z = 2.8; c.yaw = c.yawTarget = 0.7; c.clamp(); }")
    pg.wait_for_timeout(1200)
    pg.screenshot(path=OUT + f'{PFX}siege_{w}x{h}.png')
    pg.evaluate("() => { const g = NC_GAME; g.units = g.units.filter(u => !window.__line.includes(u.id)); }")
    for fac, types in (('night', ['wolfden', 'altar', 'slaughter']), ('dawn', ['stables', 'forge', 'granary']), ('old', ['crypt', 'bloodfarm', 'ntower', 'barracks', 'mill', 'dtower'])):
        pg.evaluate("""([types]) => { const g = NC_GAME, c = NC_CAM; window.__bl = [];
          types.forEach((t, row) => [1, 2, 3].forEach(l => { const b = g.addBuilding(t, NC.BUILDINGS[t].faction === g.sides[0].faction ? 0 : 1, 560 + (l - 1) * 85 + (row >= 3 ? 290 : 0), 1660 + (row % 3) * 85, null, true); b.level = l; window.__bl.push(b.id); }));
          c.x = types.length > 3 ? 790 : 645; c.y = 1760; c.z = types.length > 3 ? 0.75 : 1.2; c.yaw = c.yawTarget = 0.3; c.clamp(); }""", [types])
        pg.wait_for_timeout(1800)
        pg.screenshot(path=OUT + f'{PFX}buildings_{fac}_{w}x{h}.png')
        pg.evaluate("() => { const g = NC_GAME; g.buildings = g.buildings.filter(b => !window.__bl.includes(b.id)); window.__bl.forEach(id => delete g.ents[id]); }")
    notes = pg.evaluate("() => NC_WORLD.models.notes || []"); print(name, 'model notes:', json.dumps(notes))
    pg.evaluate("() => { NC_GAME.update = window.__upd; }")
    if MODELS == 'hdfix' and GFX == 'high':
        # LOD: swap a ghoul without restarting its clip, then zoom in/out and count distance-based swaps
        lod = pg.evaluate("""() => new Promise(res => { const W = NC_WORLD, g = NC_GAME; g.update = window.__upd || g.update;
          const us = []; for (let i = 0; i < 6; i++) { const u = g.spawnUnit('ghoul', 0, 700 + i * 25, 1800); u.order = { type: 'idle' }; us.push(u); }
          const c = NC_CAM; c.x = 760; c.y = 1800; c.z = 0.5; c.clamp();
          setTimeout(() => { const s0 = W.lodSwaps || 0; const r = W.urec.get(us[0].id); const far0 = r.mi.far;
            const a = r.mi.actions[r.mi.state] || r.mi.actions.idle, t0 = a.time; W.swapUnitLOD(r, us[0], !r.mi.far); const b = r.mi.actions[r.mi.state] || r.mi.actions.idle;
            const keep = Math.abs(b.time - t0) < 0.02 && b.isRunning();
            c.z = 3.2; c.clamp(); setTimeout(() => { const nearNow = us.filter(u => { const q = W.urec.get(u.id); return q && q.mi && !q.mi.far; }).length;
              c.z = 0.5; c.clamp(); setTimeout(() => { const farNow = us.filter(u => { const q = W.urec.get(u.id); return q && q.mi && q.mi.far; }).length;
                res({ startedFar: far0, clipKeptTime: keep, t0: +t0.toFixed(3), t1: +b.time.toFixed(3), nearWhenZoomedIn: nearNow, farWhenZoomedOut: farNow, swaps: (W.lodSwaps || 0) - s0 }); }, 1200); }, 1200); }, 800); }) """)
        print(name, 'LOD:', json.dumps(lod))
        if not (lod['clipKeptTime'] and lod['nearWhenZoomedIn'] >= 4 and lod['farWhenZoomedOut'] >= 4): errors.append(name + ' LOD swap failed ' + json.dumps(lod))
    # stress: ~100 units on screen, measure fps from the render loop
    pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM; const types0 = ['ghoul','archer','thrall','werewolf','bat'], types1 = ['torch','crossbow','knight','priest'];
      let n0 = g.units.filter(u => u.owner === 0).length, n1 = g.units.filter(u => u.owner === 1).length;
      for (let i = 0; n0 < 50; i++, n0++) { const u = g.spawnUnit(types0[i % 5], 0, 600 + (i % 10) * 40, 1450 + Math.floor(i / 10) * 30); u.order = { type: 'amove', x: 800, y: 1300 }; }
      for (let i = 0; n1 < 50; i++, n1++) { const u = g.spawnUnit(types1[i % 4], 1, 600 + (i % 10) * 40, 1000 - Math.floor(i / 10) * 30); u.order = { type: 'amove', x: 800, y: 1400 }; }
      c.x = 800; c.y = 1260; c.z = 0.8; c.yaw = c.yawTarget = 0; c.clamp(); }""")
    pg.wait_for_timeout(2500)
    fps = pg.evaluate("""() => new Promise(r => { const W = NC_WORLD, R = W.r, orig = R.render.bind(R); let rt = 0, n = 0, t0 = 0, tot = 0; const od = W.draw.bind(W);
      R.render = (a, b) => { const t = performance.now(); orig(a, b); rt += performance.now() - t; n++; }; W.draw = (u) => { const t = performance.now(); od(u); tot += performance.now() - t; };
      setTimeout(() => { R.render = orig; W.draw = od; r({ fps: Math.round(W.fps * 10) / 10, units: NC_GAME.units.length, calls: R.info.render.calls, tris: R.info.render.triangles, js_ms: Math.round((tot - rt) / n * 10) / 10, gl_ms: Math.round(rt / n * 10) / 10 }); }, 3000); })""")
    print(name, 'stress', json.dumps(fps))
    pg.screenshot(path=OUT + f'{PFX}stress_{w}x{h}.png')
    # classic 2D fallback still loads
    pg2 = ctx.new_page(); pg2.on('pageerror', lambda e: errors.append(f'{name} 2d pageerror: {e}'))
    pg2.goto(URL.split('?')[0] + '?2d=1'); pg2.wait_for_timeout(800); pg2.tap('#play'); pg2.wait_for_timeout(1500)
    v2 = pg2.evaluate("() => NC_VIEW"); print(name, '?2d=1 fallback view:', v2)
    if v2 != '2d': errors.append(name + ' 2d fallback failed')
    b.close()

with sync_playwright() as p:
    run(p, 390, 844, 'portrait')
    run(p, 844, 390, 'landscape')
print('ERRORS:', len(errors)); [print(' ', e) for e in errors]
