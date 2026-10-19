# Title art screenshots: loading screen (held at ~60%) and the menu, at both phone sizes. No console errors allowed.
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
OUT = '/workspace/game/screens/'; errors = []
ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    for w, h in ((390, 844), (844, 390)):
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type in ('error', 'warning') and 'GPU stall' not in m.text and errors.append(f'{w}x{h} {m.type}: {m.text}'))
        pg.on('pageerror', lambda e: errors.append(f'{w}x{h} pageerror: {e}'))
        pg.on('response', lambda r: r.status >= 400 and errors.append(f'{w}x{h} HTTP {r.status} {r.url}'))
        pg.goto(URL + ('&' if '?' in URL else '?') + 'splash=hold'); pg.wait_for_timeout(2500)
        pg.evaluate("() => { NC.Splash.show('Loading models…'); NC.Splash.set(0.62); }"); pg.wait_for_timeout(400)
        pg.screenshot(path=OUT + f'title_loading_{w}x{h}.png')
        bar = pg.evaluate("() => { const r = document.getElementById('sp-bar').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }")
        pg.goto(URL); pg.wait_for_timeout(2500)
        vis = pg.evaluate("() => document.getElementById('splash').classList.contains('hidden')")
        pg.screenshot(path=OUT + f'title_menu_{w}x{h}.png')
        print(f'{w}x{h} bar', bar, '| splash gone after boot:', vis)
        if not vis: errors.append(f'{w}x{h} loading screen did not go away')
        ctx.close()
    b.close()
print('ERRORS:', len(errors)); [print(' ', e) for e in errors]
