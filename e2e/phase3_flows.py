"""
فحوصات المتصفح لمرحلة العلاقات (الوصلات، الصور، الروابط، المجموعات) على نسخة الإنتاج.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    pip install playwright && playwright install chromium
    python3 e2e/phase3_flows.py            # أو BASE_URL=http://127.0.0.1:5173/ للتطوير

لا يعتمد على ملفات خارجية: الصور التجريبية تُولَّد في مجلد مؤقت. يطبع PASS/FAIL لكل فحص
ويخرج برمز 1 إن فشل أي فحص أو ظهر خطأ في الـ console. اللقطات تُحفظ في مجلد مؤقت (يُطبع مساره).
هذا السكربت ليس جزءاً من CI بعد (انظر Roadmap في README).
"""
import base64, json, os, struct, sys, tempfile, zlib
from playwright.sync_api import sync_playwright

TMP = tempfile.mkdtemp(prefix='infinitespace-e2e-')
SHOTS = os.path.join(TMP, 'shots'); os.makedirs(SHOTS)

def make_png(path, w, h, c1, c2):
    """PNG متدرج بدون مكتبات خارجية (zlib + struct)."""
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            t = (x / w + y / h) / 2
            row += bytes(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
        rows.append(bytes(row))
    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)

AURORA = os.path.join(TMP, 'aurora.png'); DUNES = os.path.join(TMP, 'dunes.png'); OCEAN = os.path.join(TMP, 'ocean.png')
make_png(AURORA, 600, 400, (60, 30, 140), (240, 110, 190))   # 3:2
make_png(DUNES, 300, 400, (250, 170, 90), (120, 50, 40))
make_png(OCEAN, 500, 300, (10, 70, 120), (80, 220, 200))
TXT = os.path.join(TMP, 'not-an-image.txt'); open(TXT, 'w').write('hello')
FAKE = os.path.join(TMP, 'fake.png'); open(FAKE, 'w').write('this is not really a png')

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
results = []
def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))

