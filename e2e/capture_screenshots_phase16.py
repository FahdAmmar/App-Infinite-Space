"""
يلتقط صور README للميزات الجديدة من البناء الفعلي (كل ما فيها أُنشئ عبر الواجهة، لا بيانات مصطنعة).
الناتج: docs/screenshots/{context-menu,outline,viewer-page,editor-mobile}.png

التشغيل:
    npm run build && npx vite preview --port 4173 &
    python3 e2e/capture_screenshots_phase16.py
"""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'screenshots')


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark', permissions=['clipboard-read', 'clipboard-write'], accept_downloads=True)
    pg = ctx.new_page()

    def node(text): return pg.locator('.react-flow__node', has_text=text).first
    def center(loc):
        bb = loc.bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    def child_of(parent, text, dx=330, dy=0):
        n = node(parent); n.hover(); pg.wait_for_timeout(200)
        hb = n.locator('.react-flow__handle[data-handleid="right"]').bounding_box()
        hx, hy = hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2
        pg.mouse.move(hx, hy); pg.mouse.down(); pg.mouse.move(hx + dx, hy + dy, steps=16); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(300)
        pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)

    pg.goto(URL)
    pg.get_by_role('button', name='Create workspace').first.click()
    pg.get_by_placeholder('Learning Roadmap').fill('Product launch')
    pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(700)
    pg.mouse.dblclick(330, 300); pg.wait_for_timeout(200); pg.keyboard.type('Research'); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    child_of('Research', 'Positioning')
    child_of('Positioning', 'Launch plan', dx=300, dy=140)
    pg.mouse.dblclick(380, 640); pg.wait_for_timeout(200); pg.keyboard.type('Budget'); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    pg.keyboard.press('Escape'); pg.keyboard.press('Shift+1'); pg.wait_for_timeout(900)

    # قائمة النقر الأيمن على بطاقة
    pg.mouse.click(*center(node('Positioning')), button='right'); pg.wait_for_timeout(450)
    pg.screenshot(path=os.path.join(OUT, 'context-menu.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

    # المخطط + التركيز على فرع
    pg.mouse.click(*center(node('Positioning'))); pg.wait_for_timeout(200)
    pg.keyboard.press('f'); pg.wait_for_timeout(300)
    pg.keyboard.press('o'); pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(OUT, 'outline.png'))

    # العارض المستقل
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(300)
    pg.get_by_role('combobox', name='Search commands').fill('read-only copy'); pg.wait_for_timeout(150)
    with pg.expect_download(timeout=15000) as dl:
        pg.keyboard.press('Enter')
    path = os.path.join('/tmp', dl.value.suggested_filename); dl.value.save_as(path)
    viewer = ctx.new_page(); viewer.set_viewport_size({'width': 1440, 'height': 900})
    viewer.goto('file://' + path); viewer.wait_for_timeout(700)
    viewer.screenshot(path=os.path.join(OUT, 'viewer-page.png'))
    ctx.close()

    # الهاتف (يستبدل اللقطة القديمة التي تُظهر شريطاً من صفين)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, color_scheme='dark')
    m = ctx.new_page()
    m.goto(URL); m.wait_for_timeout(500)
    m.get_by_role('button', name='Create workspace').first.click()
    m.get_by_placeholder('Learning Roadmap').fill('Product launch')
    m.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    m.wait_for_url('**/w/**'); m.wait_for_selector('.react-flow'); m.wait_for_timeout(700)
    # بطاقات بلمسات حقيقية: نختار أداة اللصقة من الـ dock ثم نلمس اللوحة
    for (x, y, text) in [(195, 200, 'Research'), (195, 430, 'Positioning'), (195, 660, 'Launch plan')]:
        from _common import open_add_menu; open_add_menu(m); m.get_by_role('button', name='Sticky note', exact=True).click(); m.wait_for_timeout(150)
        m.touchscreen.tap(x, y); m.wait_for_timeout(250)
        m.keyboard.type(text); m.keyboard.press('Escape'); m.wait_for_timeout(250)
    m.keyboard.press('Escape'); m.wait_for_timeout(150)
    m.get_by_role('button', name='Dismiss notification').first.click() if m.get_by_role('button', name='Dismiss notification').count() else None
    m.get_by_role('button', name='Fit all content').click(); m.wait_for_timeout(1000)
    m.touchscreen.tap(30, 760); m.wait_for_timeout(300)
    m.screenshot(path=os.path.join(OUT, 'editor-mobile.png'))
    browser.close()
print('screenshots written to', os.path.abspath(OUT))
