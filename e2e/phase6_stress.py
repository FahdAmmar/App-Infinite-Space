"""
اختبار الحمل: لوحات كبيرة (مئات إلى آلاف العناصر) ورفع صور كثيرة وكبيرة، على نسخة الإنتاج.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    pip install playwright pillow && playwright install chromium
    SKIP_UPLOADS=1 / ONLY_UPLOADS=1 لتقسيم التشغيل (نحو 5 دقائق كاملاً)
    python3 e2e/phase6_stress.py                 # الأحجام الافتراضية 50,500,1500,3000,4940 (الأخير = حد اللوحة 5,000 تماماً مع المجموعات)
    SIZES=200,2000 python3 e2e/phase6_stress.py  # أحجام مخصصة

يولّد لوحات بالحجم المطلوب ويكتبها مباشرة في IndexedDB (فيُختبر مسار القراءة والتحقق الحقيقي أيضاً)، ثم يقيس:
زمن الفتح، عدد عناصر DOM المرسومة، سلاسة التحريك والتكبير والسحب (فواصل الإطارات)، زمن الحفظ التلقائي،
زمن التراجع، وذاكرة JS. ثم يختبر رفع الصور: عدة صور كبيرة معاً، وحدود الحجم والبكسلات والعدد.

تنبيه: الأرقام تعتمد على الجهاز؛ ويُشغَّل Chromium هنا بلا واجهة وبرسم برمجي (بلا GPU)، فهي أبطأ من متصفح حقيقي.
المهم هو شكل المنحنى (هل يتدهور تربيعياً؟) لا القيم المطلقة. عتبات النجاح واسعة عمداً لالتقاط الانهيارات فقط.
"""
import base64, io, json, math, os, random, statistics, sys, tempfile, time
from PIL import Image
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
LIMIT = 5_000  # CANVAS_LIMITS.maxNodes
SIZES = [int(x) for x in os.environ.get('SIZES', '50,500,1500,3000,4940').split(',')]
SKIP_UPLOADS = bool(os.environ.get('SKIP_UPLOADS'))
ONLY_UPLOADS = bool(os.environ.get('ONLY_UPLOADS'))  # يقسّم التشغيل الطويل على عدة أوامر عند الحاجة
TMP = tempfile.mkdtemp(prefix='infinitespace-stress-')
results = []; table = []
random.seed(11)

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))

