"""
فحوصات المتصفح للمرحلة 15 (إصلاحات تجربة الاستخدام): الهاتف، قائمة البدء، السمات، لوحة الأوامر، لوحة التحكم.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    python3 e2e/phase15_ux.py
"""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


def create_workspace(pg, name):
    pg.get_by_role('button', name='Create workspace').first.click()
    pg.get_by_placeholder('Learning Roadmap').fill(name)
    pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(600)


with sync_playwright() as p:
    browser = p.chromium.launch()
    logs = []

    # ───── سطح المكتب ─────
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark', permissions=['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page()
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    pg.goto(URL)
    check('the dashboard hides "Pick up where you left off" when it would only repeat the list', pg.get_by_text('Pick up where you left off').count() == 0)
    create_workspace(pg, 'UX one')
    pg.goto(URL); pg.wait_for_timeout(500)
    create_workspace(pg, 'UX two')
    pg.goto(URL); pg.wait_for_timeout(500)
    check('with two workspaces opened the row stays hidden (all are already listed)', pg.get_by_text('Pick up where you left off').count() == 0)

    pg.get_by_role('link', name='UX one').first.click(); pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(600)
    checklist = pg.get_by_role('region', name='Getting started')
    check('the getting-started list shows on a new workspace', checklist.count() == 1 and checklist.is_visible())
    check('no step is ticked on an empty canvas', checklist.locator('li', has_text='(not done yet)').count() == 4)
    pg.mouse.dblclick(700, 400); pg.wait_for_timeout(200); pg.keyboard.type('One'); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    check('adding a card ticks the first step by itself', checklist.locator('li', has_text='Add a card').get_by_text('(done)').count() == 1)
    pg.mouse.dblclick(1000, 400); pg.wait_for_timeout(200); pg.keyboard.type('Two'); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    pg.keyboard.press('Control+g'); pg.keyboard.press('Escape')
    pg.keyboard.press('g'); pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    check('adding a group ticks the group step', checklist.locator('li', has_text='Frame cards').get_by_text('(done)').count() == 1)
    pg.get_by_role('button', name='Hide the getting started list').click(); pg.wait_for_timeout(250)
    check('the list can be dismissed', pg.get_by_role('region', name='Getting started').count() == 0)
    pg.reload(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(700)
    check('and it stays dismissed after a reload', pg.get_by_role('region', name='Getting started').count() == 0)

    # زر لوحة الأوامر في الشريط العلوي
    pg.get_by_role('button', name='Command palette (Ctrl/⌘+K)').click(); pg.wait_for_timeout(350)
    check('the top bar button opens the command palette', pg.get_by_role('dialog', name='Command palette').is_visible())

    # السمات
    def html_attr(a): return pg.evaluate(f"document.documentElement.getAttribute('{a}')")
    def run_command(query):
        pg.keyboard.press('Control+k'); pg.wait_for_timeout(300)
        pg.get_by_role('combobox', name='Search commands').fill(query); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    check('the default theme is dark', html_attr('data-theme') == 'dark')
    run_command('high contrast')
    check('high contrast sets the page attribute', html_attr('data-contrast') == 'high')
    line_hi = pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--c-line').trim()")
    check('and strengthens the border colour', line_hi == '#7a7a86', line_hi)
    pg.reload(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(500)
    check('high contrast survives a reload (no flash: set before first paint)', html_attr('data-contrast') == 'high')
    run_command('high contrast')
    check('and can be turned off', html_attr('data-contrast') is None)
    run_command('follow the system appearance')
    check('"follow the system" with a dark system stays dark', html_attr('data-theme') == 'dark')
    ctx.close()

    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='light')
    pg = ctx.new_page()
    pg.goto(URL); pg.wait_for_timeout(300)
    check('a new visitor on a light system still starts dark (unchanged default)', html_attr('data-theme') == 'dark')
    pg.evaluate("localStorage.setItem('infinitespace:v1:ui', JSON.stringify({state:{themeMode:'system'},version:0}))")
    pg.reload(); pg.wait_for_timeout(500)
    check('in automatic mode a light system gives the light theme', html_attr('data-theme') == 'light', str(html_attr('data-theme')))
    pg.emulate_media(color_scheme='dark'); pg.wait_for_timeout(500)
    check('and it follows the system when the system changes', html_attr('data-theme') == 'dark', str(html_attr('data-theme')))
    ctx.close()

    # ───── الهاتف ─────
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, color_scheme='dark')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    pg.goto(URL); pg.wait_for_timeout(500)
    create_workspace(pg, 'Phone')
    toolbar = pg.get_by_role('toolbar', name='Zoom and view')
    bb = toolbar.bounding_box()
    check('the zoom toolbar is one row on a phone', bb['height'] < 60, str(bb))
    check('and it fits inside the screen', bb['x'] >= 0 and bb['x'] + bb['width'] <= 390, str(bb))
    check('the keyboard shortcuts button is not offered on a phone', pg.get_by_role('button', name='Keyboard shortcuts (?)').is_visible() is False)
    check('the empty canvas shows touch wording, not keyboard wording', pg.get_by_text('Tap a tool below to add a card.').is_visible() and not pg.get_by_text('Double-click anywhere').is_visible())
    check('the getting-started list stays out of the way on a phone', pg.get_by_role('region', name='Getting started').is_visible() is False)
    check('the palette button is in the top bar on a phone', pg.get_by_role('button', name='Command palette (Ctrl/⌘+K)').is_visible())
    right = max(pg.get_by_role('button', name='Command palette (Ctrl/⌘+K)').bounding_box()['x'] + 44, 0)
    check('the top bar does not overflow the screen', right <= 390, str(right))
    pg.screenshot(path='/tmp/phone_editor_after.png')
    # ضغط مطوّل على اللمس يفتح القائمة
    cdp = ctx.new_cdp_session(pg)
    def touch(kind, x, y):
        cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y}] if kind != 'touchEnd' else []})
    touch('touchStart', 195, 300); pg.wait_for_timeout(800); touch('touchEnd', 195, 300); pg.wait_for_timeout(300)
    check('a long press on the canvas opens the context menu', pg.get_by_role('menu', name='Canvas actions').count() == 1)
    pg.get_by_role('menu', name='Canvas actions').get_by_role('menuitem', name='Add sticky note here').click(); pg.wait_for_timeout(500)
    check('and its command works by touch', pg.locator('.react-flow__node').count() == 1)
    ctx.close()

    unexpected = [l for l in logs if 'Content Security Policy' not in l[1]]
    check('no unexpected console or page errors', not unexpected, str(unexpected[:3]))
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f'\n{passed}/{len(results)} checks passed')
sys.exit(0 if passed == len(results) else 1)