def b64(path): return base64.b64encode(open(path,'rb').read()).decode()

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark')
    pg = ctx.new_page()
    logs = []
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))

    def node(text): return pg.locator('.react-flow__node', has_text=text).first
    def center(loc):
        bb = loc.bounding_box(); return bb['x'] + bb['width']/2, bb['y'] + bb['height']/2
    def handle_center(loc, side):
        h = loc.locator(f'.react-flow__handle[data-handleid="{side}"]')
        bb = h.bounding_box(); return bb['x'] + bb['width']/2, bb['y'] + bb['height']/2
    def new_sticky(x, y, text):
        pg.mouse.move(x, y); pg.mouse.dblclick(x, y)
        pg.wait_for_timeout(120); pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(120)
    def drag(x1, y1, x2, y2, steps=14):
        # أول حركة صغيرة تتجاوز عتبة السحب (nodeDragThreshold=3) فتبدأ العقدة بمتابعة المؤشر من هناك؛
        # بدونها تبدأ المتابعة بعد أول خطوة كبيرة فيضيع جزء من المسافة (سلوك React Flow لا خلل).
        pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x1 + 4, y1 + 4, steps=2)
        pg.mouse.move(x2 + 4, y2 + 4, steps=steps); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(200)
    def edge_point(edge):
        """نقطة على الوصلة لا يغطيها عنصر آخر (الوصلات تعترض المؤشر فوق المجموعات والبطاقات)."""
        return edge.locator('path.react-flow__edge-interaction').evaluate("""(p) => { const id = p.closest('.react-flow__edge').dataset.testid; const l = p.getTotalLength(); const m = p.getScreenCTM(); for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) { const pt = p.getPointAtLength(l * f); const x = pt.x * m.a + m.e, y = pt.y * m.d + m.f; const hit = document.elementFromPoint(x, y); if (hit && hit.closest('.react-flow__edge')?.dataset.testid === id) return [x, y] } return null }""")
    def header_point(group):
        """نقطة على شريط عنوان المجموعة لا تغطيها وصلة."""
        return group.locator('.group-drag-handle').evaluate("""(h) => { const r = h.getBoundingClientRect(); for (const dx of [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85]) { const x = r.left + r.width * dx, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); if (hit && hit.closest('.group-drag-handle') === h) return [x, y] } return null }""")
    def toasts(): return ' | '.join(t.inner_text() for t in pg.locator('[aria-live="polite"], [role="status"], [role="alert"]').all())

    # ── إنشاء المساحة ──
    pg.goto(URL)
    pg.get_by_role('button', name='Create workspace').first.click()
    pg.get_by_placeholder('Learning Roadmap').fill('Visual research')
    pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow')
    check('editor opens for the new workspace', '/w/' in pg.url)

    # ── ملاحظات ──
    new_sticky(330, 300, 'Research ideas'); new_sticky(780, 230, 'Interview users'); new_sticky(780, 560, 'Prototype v1')
    check('three sticky notes created', pg.locator('.sticky-note').count() == 3)

    # ── وصل بالسحب من المقابض ──
    a, b, c = node('Research ideas'), node('Interview users'), node('Prototype v1')
    a.hover(); pg.wait_for_timeout(250)
    check('handles appear on hover', a.locator('.connect-handle').first.evaluate('e => getComputedStyle(e).opacity') == '1')
    x1, y1 = handle_center(a, 'right'); b.hover(); pg.wait_for_timeout(150); x2, y2 = handle_center(b, 'left')
    a.hover(); drag(x1, y1, x2, y2)
    check('drag from handle creates an edge', pg.locator('.react-flow__edge').count() == 1, str(pg.locator('.react-flow__edge').count()))
    check('new edge is selected and the properties panel shows Connection', pg.locator('aside[aria-label="Properties"]').inner_text().startswith('Connection'))

    # ── أداة الوصل بالنقر ──
    pg.mouse.move(600, 700); pg.keyboard.press('c')
    check('connect tool shows its hint', 'start from' in toasts() or pg.get_by_text('Click the item to start from').count() == 1)
    pg.mouse.click(*center(a)); pg.wait_for_timeout(120)
    check('first click highlights the source', pg.locator('.connect-source').count() == 1)
    pg.mouse.click(*center(c)); pg.wait_for_timeout(250)
    check('second click creates the second edge and leaves the connect tool', pg.locator('.react-flow__edge').count() == 2 and pg.locator('.canvas-root').get_attribute('data-tool') == 'select')
    pg.keyboard.press('c'); pg.mouse.click(*center(a)); pg.mouse.click(*center(c)); pg.wait_for_timeout(250)
    check('duplicate connection is refused with a message', 'already connected' in toasts() and pg.locator('.react-flow__edge').count() == 2, toasts())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)

    # ── "Connect to…" من لوحة الخصائص ──
    pg.mouse.click(200, 150); pg.mouse.click(*center(b)); pg.wait_for_timeout(150)
    pg.locator('aside[aria-label="Properties"]').get_by_role('button', name='Connect to…').click(); pg.wait_for_timeout(150)
    check('Connect to… arms the tool with the card as source', pg.locator('.connect-source').count() == 1 and pg.locator('.canvas-root').get_attribute('data-tool') == 'connect')
    pg.mouse.click(*center(c)); pg.wait_for_timeout(250)
    check('Connect to… then a click on another card creates the connection', pg.locator('.react-flow__edge').count() == 3, str(pg.locator('.react-flow__edge').count()))

    # ── تحرير الوصلة من اللوحة ──
    pg.mouse.click(200, 150)  # فراغ: إلغاء التحديد
    mid = edge_point(pg.locator('.react-flow__edge').first)
    pg.mouse.click(mid[0], mid[1]); pg.wait_for_timeout(200)
    panel = pg.locator('aside[aria-label="Properties"]')
    check('clicking an edge selects it', panel.count() == 1 and 'Connection' in panel.inner_text() and pg.locator('.edge-midpoint').count() == 1)
    panel.get_by_role('button', name='Dashed').click(); panel.get_by_role('button', name='Arrows at both ends').click()
    panel.get_by_label('Connection label').fill('leads to'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check('edge label rendered', pg.locator('.edge-label', has_text='leads to').count() == 1)
    first_path = pg.locator('.react-flow__edge').first.locator('path.react-flow__edge-path')
    cs = first_path.evaluate('e => { const c = getComputedStyle(e); return [c.strokeDasharray, c.markerStart, c.markerEnd] }')
    check('edge is dashed with start and end arrows', cs[0] != 'none' and cs[1] != 'none' and cs[2] != 'none', str(cs))
    check('edge uses a gradient stroke', 'edge-gradient-' in (first_path.evaluate('e => getComputedStyle(e).stroke') or ''))
    pg.screenshot(path=SHOTS + '/01-edges.png')

    # ── صور: اختيار ملفات ──
    pg.mouse.click(200, 150)
    with pg.expect_file_chooser() as fc:
        pg.get_by_role('button', name='Add image').click()
    fc.value.set_files([AURORA, DUNES])
    pg.wait_for_selector('.react-flow__node img', timeout=8000); pg.wait_for_timeout(500)
    check('two image cards with decoded pictures', pg.locator('.react-flow__node img').count() == 2)
    ok = pg.locator('.react-flow__node img').first.evaluate('i => i.complete && i.naturalWidth > 0')
    check('image bytes round-trip through IndexedDB and render', ok)
    # نسبة الأبعاد
    img_node = pg.locator('.react-flow__node', has=pg.locator('img')).first
    ar = img_node.locator('img').evaluate('i => i.parentElement.getBoundingClientRect().width / i.parentElement.getBoundingClientRect().height')
    check('image keeps its aspect ratio (1200x800 = 1.5)', abs(ar - 1.5) < 0.02, str(ar))

    # ── رفض ملفات غير صالحة ──
    with pg.expect_file_chooser() as fc:
        pg.get_by_role('button', name='Add image').click()
    fc.value.set_files([TXT, FAKE]); pg.wait_for_timeout(600)
    t = toasts()
    check('non-image and corrupt files are rejected with readable messages', 'not a supported image' in t and 'could not be read' in t, t)
    check('no card was created for rejected files', pg.locator('.react-flow__node img').count() == 2)

    # ── خصائص الصورة ──
    top_img = pg.locator('.react-flow__node-image').last   # الأحدث فوق السابقة (تراكب متدرّج)
    summary = pg.locator('aside[aria-label="Properties"]').inner_text() if pg.locator('aside[aria-label="Properties"]').count() else ''
    check('adding two images selects both and the panel summarizes the selection', '2 items selected' in summary, summary[:60])
    pg.mouse.click(200, 150); pg.wait_for_timeout(100)    # فراغ: نلغي التحديد المتعدد
    pg.mouse.click(*center(top_img)); pg.wait_for_timeout(200)
    panel = pg.locator('aside[aria-label="Properties"]')
    img_node = top_img
    check('image properties panel opens', panel.count() == 1 and 'Image' in panel.inner_text())
    panel.get_by_label('Title').fill('Aurora'); pg.keyboard.press('Enter')
    panel.get_by_label('Description').fill('Moodboard reference'); panel.get_by_label('Description').press('Control+Enter')
    panel.get_by_role('textbox', name='Tags').fill('moodboard'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check('image title, description and tag appear on the card', 'Aurora' in img_node.inner_text() and 'Moodboard reference' in img_node.inner_text() and '#moodboard' in img_node.inner_text(), img_node.inner_text())
    img_node.dblclick(); pg.wait_for_timeout(250)
    check('double-click opens the large preview dialog', pg.locator('dialog[open] img').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check('Escape closes the preview', pg.locator('dialog[open]').count() == 0)

    # ── استبدال الصورة وتغيير العرض ──
    panel = pg.locator('aside[aria-label="Properties"]')
    before_src = top_img.locator('img').get_attribute('src')
    with pg.expect_file_chooser() as fc:
        panel.get_by_role('button', name='Replace image').click()
    fc.value.set_files(OCEAN); pg.wait_for_timeout(800)
    check('Replace image swaps the picture and keeps the caption',
          top_img.locator('img').get_attribute('src') != before_src and 'Aurora' in top_img.inner_text())
    panel.get_by_label('Width').fill('420'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    wh = top_img.locator('img').evaluate("i => { const r = i.parentElement.getBoundingClientRect(); return [r.width, r.height] }")
    check('setting the width in the panel keeps the replaced image aspect ratio (500x300)',
          abs(wh[0] - (420 - 2 - 20)) < 2 and abs(wh[0] / wh[1] - 500 / 300) < 0.03, str(wh))
    pg.screenshot(path=SHOTS + '/02-images.png')


    # ── الروابط ──
    pg.mouse.click(200, 150); pg.mouse.move(1000, 640); pg.keyboard.press('l'); pg.wait_for_timeout(200)
    pg.get_by_label('Link address').fill('example.com/docs'); pg.keyboard.press('Enter')
    pg.get_by_label('Title').fill('Product docs'); pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(250)
    anchor = pg.locator('.react-flow__node a[href]')
    check('link card normalizes the address and opens safely in a new tab',
          anchor.count() == 1 and anchor.get_attribute('href') == 'https://example.com/docs' and anchor.get_attribute('target') == '_blank' and 'noopener' in (anchor.get_attribute('rel') or ''),
          str(anchor.get_attribute('href')) if anchor.count() else 'none')
    pg.mouse.click(200, 150); pg.mouse.move(400, 780); pg.keyboard.press('l'); pg.wait_for_timeout(200)
    pg.get_by_label('Link address').fill('javascript:alert(1)'); pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(200)
    check('javascript: address is rejected with an inline error and the editor stays open',
          pg.get_by_role('alert').filter(has_text='valid web address').count() == 1 and pg.get_by_label('Link address').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    check('leaving with an invalid address keeps no link and informs the user',
          pg.locator('.react-flow__node a[href]').count() == 1 and 'not valid' in toasts(), toasts())
    pg.screenshot(path=SHOTS + '/03-links.png')

    # ── حذف بطاقات الصور (وتفريغ المنطقة المتداخلة مع الورقة التي سنجرّب بها المجموعات) ──
    for _ in range(2):
        pg.mouse.click(200, 150)
        pg.mouse.click(*center(pg.locator('.react-flow__node-image').last)); pg.keyboard.press('Delete'); pg.wait_for_timeout(200)
    check('Delete removes image cards', pg.locator('.react-flow__node-image').count() == 0)

    # ── المجموعات ──
    pg.mouse.click(200, 150); pg.mouse.move(250, 560); pg.keyboard.press('g'); pg.wait_for_timeout(200)
    pg.keyboard.type('Ideas'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    grp = pg.locator('.react-flow__node-group').first
    check('group created with a name', grp.count() == 1 and 'Ideas' in grp.inner_text())
    gbb = grp.bounding_box()
    # نسحب ورقة "Prototype v1" إلى داخل المجموعة
    pbb = node('Prototype v1').bounding_box()
    drag(pbb['x'] + 40, pbb['y'] + 40, gbb['x'] + 130, gbb['y'] + 130)
    pbb2 = node('Prototype v1').bounding_box()
    check('dropping a note inside the frame moved it there', pbb2['x'] < gbb['x'] + gbb['width'] and abs(pbb2['x'] - (gbb['x'] + 90)) < 6, str(pbb2))
    # نحرك المجموعة من شريط العنوان: العضو يتبعها
    before = node('Prototype v1').bounding_box()
    hx, hy = header_point(grp)
    drag(hx, hy, hx + 90, hy + 60)
    after = node('Prototype v1').bounding_box()
    check('moving the group moves its member with it', abs((after['x'] - before['x']) - 90) < 4 and abs((after['y'] - before['y']) - 60) < 4, f"{before} -> {after}")
    # سحب العضو خارج المجموعة يحرره
    gnow = grp.bounding_box(); mnow = node('Prototype v1').bounding_box()
    drag(mnow['x'] + 40, mnow['y'] + 40, gnow['x'] + gnow['width'] + 260, gnow['y'] + 40)
    mout = node('Prototype v1').bounding_box()
    hx, hy = header_point(grp)
    drag(hx, hy, hx, hy + 100)
    mout2 = node('Prototype v1').bounding_box()
    check('a note dragged out of the frame no longer follows it', abs(mout2['y'] - mout['y']) < 3, f"{mout} -> {mout2}")
    pg.screenshot(path=SHOTS + '/04-groups.png')
    # حذف المجموعة لا يحذف أعضاءها: نعيد العضو إلى الداخل ثم نحذف
    gnow = grp.bounding_box(); mnow = node('Prototype v1').bounding_box()
    drag(mnow['x'] + 40, mnow['y'] + 40, gnow['x'] + 150, gnow['y'] + 170)
    keep = node('Prototype v1').bounding_box()
    pg.mouse.click(*header_point(grp)); pg.keyboard.press('Delete'); pg.wait_for_timeout(250)
    after_del = node('Prototype v1').bounding_box()
    check('deleting a group removes the frame but keeps its notes in place', pg.locator('.react-flow__node-group').count() == 0 and node('Prototype v1').count() == 1 and abs(after_del['x'] - keep['x']) < 3 and abs(after_del['y'] - keep['y']) < 3, f"{keep} -> {after_del}")

    # ── سحب وإفلات ولصق صور ──
    def dt_with(path, name, mime):
        return pg.evaluate_handle("""([b64, name, mime]) => { const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); const dt = new DataTransfer(); dt.items.add(new File([arr], name, { type: mime })); return dt }""", [b64(path), name, mime])
    n0 = pg.locator('.react-flow__node img').count()
    dt = dt_with(OCEAN, 'ocean.png', 'image/png')
    pg.dispatch_event('.canvas-root', 'dragover', {'dataTransfer': dt, 'clientX': 900, 'clientY': 300})
    check('dragging a file over the canvas shows the drop overlay', pg.locator('.drop-overlay').count() == 1)
    pg.dispatch_event('.canvas-root', 'drop', {'dataTransfer': dt, 'clientX': 1000, 'clientY': 180}); pg.wait_for_timeout(700)
    check('dropping an image adds a card', pg.locator('.react-flow__node img').count() == n0 + 1 and pg.locator('.drop-overlay').count() == 0)
    dt2 = dt_with(DUNES, 'pasted.png', 'image/png')
    pg.mouse.click(200, 150); pg.mouse.move(520, 420)
    pg.evaluate("dt => window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))", dt2); pg.wait_for_timeout(700)
    check('pasting an image from the clipboard adds a card', pg.locator('.react-flow__node img').count() == n0 + 2)

    # ── حذف وتكرار ──
    ec = pg.locator('.react-flow__edge').count()
    mid = edge_point(pg.locator('.react-flow__edge').last)
    pg.mouse.click(mid[0], mid[1]); pg.keyboard.press('Delete'); pg.wait_for_timeout(200)
    check('Delete removes a selected edge', pg.locator('.react-flow__edge').count() == ec - 1)
    nn = pg.locator('.react-flow__node').count(); ee = pg.locator('.react-flow__edge').count()
    pg.mouse.click(*center(node('Research ideas'))); pg.keyboard.press('Delete'); pg.wait_for_timeout(250)
    check('deleting a node removes its connected edges', pg.locator('.react-flow__node').count() == nn - 1 and pg.locator('.react-flow__edge').count() < ee)
    pg.mouse.click(200, 150); pg.keyboard.press('Control+a'); pg.keyboard.press('Control+d'); pg.wait_for_timeout(300)
    check('duplicating the whole selection doubles the cards', pg.locator('.react-flow__node').count() == (nn - 1) * 2, f"{pg.locator('.react-flow__node').count()} vs {(nn-1)*2}")
    pg.screenshot(path=SHOTS + '/05-full.png')

    # ── السمة الفاتحة والجوال ──
    pg.get_by_role('button', name='Switch to light theme').click() if pg.get_by_role('button', name='Switch to light theme').count() else pg.locator('button[aria-label*="theme" i]').first.click()
    pg.wait_for_timeout(500); pg.screenshot(path=SHOTS + '/06-light.png')
    check('light theme applied', pg.evaluate("document.documentElement.dataset.theme") == 'light')

    browser.close()

bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)}/{len(results)} passed; console errors: {logs}; screenshots: {SHOTS}')
sys.exit(1 if bad or logs else 0)