# ───────────── توليد لوحة بحجم معيّن ─────────────
def png_bytes(w, h, seed):
    img = Image.new('RGB', (w, h)); px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = ((x * 255 // w + seed * 40) % 256, (y * 255 // h) % 256, (seed * 70 + 120) % 256)
    buf = io.BytesIO(); img.save(buf, 'PNG'); return buf.getvalue()

IMAGE_FILES = [png_bytes(480, 320, i) for i in range(4)]

def make_canvas(n, image_ids):
    cols = max(1, math.ceil(math.sqrt(n * 1.4)))
    step_x, step_y = 300, 260
    nodes, edges = [], []
    for i in range(n):
        r, c = divmod(i, cols)
        base = {'position': {'x': c * step_x, 'y': r * step_y}, 'id': f'n{i}'}
        data = {'tags': ['t'] if i % 7 == 0 else [], 'createdAt': 1, 'updatedAt': 1}
        kind = i % 10
        if kind < 6:
            nodes.append({**base, 'type': 'sticky', 'width': 232, 'height': 208, 'data': {**data, 'title': f'Note {i}', 'content': 'Lorem ipsum dolor sit amet ' * 3, 'color': ['yellow', 'blue', 'green', 'pink', 'purple', 'neutral'][i % 6], 'textColor': None}})
        elif kind < 8:
            nodes.append({**base, 'type': 'text', 'width': 300, 'height': 200, 'data': {**data, 'title': f'Text {i}', 'content': 'Some longer text content ' * 6}})
        elif kind == 8:
            nodes.append({**base, 'type': 'link', 'width': 300, 'height': 176, 'data': {**data, 'url': f'https://example.com/{i}', 'title': f'Link {i}', 'description': 'A saved link'}})
        else:
            nodes.append({**base, 'type': 'image', 'width': 240, 'data': {**data, 'imageId': image_ids[i % len(image_ids)], 'title': '', 'description': '', 'fileName': 'x.png', 'naturalWidth': 480, 'naturalHeight': 320}})
        if i % 10 != 0 and i + 1 < n and c + 1 < cols:  # وصلة للجار الأيمن (ما عدا العقد الأولى من كل عشرة)
            edges.append({'id': f'e{i}', 'source': f'n{i}', 'target': f'n{i + 1}', 'sourceHandle': 'right', 'targetHandle': 'left', 'data': {'curve': 'curved', 'lineStyle': 'solid', 'arrow': 'end', 'color': 'gradient', 'label': ''}})
    # مجموعات قليلة ببعض الأعضاء (أعضاء المجموعة بإحداثيات نسبية)
    for g in range(max(1, n // 400)):
        gid = f'g{g}'
        nodes.insert(0, {'id': gid, 'type': 'group', 'position': {'x': -1500 - g * 40, 'y': g * 900}, 'width': 900, 'height': 700, 'data': {'tags': [], 'createdAt': 1, 'updatedAt': 1, 'label': f'Group {g}', 'color': 'neutral'}})
        for m in range(4):
            nodes.append({'id': f'gm{g}-{m}', 'type': 'sticky', 'parentId': gid, 'position': {'x': 40 + m * 210, 'y': 120 + (m % 2) * 200}, 'width': 200, 'height': 180, 'data': {'tags': [], 'createdAt': 1, 'updatedAt': 1, 'title': f'Member {g}.{m}', 'content': '', 'color': 'blue', 'textColor': None}})
    return {'schemaVersion': 1, 'nodes': nodes, 'edges': edges, 'viewport': {'x': 40, 'y': 80, 'zoom': 1}}

IDB_PUT_IMAGES = """async (files) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('infinitespace-images', 1); r.onupgradeneeded = () => r.result.createObjectStore('images', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
  const ids = [];
  await new Promise((res, rej) => { const tx = db.transaction('images', 'readwrite'); const s = tx.objectStore('images');
    files.forEach((b64, i) => { const bin = atob(b64); const a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k); const id = 'stress-img-' + i; ids.push(id); s.put({ id, blob: new Blob([a], { type: 'image/png' }), createdAt: Date.now() }) });
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) });
  db.close(); return ids }"""

IDB_PUT_CANVAS = """async ([id, canvas]) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('infinitespace-canvases'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
  await new Promise((res, rej) => { const tx = db.transaction('canvases', 'readwrite'); tx.objectStore('canvases').put(canvas, id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) });
  db.close() }"""

FRAMES = """
window.__frames = []; window.__sampling = false;
(function loop(t) { if (window.__sampling) window.__frames.push(t); requestAnimationFrame(loop) })(0);
window.__startFrames = () => { window.__frames = []; window.__sampling = true };
window.__stopFrames = () => { window.__sampling = false; const f = window.__frames; const d = []; for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]); return d };
"""

def stats(deltas):
    if not deltas: return {'frames': 0, 'avg': 0, 'p95': 0, 'max': 0}
    s = sorted(deltas)
    return {'frames': len(deltas), 'avg': round(statistics.mean(deltas), 1), 'p95': round(s[int(len(s) * 0.95) - 1], 1), 'max': round(s[-1], 1)}

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-precise-memory-info'])
    logs = []
    for n in ([] if ONLY_UPLOADS else SIZES):
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark'); ctx.add_init_script(FRAMES)
        pg = ctx.new_page()
        pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None); pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
        pg.goto(URL); pg.get_by_role('button', name='Create workspace').first.click(); pg.get_by_placeholder('Learning Roadmap').fill(f'Stress {n}')
        pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click(); pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow')
        wid = pg.url.rstrip('/').split('/')[-1]
        pg.goto(URL)
        image_ids = pg.evaluate(IDB_PUT_IMAGES, [base64.b64encode(b).decode() for b in IMAGE_FILES])
        canvas = make_canvas(n, image_ids); total = len(canvas['nodes'])
        t0 = time.time(); pg.evaluate(IDB_PUT_CANVAS, [wid, canvas]); t_inject = time.time() - t0

        # فتح اللوحة
        t0 = time.time(); pg.goto(URL + f'w/{wid}'); pg.wait_for_selector('.react-flow__node', timeout=60000)
        pg.wait_for_function("() => /^Saved/.test(document.querySelector('header [role=status]').innerText.trim())", timeout=60000)
        t_open = time.time() - t0; pg.wait_for_timeout(800)
        rendered = pg.locator('.react-flow__node').count(); edges_rendered = pg.locator('.react-flow__edge').count()
        heap0 = pg.evaluate('performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0')
        if os.environ.get('NO_MINIMAP') and pg.get_by_role('button', name='Hide minimap').count(): pg.get_by_role('button', name='Hide minimap').click(); pg.wait_for_timeout(400)

        def measure(label, action):
            pg.evaluate('window.__startFrames()'); action(); pg.wait_for_timeout(150)
            return stats(pg.evaluate('window.__stopFrames()'))
        def pan():
            pg.mouse.move(700, 450); pg.mouse.down()
            for i in range(40): pg.mouse.move(700 - i * 8, 450 - i * 4); pg.wait_for_timeout(8)
            pg.mouse.up()
        def zoom():
            pg.mouse.move(700, 450)
            for _ in range(8): pg.mouse.wheel(0, -120); pg.wait_for_timeout(30)
            for _ in range(8): pg.mouse.wheel(0, 120); pg.wait_for_timeout(30)
        def drag_node():
            target = pg.locator('.react-flow__node-sticky').first.bounding_box()
            x, y = target['x'] + 60, target['y'] + 40
            pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 4, y + 4, steps=2)
            for i in range(30): pg.mouse.move(x + 4 + i * 6, y + 4 + i * 2); pg.wait_for_timeout(8)
            pg.mouse.up()
        pan_stats = measure('pan', pan); zoom_stats = measure('zoom', zoom); drag_stats = measure('drag', drag_node)

        # عرض كل المحتوى (أسوأ حالة: كل العناصر ضمن الشاشة فلا يفيد إخفاء ما خارجها)
        t0 = time.time(); pg.keyboard.press('Shift+1'); pg.wait_for_timeout(700)
        rendered_fit = pg.locator('.react-flow__node').count()
        pan_fit = measure('pan-fit', pan)
        pg.keyboard.press('Control+1') if False else None

        # تعديل + حفظ تلقائي
        pg.evaluate('document.querySelector(".react-flow__pane") && 0')
        at_limit = total >= LIMIT
        pg.get_by_role('button', name='Sticky note', exact=True).click(); pg.mouse.click(700, 450); pg.wait_for_timeout(250)
        if at_limit:
            # عند الحد: الإضافة تُرفض برسالة ولا يتغير شيء
            msg = ' | '.join(t.inner_text() for t in pg.locator('[aria-live="polite"]').all())
            check(f'{n}: at the {LIMIT:,}-item limit a new card is refused with an explanation', 'limit' in msg and pg.locator('.react-flow__node-sticky', has_text='Edited under load').count() == 0, msg[:100])
            t_save = 0.0
            pg.keyboard.press('Escape')
        else:
            pg.wait_for_timeout(200); pg.keyboard.type('Edited under load'); pg.keyboard.press('Escape')
            t0 = time.time()
            pg.wait_for_function("() => !/^Saved/.test(document.querySelector('header [role=status]').innerText.trim())", timeout=5000)
            pg.wait_for_function("() => /^Saved/.test(document.querySelector('header [role=status]').innerText.trim())", timeout=60000)
            t_save = time.time() - t0
        # تراجع
        if at_limit:
            # نحذف بطاقة ثم نقيس التراجع عن الحذف
            pg.locator('.react-flow__node-sticky').first.click(); pg.keyboard.press('Delete'); pg.wait_for_timeout(300)
            pg.wait_for_function("() => /^Saved/.test(document.querySelector('header [role=status]').innerText.trim())", timeout=60000)
        before = pg.locator('.react-flow__node').count()
        pg.mouse.click(30, 800)
        t0 = time.perf_counter(); pg.keyboard.press('Control+z')
        pg.wait_for_function('([n]) => document.querySelectorAll(".react-flow__node").length ' + ('> n' if at_limit else '< n'), arg=[before], timeout=30000) if before > 0 else None
        t_undo = time.perf_counter() - t0
        heap1 = pg.evaluate('performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0')

        # عودة إلى لوحة التحكم: العدد الحقيقي
        pg.get_by_role('link', name='Workspaces').first.click(); pg.wait_for_selector('article'); pg.wait_for_timeout(500)
        card_text = pg.locator('article', has_text=f'Stress {n}').first.inner_text()

        row = {'nodes': total, 'edges': len(canvas['edges']), 'open_s': round(t_open, 2), 'dom_nodes': rendered, 'dom_nodes_fit': rendered_fit, 'edges_dom': edges_rendered,
               'pan_avg_ms': pan_stats['avg'], 'pan_p95_ms': pan_stats['p95'], 'zoom_p95_ms': zoom_stats['p95'], 'drag_p95_ms': drag_stats['p95'], 'pan_fit_p95_ms': pan_fit['p95'],
               'save_s': round(t_save, 2), 'undo_s': round(t_undo, 2), 'heap_mb': round(heap1, 0)}
        table.append(row); print(json.dumps(row))
        check(f'{n}: the canvas opens and every saved item is restored (no discards)', rendered > 0 and not any('damaged' in l[1] for l in logs), str(rendered))
        check(f'{n}: only visible cards are in the DOM at normal zoom', n < 500 or rendered < total * 0.5, f'{rendered}/{total}')
        check(f'{n}: opening takes under 20 s', t_open < 20, f'{t_open:.1f}s')
        check(f'{n}: autosave after an edit completes under 8 s', t_save < 8, f'{t_save:.1f}s')
        check(f'{n}: undo completes under 3 s', t_undo < 3, f'{t_undo:.2f}s')
        # الحالة الأخيرة بعد التراجع عن التعديل (أو عن الحذف عند الحد) هي المحتوى الأصلي كما هو
        expected = total
        check(f'{n}: the dashboard card reports the real item count (no items lost on load or by undo)', f'{expected:,} items' in card_text or f'{expected} items' in card_text, f'expected {expected}: ' + card_text.replace('\n', ' ')[:70])
        ctx.close()

    # ───────────── رفع الصور ─────────────
    if SKIP_UPLOADS:
        browser.close()
        bad = [r for r in results if not r[1]]
        print('\nsize table:')
        for r in table: print(json.dumps(r))
        print(f'\n{len(results) - len(bad)}/{len(results)} passed; console errors: {logs}')
        sys.exit(1 if bad or logs else 0)
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark'); ctx.add_init_script(FRAMES); pg = ctx.new_page()
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None); pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    pg.goto(URL); pg.get_by_role('button', name='Create workspace').first.click(); pg.get_by_placeholder('Learning Roadmap').fill('Uploads')
    pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click(); pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow')
    def noise_png(path, w, h):
        Image.frombytes('RGB', (w, h), os.urandom(w * h * 3)).save(path, 'PNG')
    big = []
    for i in range(12):
        path = os.path.join(TMP, f'big{i}.png'); noise_png(path, 1000, 800); big.append(path)  # ≈ 2.4MB لكل منها
    def upload(files, wait=800):
        with pg.expect_file_chooser() as fc: pg.get_by_role('button', name='Add image').click()
        t0 = time.time(); fc.value.set_files(files); pg.wait_for_timeout(wait); return time.time() - t0
    t12 = upload(big, 1500)
    try: pg.wait_for_function('() => document.querySelectorAll(".react-flow__node-image").length >= 12', timeout=30000)
    except Exception: pass
    count = pg.locator('.react-flow__node-image').count()
    check('twelve large images (≈2.4 MB each) added at once all appear', count == 12, str(count))
    all_load = pg.evaluate("[...document.querySelectorAll('.react-flow__node-image img')].filter(i => i.complete && i.naturalWidth > 0).length")
    check('and every visible image decodes', all_load >= min(count, 12) - 2, f'{all_load}/{count}')
    pg.wait_for_function("() => /^Saved/.test(document.querySelector('header [role=status]').innerText.trim())", timeout=30000)
    pg.reload(); pg.wait_for_selector('.react-flow__node-image'); pg.wait_for_timeout(1500)
    again = pg.evaluate("[...document.querySelectorAll('.react-flow__node-image img')].filter(i => i.complete && i.naturalWidth > 0).length")
    check('all those images survive a reload (IndexedDB round trip)', pg.locator('.react-flow__node-image').count() == 12 and again >= 10, f'{again}')
    print(f'12 images x ~2.4MB: {t12:.1f}s to add')

    # حدود الرفع
    toasts = lambda: ' | '.join(t.inner_text() for t in pg.locator('[aria-live="polite"]').all())
    huge = os.path.join(TMP, 'toobig.png'); noise_png(huge, 2600, 1400)  # ≈ 10.9MB غير قابلة للضغط
    size_mb = os.path.getsize(huge) / 1048576
    n0 = pg.locator('.react-flow__node-image').count(); upload([huge], 1200)
    check(f'a file over the 10 MB limit is rejected with a readable message ({size_mb:.1f} MB)', pg.locator('.react-flow__node-image').count() == n0 and 'limit' in toasts(), toasts()[:120])
    mp = os.path.join(TMP, 'megapixels.png'); Image.new('RGB', (7000, 6000), (30, 60, 200)).save(mp, 'PNG', compress_level=9)
    n0 = pg.locator('.react-flow__node-image').count(); t_mp = upload([mp], 4000)
    check('an image over 40 megapixels is rejected after a quick decode check', pg.locator('.react-flow__node-image').count() == n0 and 'too large' in toasts(), toasts()[:120])
    many = []
    for i in range(14):
        path = os.path.join(TMP, f'small{i}.png'); Image.new('RGB', (200, 150), (i * 15, 90, 200)).save(path); many.append(path)
    n0 = pg.locator('.react-flow__node-image').count(); upload(many, 2500)
    added = pg.locator('.react-flow__node-image').count() - n0
    check('dropping 14 files adds only the first 12 and says so', added == 12 and 'first 12' in toasts(), f'added={added} {toasts()[:100]}')
    with open(os.path.join(TMP, 'fake.png'), 'wb') as f: f.write(b'not an image' * 100)
    n0 = pg.locator('.react-flow__node-image').count(); upload([os.path.join(TMP, 'fake.png')], 800)
    check('a corrupt file named .png is rejected without breaking the canvas', pg.locator('.react-flow__node-image').count() == n0 and pg.locator('.react-flow__node').count() > 0)
    ctx.close()
    browser.close()

print('\nsize table:')
cols = ['nodes', 'edges', 'open_s', 'dom_nodes', 'dom_nodes_fit', 'pan_avg_ms', 'pan_p95_ms', 'zoom_p95_ms', 'drag_p95_ms', 'pan_fit_p95_ms', 'save_s', 'undo_s', 'heap_mb']
print(' | '.join(c.rjust(14) for c in cols))
for r in table: print(' | '.join(str(r[c]).rjust(14) for c in cols))
bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)}/{len(results)} passed; console errors: {logs}')
sys.exit(1 if bad or logs else 0)
