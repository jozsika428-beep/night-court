# Loads the game in headless Chrome at phone sizes, checks for console errors, plays a bit, takes screenshots.
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
OUT = '/workspace/game/screens/'
errors = []
def run(p, w, h, name, scenario):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(f'{name} console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append(f'{name} pageerror: {e}'))
    pg.on('requestfailed', lambda r: errors.append(f'{name} requestfailed: {r.url}'))
    pg.goto(URL); pg.wait_for_timeout(1200)
    if name == 'portrait': pg.screenshot(path=OUT + 'menu_390x844.png')
    pg.tap('#play'); pg.wait_for_timeout(1500)
    # real touch input: tap an empty plot -> build menu opens -> tap Crypt -> it gets built
    sp = pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM; const p = g.plots.filter(p => p.base && p.owner === 0)[4]; c.x = p.x; c.y = p.y + 60; c.clamp();
      return { x: (p.x - c.x) * c.z + c.vw / 2, y: (p.y - c.y) * c.z + c.vh / 2, id: p.id }; }""")
    pg.touchscreen.tap(sp['x'], sp['y']); pg.wait_for_timeout(400)
    menu_ok = 'Empty plot' in pg.inner_text('#panel')
    pg.tap('[data-a="build"][data-v="crypt"]'); pg.wait_for_timeout(300)
    built = pg.evaluate("(id) => !!NC_GAME.get(NC_GAME.get(id).buildingId)", sp['id'])
    print(name, 'tap plot opens build menu:', menu_ok, '| tap Crypt builds it:', built)
    if not (menu_ok and built): errors.append(name + ' touch build flow failed')
    # pinch/drag smoke: drag the map
    c0 = pg.evaluate("() => NC_CAM.y")
    pg.mouse.move(w/2, h/3); pg.mouse.down(); pg.mouse.move(w/2, h/3 + 120, steps=5); pg.mouse.up()
    c1 = pg.evaluate("() => NC_CAM.y")
    print(name, 'drag pans map:', c1 != c0)
    ok = pg.evaluate(scenario)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT + f'gameplay_{w}x{h}.png')
    pg.evaluate("""() => { const g = NC_GAME, c = NC_CAM, f = g.get(g.sides[0].fortressId); document.querySelector('[data-a="clear"]') && document.querySelector('[data-a="clear"]').click(); c.x = f.x; c.y = f.y - 80; c.z = Math.min(0.8, c.vw / 640); c.clamp(); }""")
    pg.wait_for_timeout(800)
    pg.screenshot(path=OUT + f'base_{w}x{h}.png')
    fps = pg.evaluate("""() => new Promise(r => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); } requestAnimationFrame(f); })""")
    stats = pg.evaluate("""() => { const g = NC_GAME; return { t: g.t|0, units: g.units.length, botBuildings: g.buildings.filter(b=>b.owner===1).map(b=>b.type), art: NC.Assets.loaded }; }""")
    print(name, 'fps(headless):', fps, json.dumps(stats))
    b.close()
SCENARIO = '''async () => {
  const g = NC_GAME, me = 0, cam = window.NC_CAM;
  // fast-forward a played match: build base, capture an outpost, fight at the middle ford
  g.sides[0].res = 4000;
  const plots = g.plots.filter(p => p.base && p.owner === 0);
  const crypt = g.build(0, plots[1].id, 'crypt'), den = g.build(0, plots[2].id, 'wolfden'), farm = g.build(0, plots[0].id, 'bloodfarm'), alt = g.build(0, plots[3].id, 'altar');
  const bot = window.NC_BOT;
  for (let i = 0; i < 30 * 20; i++) { bot.update(1/30); g.update(1/30); }
  g.levelUp(0, crypt.id); g.levelUp(0, crypt.id);
  g.research(0, alt.id, 'melee');
  ['ghoul','ghoul','archer','thrall','catapult'].forEach(t => g.train(0, crypt.id, t)); ['werewolf','bat','werewolf'].forEach(t => g.train(0, den.id, t));
  g.summonHero(0, 'vael'); g.sides[0].res += 800; g.summonHero(0, 'grimfang');
  for (let i = 0; i < 30 * 60; i++) { bot.update(1/30); g.update(1/30); }
  const ids = g.units.filter(u => u.owner === 0).map(u => u.id);
  g.orderUnits(0, ids, { type: 'amove', x: 800, y: 1420 });
  for (let i = 0; i < 30 * 25; i++) { bot.update(1/30); g.update(1/30); }
  // bring some Dawn troops to the ford for a fight
  ['knight','knight','torch','torch','torch','crossbow','crossbow','priest'].forEach((t, i) => { const u = g.spawnUnit(t, 1, 700 + i * 25, 1200); u.order = { type: 'amove', x: 800, y: 1400 }; });
  g.summonHero(1, 'ashen'); const a = g.units.find(u => u.type === 'ashen'); if (a) { a.x = 800; a.y = 1220; a.order = { type: 'amove', x: 800, y: 1400 }; }
  for (let i = 0; i < 30 * 2.5; i++) { g.update(1/30); }
  g.useAbility(0, g.units.find(u => u.type === 'grimfang').id, 0);
  
  // select the army so the panel shows hero abilities
  const cl = document.querySelector('[data-a="clear"]'); if (cl) cl.click();
  document.querySelector('[data-a="army"]').click();
  const ar = g.units.filter(u => u.owner === 0); cam.x = ar.reduce((a,u)=>a+u.x,0)/ar.length; cam.y = ar.reduce((a,u)=>a+u.y,0)/ar.length + 40; cam.z = Math.max(0.9, Math.min(1.2, cam.vw / 420)); cam.clamp();
  return g.winner;
}'''
with sync_playwright() as p:
    run(p, 390, 844, 'portrait', SCENARIO)
    run(p, 844, 390, 'landscape', SCENARIO)
print('ERRORS:', len(errors)); [print(' ', e) for e in errors]
