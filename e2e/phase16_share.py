"""
فحوصات المتصفح للمرحلة 16 (المشاركة والبحث): العارض المستقل للقراءة فقط، والبحث في بطاقات كل المساحات.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    python3 e2e/phase16_share.py
"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
OUT = tempfile.mkdtemp(prefix='infinitespace-e2e-share-')
results = []
HOSTILE = '</script><img src=x onerror="window.__pwned=1">'


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark', accept_downloads=True)
    pg = ctx.new_page()
    logs = []
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))

    def node(text): return pg.locator('.react-flow__node', has_text=text).first
    def center(loc):
        bb = loc.bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    def run_command(query):
        pg.keyboard.press('Control+k'); pg.wait_for_timeout(300)
        pg.get_by_role('combobox', name='Search commands').fill(query); pg.wait_for_timeout(150); pg.keyboard.press('Enter')

    def make_workspace(name):
        pg.goto(URL)
        pg.get_by_role('button', name='Create workspace').first.click()
        pg.get_by_placeholder('Learning Roadmap').fill(name)
        pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
        pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(500)

    make_workspace('Share me')
    ws_url = pg.url
    # بطاقتان: واحدة بنص خبيث، والثانية بنص عربي، ووصلة بينهما
    pg.mouse.dblclick(400, 300); pg.wait_for_timeout(200); pg.keyboard.type(HOSTILE); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    n = node('script'); n.hover(); pg.wait_for_timeout(200)
    hb = n.locator('.react-flow__handle[data-handleid="right"]').bounding_box()
    hx, hy = hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2
    pg.mouse.move(hx, hy); pg.mouse.down(); pg.mouse.move(hx + 330, hy, steps=16); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(300)
    pg.keyboard.type('أفكار المشروع'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('two cards and a connection exist', pg.locator('.react-flow__node').count() == 2 and pg.locator('.react-flow__edge').count() == 1)

    # ───── التصدير من لوحة الأوامر ─────
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    with pg.expect_download(timeout=15000) as dl:
        run_command('read-only copy')
    d = dl.value
    path = os.path.join(OUT, d.suggested_filename); d.save_as(path)
    check('the palette command downloads an .html file named after the workspace', d.suggested_filename.startswith('Share me-') and d.suggested_filename.endswith('.html'), d.suggested_filename)
    html = open(path, encoding='utf-8').read()
    check('the file is a complete page that blocks network access', html.startswith('<!doctype html>') and "default-src 'none'" in html)
    check('the hostile text never appears as raw markup in the file', '<img src=x onerror' not in html)
    pg.wait_for_timeout(500)
    check('a success message explains how to open it', pg.get_by_text('Saved a read-only copy').count() >= 1)

    # ───── فتح الملف في صفحة مستقلة (file://) ─────
    viewer = ctx.new_page()
    vlogs = []; requests = []
    viewer.on('console', lambda m: vlogs.append((m.type, m.text)) if m.type == 'error' else None)
    viewer.on('pageerror', lambda e: vlogs.append(('pageerror', str(e))))
    viewer.on('request', lambda r: requests.append(r.url) if not r.url.startswith(('file:', 'data:')) else None)
    viewer.goto('file://' + path); viewer.wait_for_timeout(700)
    check('the viewer renders both cards', viewer.locator('.card').count() == 2, str(viewer.locator('.card').count()))
    check('the connection is drawn', viewer.locator('svg path[marker-end]').count() == 1)
    check('hostile text is shown as plain text', viewer.get_by_text(HOSTILE, exact=False).count() >= 1 and viewer.locator('img[src="x"]').count() == 0)
    check('and nothing in it ran', viewer.evaluate('window.__pwned === undefined'))
    check('Arabic text is shown with automatic direction', viewer.locator('.card[dir="auto"]', has_text='أفكار المشروع').count() == 1)
    t0 = viewer.evaluate("document.getElementById('stage').style.transform")
    viewer.mouse.move(700, 450); viewer.mouse.wheel(0, -400); viewer.wait_for_timeout(250)
    t1 = viewer.evaluate("document.getElementById('stage').style.transform")
    check('the wheel zooms', t0 != t1, f'{t0} -> {t1}')
    viewer.mouse.move(700, 450); viewer.mouse.down(); viewer.mouse.move(800, 520, steps=8); viewer.mouse.up(); viewer.wait_for_timeout(150)
    t2 = viewer.evaluate("document.getElementById('stage').style.transform")
    check('dragging pans', t1 != t2)
    viewer.get_by_role('button', name='Fit all content').click(); viewer.wait_for_timeout(200)
    check('Fit brings everything back', viewer.evaluate("document.getElementById('stage').style.transform") == t0)
    viewer.get_by_role('button', name='Switch light or dark theme').click()
    check('the theme button switches theme', viewer.evaluate("document.documentElement.getAttribute('data-theme')") == 'light')
    leaked = viewer.evaluate("fetch('https://example.com/').then(() => 'allowed', () => 'blocked')")
    check('the page cannot reach the network (CSP)', leaked == 'blocked', leaked)
    check('opening it made no network request', requests == [], str(requests[:3]))
    check('and raised no errors besides the blocked probe', not [l for l in vlogs if 'Content Security Policy' not in l[1] and 'Failed to fetch' not in l[1]], str(vlogs[:3]))
    viewer.screenshot(path=os.path.join(OUT, 'viewer.png'))
    viewer.close()

    # ───── من لوحة التحكم ─────
    pg.goto(URL); pg.wait_for_timeout(600)
    card = pg.locator('[data-workspace-id]', has_text='Share me').first
    card.get_by_role('button', name=lambda n: True).last.click() if False else None
    card.locator('button[aria-haspopup]').first.click(); pg.wait_for_timeout(250)
    with pg.expect_download(timeout=15000) as dl2:
        pg.get_by_role('menuitem', name='Save as read-only page').click()
    check('the workspace card menu offers the read-only page too', dl2.value.suggested_filename.endswith('.html'), dl2.value.suggested_filename)

    # ───── البحث في كل المساحات ─────
    pg.goto(URL); pg.wait_for_timeout(500)
    make_workspace('Other place')
    pg.mouse.dblclick(500, 350); pg.wait_for_timeout(200); pg.keyboard.type('Quarterly budget review'); pg.keyboard.press('Escape'); pg.wait_for_timeout(1500)
    pg.goto(URL); pg.wait_for_timeout(600)
    pg.get_by_role('searchbox').first.fill('budget') if pg.get_by_role('searchbox').count() else pg.get_by_placeholder('Search workspaces').fill('budget')
    pg.wait_for_timeout(1200)
    results_section = pg.get_by_role('heading', name='Cards matching', exact=False)
    check('typing in the search shows cards from inside workspaces', results_section.count() == 1)
    link = pg.get_by_role('link', name='Quarterly budget review', exact=False)
    check('the hit names the card and its workspace', link.count() == 1 and 'Other place' in link.first.inner_text(), link.first.inner_text() if link.count() else '')
    pg.get_by_placeholder('Search workspaces').fill('أفكار'); pg.wait_for_timeout(1200)
    check('Arabic text inside a card is searchable', pg.get_by_role('link', name='أفكار المشروع', exact=False).count() == 1)
    pg.get_by_role('link', name='أفكار المشروع', exact=False).first.click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(1600)
    sel = pg.locator('.react-flow__node.selected')
    check('clicking a hit opens that workspace at the card', sel.count() == 1 and 'أفكار' in sel.first.inner_text(), sel.first.inner_text() if sel.count() else 'no selection')
    pg.goto(URL); pg.wait_for_timeout(500)
    pg.get_by_placeholder('Search workspaces').fill('zzzzqqq'); pg.wait_for_timeout(1200)
    check('no card hits means no empty results section', pg.get_by_role('heading', name='Cards matching', exact=False).count() == 0)

    unexpected = [l for l in logs if 'Content Security Policy' not in l[1]]
    check('no unexpected console or page errors in the app', not unexpected, str(unexpected[:3]))
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f'\n{passed}/{len(results)} checks passed  (files: {OUT})')
sys.exit(0 if passed == len(results) else 1)
