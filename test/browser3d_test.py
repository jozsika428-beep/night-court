# 3D view check: headless Chrome with SwiftShader WebGL at phone sizes. Touch tap/drag/pinch, no console errors,
# fps with ~100 units, screenshots to screens/3d_*.png.  Usage: python3 test/browser3d_test.py [url] [gfx]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
GFX = sys.argv[2] if len(sys.argv) > 2 else 'low'
OUT = '/workspace/game/screens/'
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
    pg.add_init_script(f"localStorage.setItem('nc_gfx', '{GFX}')")
    pg.goto(URL); pg.wait_for_timeout(1500)
    if name == 'portrait': pg.screenshot(path=OUT + '3d_menu_390x844.png')
    pg.tap('#play'); pg.wait_for_timeout(2500)
    view = pg.evaluate("() => NC_VIEW"); print(name, 'view:', view, 'gfx:', GFX)
    pg.wait_for_function("() => NC_WORLD.models.done", timeout=60000); pg.wait_for_timeout(500)
    ml = pg.evaluate("() => ({ loaded: Object.keys(NC_WORLD.models.protos).length, entries: Object.keys(NC_WORLD.models.entries).length, terrain: Object.keys(NC_WORLD.models.terrain).length, issues: NC_WORLD.models.issues })")
    print(name, 'models:', json.dumps(ml))
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
    pg.wait_for_timeout(200); pg.touchscreen.tap(bp['x'], bp['y']); pg.wait_for_timeout(400)
    fort_ok = 'Fortress' in pg.inner_text('#panel'); print(name, 'raycast tap on Fortress opens it:', fort_ok)
    if not fort_ok: errors.append(name + ' building raycast pick failed')
    # drag to pan, pinch to zoom, twist to rotate (raw CDP touch events)
    cdp = ctx.new_cdp_session(pg)
    def touch(kind, pts): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    c0 = pg.evaluate("() => [NC_CAM.x, NC_CAM.y, NC_CAM.z, NC_CAM.yaw]")
    touch('touchStart', [(w/2, h/3)]); [touch('touchMove', [(w/2 + k*8, h/3 + k*12)]) for k in range(1, 9)]; touch('touchEnd', [])
    c1 = pg.evaluate("() => [NC_CAM.x, NC_CAM.y, NC_CAM.z, NC_CAM.yaw]")
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
    pg.screenshot(path=OUT + f'3d_models_battle_{w}x{h}.png')
    # base in daylight
    pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM, f = g.get(g.sides[0].fortressId); NC_UI.clear(); g.t += (240 - g.cycle()) + 20; g.updateDayNight(); c.x = f.x; c.y = f.y - 60; c.z = 1.15; c.yaw = c.yawTarget = 0.35; c.clamp(); }""")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT + f'3d_models_base_{w}x{h}.png')
    # base at night: Glow parts should light up
    pg.evaluate("() => { const g = NC_GAME; g.t += (g.NC ? 0 : 0) + (NC.NIGHT_START + 40 - g.cycle()); g.updateDayNight(); }")
    pg.wait_for_timeout(1200)
    pg.screenshot(path=OUT + f'3d_models_night_{w}x{h}.png')
    # line-up of every unit + hero model in daylight, close camera: scale, facing, feet
    pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM; g.t += (NC.DAY_LEN - g.cycle()) + 30; g.updateDayNight();
      const T = ['ghoul','thrall','werewolf','archer','vael','grimfang','crossbow','knight','priest','torch','ashen'];
      window.__line = T.map((t, i) => { const u = g.spawnUnit(t, i < 6 ? 0 : 1, 1160 + (i % 6) * 30, 1560 + Math.floor(i / 6) * 45); u.order = { type: 'idle' }; u.face = Math.PI / 2; return u.id; });
      window.__upd = g.update; g.update = function () {};
      c.x = 1235; c.y = 1570; c.z = 2.2; c.yaw = c.yawTarget = 0; c.clamp(); }""")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT + f'3d_models_lineup_{w}x{h}.png')
    pg.evaluate("() => { const g = NC_GAME; g.update = window.__upd; g.units = g.units.filter(u => !window.__line.includes(u.id)); }")
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
    pg.screenshot(path=OUT + f'3d_models_stress_{w}x{h}.png')
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
