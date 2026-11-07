"""
فحوصات المتصفح للمرحلة 17 (المناطق الآمنة، حوار الإنشاء، حالة البداية بالقوالب، قائمة الإضافة على الهاتف، العمل دون اتصال).

التشغيل:
    npm run build && npx vite preview --port 4173 &
    python3 e2e/phase17_ux.py        # أو: npm run e2e -- phase17
"""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


# المتصفح بلا واجهة قد يبلّغ عن نواة واحدة، فيُعدّ جهازاً ضعيفاً ويُعطَّل المشهد الزخرفي؛ نثبّت قيمة معقولة
INIT = "Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8})"


def new_context(browser, phone=False, **kw):
    if phone:
        kw.update(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    else:
        kw.update(viewport={'width': 1440, 'height': 900})
    ctx = browser.new_context(color_scheme='dark', **kw)
    ctx.add_init_script(INIT)
    return ctx


def box(locator):
    return locator.bounding_box() or {'x': 0, 'y': 0, 'width': 0, 'height': 0}


with sync_playwright() as p:
    browser = p.chromium.launch()
    errors = []

    # ---------- حوار الإنشاء: زر الإنشاء ظاهر دون تمرير ----------
    for label, phone in (('desktop 1440x900', False), ('phone 390x844', True)):
        ctx = new_context(browser, phone)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(URL); pg.wait_for_selector('h1')
        pg.get_by_role('button', name='Create workspace').first.click(); pg.wait_for_timeout(400)
        b = box(pg.locator('dialog[open]').get_by_role('button', name='Create workspace'))
        vh = 844 if phone else 900
        check(f'dialog submit button is visible without scrolling ({label})', 0 < b['y'] and b['y'] + b['height'] <= vh + 1, f"y={b['y']:.0f} h={b['height']:.0f} vh={vh}")
        ctx.close()

    # ---------- حالة البداية: قوالب بنقرة واحدة، بلا توست ----------
    ctx = new_context(browser)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('h1')
    heading = box(pg.get_by_role('heading', name='Your workspaces'))
    card = box(pg.get_by_role('heading', name='Start your first workspace'))
    check('empty state is left-aligned with the page heading', abs(heading['x'] - (card['x'] - 40)) < 80, f"heading x={heading['x']:.0f}, card text x={card['x']:.0f}")
    check('empty state lists the five templates', all(pg.get_by_role('button', name=n, exact=True).count() == 1 for n in ('Mind map', 'Kanban', 'SWOT', 'Retrospective', 'Roadmap')))
    pg.get_by_role('button', name='SWOT', exact=True).click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(800)
    check('one click on a template opens a populated canvas', pg.locator('.react-flow__node').count() >= 4, f"nodes={pg.locator('.react-flow__node').count()}")
    check('no redundant "Created ..." toast after navigating', pg.get_by_text('Created “').count() == 0)
    ctx.close()

    # ---------- المناطق الآمنة: نحاكي نتوءاً بتغيير المتغيرات ----------
    ctx = new_context(browser, phone=True)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('h1'); pg.wait_for_timeout(500)
    base_header = box(pg.locator('header a, header button').first)
    pg.add_style_tag(content=':root{--safe-top:47px;--safe-bottom:34px}'); pg.wait_for_timeout(200)
    moved = box(pg.locator('header a, header button').first)
    check('dashboard header moves below the notch', abs((moved['y'] - base_header['y']) - 47) <= 2, f"delta={moved['y'] - base_header['y']:.0f}")
    pg.get_by_role('button', name='Create workspace').first.click()
    pg.get_by_placeholder('Learning Roadmap').fill('Safe areas')
    pg.keyboard.press('Enter'); pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(800)
    top_bar_item = box(pg.locator('a[href="/"]').first)
    check('editor top bar clears the notch', top_bar_item['y'] >= 47 + 8, f"y={top_bar_item['y']:.0f}")
    fab = box(pg.get_by_role('button', name='Open add menu'))
    check('add button clears the home indicator', fab['y'] + fab['height'] <= 844 - 34, f"bottom={fab['y'] + fab['height']:.0f}")

    # ---------- قائمة الإضافة على الهاتف ----------
    check('toolbar is collapsed behind one + button', pg.get_by_role('toolbar', name='Add to canvas').count() == 0)
    fab_size = box(pg.get_by_role('button', name='Open add menu'))
    check('add button is at least 44px', fab_size['width'] >= 44 and fab_size['height'] >= 44)
    pg.get_by_role('button', name='Open add menu').tap(); pg.wait_for_timeout(250)
    check('menu lists the five tools', all(pg.get_by_role('toolbar', name='Add to canvas').get_by_role('button', name=n).count() == 1 for n in ('Sticky note', 'Text card', 'Add image', 'Link card', 'Group')))
    pg.get_by_role('toolbar', name='Add to canvas').get_by_role('button', name='Sticky note').tap(); pg.wait_for_timeout(250)
    check('choosing a tool closes the menu', pg.get_by_role('toolbar', name='Add to canvas').count() == 0)
    pg.mouse.click(195, 420); pg.wait_for_timeout(600)
    check('tapping the canvas places the chosen card', pg.locator('.react-flow__node').count() == 1, f"nodes={pg.locator('.react-flow__node').count()}")
    ctx.close()

    # ---------- العمل دون اتصال ----------
    ctx = new_context(browser)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('h1')
    ready = pg.evaluate("navigator.serviceWorker.ready.then(r => !!r.active)")
    check('service worker is active', ready is True)
    pg.reload(); pg.wait_for_selector('h1')
    check('page is controlled by the service worker', pg.evaluate('!!navigator.serviceWorker.controller'))
    pg.get_by_role('button', name='Kanban', exact=True).click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(800)
    editor_url = pg.url
    ctx.set_offline(True)
    pg.evaluate("window.dispatchEvent(new Event('offline'))"); pg.wait_for_timeout(300)
    check('offline message is shown', pg.get_by_text('You are offline').count() == 1)
    pg.reload(); pg.wait_for_selector('.react-flow', timeout=15000); pg.wait_for_timeout(800)
    check('editor route reloads offline from the cached shell', pg.url == editor_url and pg.locator('.react-flow__node').count() >= 3, f"nodes={pg.locator('.react-flow__node').count()}")
    pg.goto(URL); pg.wait_for_selector('h1', timeout=15000)
    check('dashboard opens offline and lists the saved workspace', pg.locator('[data-workspace-id]').count() == 1)
    ctx.set_offline(False)
    pg.evaluate("window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(300)
    check('online message replaces the offline one', pg.get_by_text('You are offline').count() == 0)
    ctx.close()

    check('no uncaught page errors', not errors, '; '.join(errors)[:200])
    browser.close()

failed = [n for n, ok, _ in results if not ok]
print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
sys.exit(1 if failed else 0)
