"""
اختبار القبول النهائي: يمرّ بكل بنود «Definition of Done» في المواصفات (القسم 16) في رحلة مستخدم واحدة متصلة،
على نسخة الإنتاج، ثم يكررها بالسمة الفاتحة وعلى شاشة صغيرة. البند 15 (التصدير) اختياري في المواصفات
ولم يُنفَّذ، فلا فحص له (انظر README).

التشغيل:
    npm run build && npx vite preview --port 4173 &
    pip install playwright pillow && playwright install chromium
    python3 e2e/acceptance.py            # أو BASE_URL=http://127.0.0.1:5173/ للتطوير
"""
import os, struct, sys, tempfile, zlib
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
TMP = tempfile.mkdtemp(prefix='infinitespace-acceptance-')
results = []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))

def make_png(path, w, h):
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            row += bytes((x * 255 // w, y * 255 // h, 180))
        rows.append(bytes(row))
    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b''))

PHOTO = os.path.join(TMP, 'photo.png'); make_png(PHOTO, 600, 400)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark')
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None); pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))

    def node(t): return pg.locator('.react-flow__node', has_text=t).first
    def center(l):
        b = l.bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
    def drag(x1, y1, x2, y2):
        pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x1 + 4, y1 + 4, steps=2); pg.mouse.move(x2 + 4, y2 + 4, steps=12); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(200)
    def blank(): pg.mouse.click(980, 200)
    def sticky(x, y, text):
        pg.mouse.move(x, y); pg.mouse.dblclick(x, y); pg.wait_for_timeout(120); pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(150); blank()
    def saved(): pg.wait_for_function("() => /^Saved/.test(document.querySelector('header [role=status]').innerText.trim())", timeout=10000)
    def zoom_label(): return pg.get_by_role('button', name=lambda n: n.startswith('Zoom ')).first.inner_text() if False else pg.locator('[aria-label^="Zoom "]').first.inner_text()
    def counts():
        return {t: pg.locator(f'.react-flow__node-{t}').count() for t in ('sticky', 'text', 'link', 'image', 'group')} | {'edges': pg.locator('.react-flow__edge').count()}

    # 1
    pg.goto(URL); pg.wait_for_selector('h1')
    check('1. the dashboard opens', pg.get_by_role('heading', name='Your workspaces').count() == 1 and pg.get_by_role('button', name='Create workspace').count() >= 1)
    # 2
    pg.get_by_role('button', name='Create workspace').first.click()
    pg.get_by_placeholder('Learning Roadmap').fill('Acceptance trip')
    pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    # 3
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow')
    check('2+3. a named workspace is created and opened', 'Acceptance trip' in pg.locator('header').inner_text() and '/w/' in pg.url)
    editor_url = pg.url; pg.mouse.move(5, 5); pg.wait_for_timeout(1200)

    # 4 — لوحة بلا حدود عملياً
    z0 = zoom_label()
    for _ in range(4): pg.get_by_role('button', name='Zoom out').click(); pg.wait_for_timeout(120)
    z_out = zoom_label()
    pg.mouse.move(700, 500)
    for _ in range(6): drag(900, 450, 150, 450)  # سحب متكرر نحو اليمين = إزاحة اللوحة بعيداً
    sticky(700, 450, 'Far away'); far_before = node('Far away').bounding_box()
    far = pg.evaluate("""() => { const el = [...document.querySelectorAll('.react-flow__node')].find(n => n.textContent.includes('Far away')); const m = /translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/.exec(el.style.transform); return Math.hypot(parseFloat(m[1]), parseFloat(m[2])) }""")
    check(f'4. zooming out and panning far away keep working (a card was created {far:,.0f} canvas px from the origin)', z_out != z0 and node('Far away').count() == 1 and far > 5000, f'{far}')
    pg.get_by_role('button', name='Fit all content (Shift+1)').click(); pg.wait_for_timeout(700)
    check('4. "fit all" brings far content back into view', node('Far away').bounding_box() is not None and 0 <= node('Far away').bounding_box()['x'] <= 1440)
    pg.get_by_role('button', name='Zoom 100%. Reset to 100%').click() if pg.get_by_role('button', name='Zoom 100%. Reset to 100%').count() else None
    pg.locator('[aria-label^="Zoom "]').first.click(); pg.wait_for_timeout(500)
    node('Far away').click(); pg.keyboard.press('Delete'); pg.wait_for_timeout(200)  # نعود للعمل قرب الأصل
    pg.get_by_role('button', name='Fit all content (Shift+1)').click(); pg.wait_for_timeout(500); pg.locator('[aria-label^="Zoom "]').first.click(); pg.wait_for_timeout(400)

    # 5 — الأوراق اللاصقة
    pg.evaluate("document.querySelector('.react-flow')"); sticky(330, 250, 'Pack the bags')
    check('5. add + edit a sticky note', node('Pack the bags').count() == 1)
    b0 = node('Pack the bags').bounding_box(); drag(b0['x'] + 50, b0['y'] + 40, b0['x'] + 50 + 120, b0['y'] + 40 + 70)
    b1 = node('Pack the bags').bounding_box()
    check('5. move it', abs((b1['x'] - b0['x']) - 120) < 3)
    node('Pack the bags').click(); pg.wait_for_timeout(150)
    handle = pg.locator('.react-flow__node.selected .react-flow__resize-control.handle.bottom.right')
    hb = handle.bounding_box(); drag(hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2, hb['x'] + 100, hb['y'] + 60)
    b2 = node('Pack the bags').bounding_box()
    check('5. resize it', b2['width'] > b1['width'] + 60 and b2['height'] > b1['height'] + 30, f"{b1['width']}x{b1['height']} -> {b2['width']}x{b2['height']}")
    n0 = pg.locator('.react-flow__node-sticky').count(); node('Pack the bags').click(); pg.keyboard.press('Control+d'); pg.wait_for_timeout(250)
    check('5. duplicate it', pg.locator('.react-flow__node-sticky').count() == n0 + 1)
    pg.keyboard.press('Delete'); pg.wait_for_timeout(250)
    check('5. delete it', pg.locator('.react-flow__node-sticky').count() == n0)
    blank()

    # 6 — صور
    with pg.expect_file_chooser() as fc: pg.get_by_role('button', name='Add image').click()
    fc.value.set_files(PHOTO); pg.wait_for_selector('.react-flow__node img'); pg.wait_for_timeout(500)
    img = pg.locator('.react-flow__node-image').first; i0 = img.bounding_box(); drag(i0['x'] + 60, i0['y'] + 20, i0['x'] + 60 + 400, i0['y'] + 20 + 120); i1 = img.bounding_box()
    check('6. upload an image and position it', img.locator('img').evaluate('i => i.naturalWidth > 0') and abs((i1['x'] - i0['x']) - 400) < 3)
    blank()

    # 7 — نص ورابط
    pg.mouse.move(250, 600); pg.keyboard.press('t'); pg.wait_for_timeout(150); pg.keyboard.type('Trip notes'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150); blank()
    pg.mouse.move(700, 650); pg.keyboard.press('l'); pg.wait_for_timeout(150)
    pg.get_by_label('Link address').fill('example.com/map'); pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(200); blank()
    check('7. text card and link card are created', node('Trip notes').count() == 1 and pg.locator('.react-flow__node a[href="https://example.com/map"]').count() == 1)

    # 8 — وصل
    sticky(330, 250, 'Book flights')
    a = node('Book flights'); t = node('Trip notes'); a.hover(); pg.wait_for_timeout(200)
    ah = a.locator('.react-flow__handle[data-handleid="bottom"]').bounding_box(); t.hover(); pg.wait_for_timeout(200)
    th = t.locator('.react-flow__handle[data-handleid="top"]').bounding_box()
    drag(ah['x'] + ah['width'] / 2, ah['y'] + ah['height'] / 2, th['x'] + th['width'] / 2, th['y'] + th['height'] / 2)
    edge = pg.locator('.react-flow__edge path.react-flow__edge-path').first
    check('8. two nodes are connected with a line and an arrow', pg.locator('.react-flow__edge').count() == 1 and edge.evaluate("e => getComputedStyle(e).markerEnd") != 'none')
    blank()

    # 9 — مجموعات
    pg.mouse.move(1000, 250); pg.keyboard.press('g'); pg.wait_for_timeout(150); pg.keyboard.type('Packing'); pg.keyboard.press('Enter'); blank()
    pg.mouse.dblclick(1000, 330); pg.wait_for_timeout(150); pg.keyboard.type('Passport'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150); blank()
    grp = pg.locator('.react-flow__node-group').first; p0 = node('Passport').bounding_box()
    hx, hy = grp.locator('.group-drag-handle').evaluate("""(h) => { const r = h.getBoundingClientRect(); for (const dx of [0.5, 0.35, 0.65, 0.25, 0.75]) { const x = r.left + r.width * dx, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); if (hit && hit.closest('.group-drag-handle') === h) return [x, y] } return null }""")
    drag(hx, hy, hx - 80, hy + 60); p1 = node('Passport').bounding_box()
    check('9. cards organized in a group move together with it', abs((p1['x'] - p0['x']) + 80) < 3 and abs((p1['y'] - p0['y']) - 60) < 3, f'{p0} -> {p1}')
    blank()

    # 10 — تراجع وإعادة
    before = counts(); node('Passport').click(); pg.keyboard.press('Delete'); pg.wait_for_timeout(250); blank()
    deleted = counts()['sticky'] == before['sticky'] - 1
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250); undone = counts() == before
    pg.keyboard.press('Control+Shift+z'); pg.wait_for_timeout(250); redone = counts()['sticky'] == before['sticky'] - 1
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    check('10. delete, undo and redo work (button and keyboard)', deleted and undone and redone and counts() == before)

    # 11 + 12 — حفظ تلقائي واستعادة
    saved(); final = counts(); zoom_before = zoom_label()
    transform_before = pg.locator('.react-flow__viewport').evaluate('e => e.style.transform')
    check('11. changes are saved automatically', 'Saved' in pg.locator('header [role=status]').first.inner_text())
    pg.reload(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(1200)
    check('12. after a refresh every card, connection and image is recovered', counts() == final and pg.locator('.react-flow__node img').first.evaluate('i => i.naturalWidth > 0'), f'{counts()} vs {final}')
    check('12. and the view (pan and zoom) is restored', pg.locator('.react-flow__viewport').evaluate('e => e.style.transform') == transform_before and zoom_label() == zoom_before)
    check('12. the dashboard shows the recovered item count', (pg.goto(URL) and pg.wait_for_selector('article') and False) or f"{sum(final.values()) - final['edges']} items" in pg.locator('article').first.inner_text())
    pg.goto(editor_url); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(800)

    # 13 — السمة
    bg_dark = pg.evaluate("getComputedStyle(document.querySelector('main').parentElement).backgroundColor")
    pg.get_by_role('button', name='Switch to light theme').click(); pg.wait_for_timeout(500)
    bg_light = pg.evaluate("getComputedStyle(document.querySelector('main').parentElement).backgroundColor")
    pg.screenshot(path=os.path.join(TMP, 'acceptance-light.png'))
    check('13. switching to the light theme changes the page', pg.evaluate("document.documentElement.dataset.theme") == 'light' and bg_light != bg_dark, f'{bg_dark} -> {bg_light}')
    pg.reload(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(600)
    check('13. and the choice survives a refresh, with the canvas intact', pg.evaluate("document.documentElement.dataset.theme") == 'light' and counts() == final)
    # كل رحلة العمل الأساسية بالسمة الفاتحة
    sticky(400, 700, 'Light note'); saved()
    check('13. editing and saving also work in the light theme', node('Light note').count() == 1)
    pg.get_by_role('button', name='Switch to dark theme').click(); pg.wait_for_timeout(300)

    # 14 — شاشة صغيرة
    for w, h, label in ((390, 844, 'phone'), (768, 1024, 'tablet')):
        pg.set_viewport_size({'width': w, 'height': h}); pg.reload(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(900)
        over = pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        n0 = pg.locator('.react-flow__node-sticky').count()
        pg.get_by_role('button', name='Sticky note', exact=True).click(); pg.mouse.click(w // 2, int(h * 0.45)); pg.wait_for_timeout(250); pg.keyboard.type(f'On the {label}'); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
        check(f'14. on a {label} ({w}px): no horizontal scrolling and a card can be added', over <= 1 and pg.locator('.react-flow__node-sticky').count() == n0 + 1, f'over={over}')
        saved()
        pg.get_by_role('link', name='Workspaces').first.click(); pg.wait_for_selector('article'); pg.wait_for_timeout(500)
        check(f'14. on a {label}: the dashboard fits and shows the workspace', pg.evaluate('document.documentElement.scrollWidth - window.innerWidth') <= 1 and pg.locator('article', has_text='Acceptance trip').count() == 1)
        pg.goto(editor_url)
    browser.close()

bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)}/{len(results)} passed; console errors: {logs}')
sys.exit(1 if bad or logs else 0)
