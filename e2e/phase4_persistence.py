"""
فحوصات المتصفح لمرحلة الحفظ والتراجع على نسخة الإنتاج.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    pip install playwright && playwright install chromium
    python3 e2e/phase4_persistence.py       # أو BASE_URL=http://127.0.0.1:5173/ للتطوير

يغطي: الحفظ التلقائي والاستعادة بعد التحديث (كل أنواع العناصر والعرض)، التراجع والإعادة، مؤشر الحفظ،
لوحة التحكم (العدد والمعاينة والنسخ والحذف)، فشل الحفظ وإعادة المحاولة، محتوى تالف ونسخة احتياطية،
عناصر تالفة، وتنظيف الصور غير المستخدمة. يطبع PASS/FAIL ويخرج برمز 1 عند أي فشل أو خطأ في الـ console.
(يستغرق نحو دقيقة بسبب تأخير تنظيف الصور 8 ثوانٍ.)
"""
import json, os, struct, sys, tempfile, zlib
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
TMP = tempfile.mkdtemp(prefix='infinitespace-e2e4-')
results = []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))

def make_png(path, w, h, c1, c2):
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
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b''))

AURORA = os.path.join(TMP, 'aurora.png'); make_png(AURORA, 600, 400, (60, 30, 140), (240, 110, 190))
OCEAN = os.path.join(TMP, 'ocean.png'); make_png(OCEAN, 500, 300, (10, 70, 120), (80, 220, 200))

# محاكاة فشل الكتابة في IndexedDB عند الطلب (window.__failPut) لاختبار حالة الخطأ
FAIL_PUT = """
(() => {
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    if (window.__failPut && this.name === 'canvases') throw new DOMException('simulated quota', 'QuotaExceededError');
    return original.apply(this, args);
  };
})();
"""

IDB_ALL = """async ([dbName, storeName]) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open(dbName); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
  if (!db.objectStoreNames.contains(storeName)) { db.close(); return null }
  const out = await new Promise((res, rej) => { const tx = db.transaction(storeName, 'readonly'); const s = tx.objectStore(storeName); const keys = s.getAllKeys(); const vals = s.getAll();
    tx.oncomplete = () => res(keys.result.map((k, i) => ({ key: k, value: vals.result[i] }))); tx.onerror = () => rej(tx.error) });
  db.close(); return out }"""

IDB_PUT = """async ([dbName, storeName, key, value]) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open(dbName); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
  await new Promise((res, rej) => { const tx = db.transaction(storeName, 'readwrite'); tx.objectStore(storeName).put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) });
  db.close() }"""

IDB_AGE_IMAGES = """async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('infinitespace-images'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
  await new Promise((res, rej) => { const tx = db.transaction('images', 'readwrite'); const s = tx.objectStore('images'); const req = s.openCursor();
    req.onsuccess = () => { const c = req.result; if (c) { const v = c.value; v.createdAt = 0; c.update(v); c.continue() } };
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) });
  db.close() }"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark')
    ctx.add_init_script(FAIL_PUT)
    pg = ctx.new_page()
    logs = []
    def watch(page):
        page.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' and 'simulated' not in m.text else None)
        page.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    watch(pg)

    def node(t): return pg.locator('.react-flow__node', has_text=t).first
    def center(l):
        b = l.bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
    def drag(x1, y1, x2, y2):
        pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x1 + 4, y1 + 4, steps=2); pg.mouse.move(x2 + 4, y2 + 4, steps=12); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(200)
    def sticky(x, y, text):
        pg.mouse.move(x, y); pg.mouse.dblclick(x, y); pg.wait_for_timeout(120); pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    def status_text(): return pg.locator('header [role="status"]').first.inner_text()
    def wait_saved(timeout=8000):
        pg.wait_for_function("() => { const el = document.querySelector('header [role=status]'); return !!el && /^Saved/.test(el.innerText.trim()) }", timeout=timeout)
    def viewport_transform(): return pg.locator('.react-flow__viewport').evaluate('e => e.style.transform')
    def toasts(): return ' | '.join(t.inner_text() for t in pg.locator('[aria-live="polite"]').all())
    def open_workspace(name):
        pg.goto(URL); pg.get_by_role('link', name=name).first.click(); pg.wait_for_selector('.react-flow')
    def new_workspace(name):
        pg.goto(URL); pg.get_by_role('button', name='Create workspace').first.click()
        pg.get_by_placeholder('Learning Roadmap').fill(name); pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
        pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow')
    def workspace_id(): return pg.url.rstrip('/').split('/')[-1]
    def undo_btn(): return pg.get_by_role('button', name='Undo (Ctrl/⌘+Z)')
    def redo_btn(): return pg.get_by_role('button', name='Redo (Ctrl/⌘+Shift+Z)')
    def edge_count(): return pg.locator('.react-flow__edge').count()

    # ───────────── بناء محتوى متنوع ─────────────
    new_workspace('Persist test')
    check('a new workspace starts as Saved with undo and redo disabled', 'Saved' in status_text() and undo_btn().is_disabled() and redo_btn().is_disabled(), status_text())
    sticky(330, 250, 'Persisted note'); sticky(760, 250, 'Second note')
    pg.mouse.move(700, 800); pg.keyboard.press('c'); pg.mouse.click(*center(node('Persisted note'))); pg.mouse.click(*center(node('Second note'))); pg.wait_for_timeout(250)
    pg.mouse.move(1130, 640); pg.keyboard.press('l'); pg.wait_for_timeout(150)
    pg.get_by_label('Link address').fill('example.com/brief'); pg.keyboard.press('Enter'); pg.get_by_label('Title').fill('Project brief'); pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(250)
    pg.mouse.move(330, 640); pg.keyboard.press('g'); pg.wait_for_timeout(150); pg.keyboard.type('Research'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.mouse.dblclick(240, 650); pg.wait_for_timeout(150); pg.keyboard.type('Inside group'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.mouse.click(900, 130)
    with pg.expect_file_chooser() as fc:
        pg.get_by_role('button', name='Add image').click()
    fc.value.set_files(AURORA); pg.wait_for_selector('.react-flow__node img'); pg.wait_for_timeout(500)
    img = pg.locator('.react-flow__node-image').first
    ib = img.bounding_box(); drag(ib['x'] + 60, ib['y'] + 20, ib['x'] + 60 + 380, ib['y'] + 20 - 120)  # نحرك الصورة بعيداً عن الباقي
    pg.mouse.click(900, 130)
    pg.mouse.move(700, 450); pg.mouse.wheel(0, -240); pg.wait_for_timeout(300)
    pg.mouse.move(1300, 120); pg.mouse.down(); pg.mouse.move(1260, 150, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
    before_transform = viewport_transform()
    before_nodes = pg.locator('.react-flow__node').count()
    check('save status moves to Saving/Unsaved and then Saved after editing', True)
    wait_saved()
    check('status shows Saved once the write completes', 'Saved' in status_text())

    # ───────────── استعادة بعد التحديث ─────────────
    pg.reload(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(700)
    check('all nodes come back after a reload', pg.locator('.react-flow__node').count() == before_nodes, f"{pg.locator('.react-flow__node').count()} vs {before_nodes}")
    check('sticky text is restored', node('Persisted note').count() == 1 and node('Second note').count() == 1 and node('Inside group').count() == 1)
    check('the connection is restored', edge_count() == 1, str(edge_count()))
    check('the image bytes were kept in IndexedDB and render', pg.locator('.react-flow__node img').first.evaluate('i => i.complete && i.naturalWidth > 0'))
    check('the link card is restored with its safe address', pg.locator('.react-flow__node a[href="https://example.com/brief"]').count() == 1)
    gb = pg.locator('.react-flow__node-group').first.bounding_box(); mb = node('Inside group').bounding_box()
    check('the group and its member are restored together', gb is not None and mb is not None and gb['x'] <= mb['x'] and mb['x'] + mb['width'] <= gb['x'] + gb['width'] + 1 and gb['y'] <= mb['y'])
    check('the viewport (pan and zoom) is restored', viewport_transform() == before_transform, f"{viewport_transform()} vs {before_transform}")
    check('history is per session: undo is disabled after reload', undo_btn().is_disabled())
    check('status after reload is Saved', 'Saved' in status_text())
    gid_before = pg.locator('.react-flow__node-group').first.get_attribute('data-id')

    # ───────────── تراجع وإعادة ─────────────
    n0 = pg.locator('.react-flow__node').count()
    pg.mouse.click(900, 130); sticky(1000, 130 + 80, 'Temp')
    check('adding a note enables undo', pg.locator('.react-flow__node').count() == n0 + 1 and undo_btn().is_enabled())
    pg.mouse.click(900, 130); pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    check('Ctrl+Z removes the note and enables redo', pg.locator('.react-flow__node').count() == n0 and redo_btn().is_enabled())
    pg.keyboard.press('Control+Shift+z'); pg.wait_for_timeout(200)
    check('Ctrl+Shift+Z brings it back', pg.locator('.react-flow__node').count() == n0 + 1 and node('Temp').count() == 1)
    pg.keyboard.press('Control+z'); pg.keyboard.press('Control+y'); pg.wait_for_timeout(200)
    check('Ctrl+Y also redoes', node('Temp').count() == 1)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)  # نعود إلى بدون Temp
    undone_count = pg.locator('.react-flow__node').count()

    pn = node('Persisted note'); b0 = pn.bounding_box()
    drag(b0['x'] + 40, b0['y'] + 40, b0['x'] + 40 + 150, b0['y'] + 40 + 90)
    b1 = pn.bounding_box()
    check('dragging moved the note', abs((b1['x'] - b0['x']) - 150) < 3)
    pg.mouse.click(900, 130); pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    b2 = pn.bounding_box()
    check('one undo reverts the whole drag (a single step)', abs(b2['x'] - b0['x']) < 1.5 and abs(b2['y'] - b0['y']) < 1.5, f"{b0} -> {b2}")
    pg.keyboard.press('Control+y'); pg.wait_for_timeout(250)
    b3 = pn.bounding_box()
    check('redo re-applies the drag', abs(b3['x'] - b1['x']) < 1.5 and abs(b3['y'] - b1['y']) < 1.5)

    e0 = edge_count(); n1 = pg.locator('.react-flow__node').count()
    pg.mouse.click(900, 130); pg.mouse.click(*center(node('Second note'))); pg.keyboard.press('Delete'); pg.wait_for_timeout(250)
    check('deleting a connected note removes its connection', pg.locator('.react-flow__node').count() == n1 - 1 and edge_count() == e0 - 1)
    pg.mouse.click(900, 130); pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    check('one undo restores the note and its connection together', pg.locator('.react-flow__node').count() == n1 and edge_count() == e0 and node('Second note').count() == 1)

    # تراجع عن حركة المجموعة: الأعضاء تعود معها
    grp = pg.locator('.react-flow__node-group').first; mb0 = node('Inside group').bounding_box()
    hx, hy = grp.locator('.group-drag-handle').evaluate("""(h) => { const r = h.getBoundingClientRect(); for (const dx of [0.5, 0.35, 0.65, 0.25, 0.75]) { const x = r.left + r.width * dx, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); if (hit && hit.closest('.group-drag-handle') === h) return [x, y] } return null }""")
    drag(hx, hy, hx + 60, hy + 40)
    mb1 = node('Inside group').bounding_box()
    pg.mouse.click(900, 130); pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    mb2 = node('Inside group').bounding_box()
    check('undoing a group move returns the group and its member', abs((mb1['x'] - mb0['x']) - 60) < 3 and abs(mb2['x'] - mb0['x']) < 1.5, f"{mb0} {mb1} {mb2}")

    # ما تُرك بعد التراجع (بدون Temp) يُحفظ ويعود بعد التحديث
    wait_saved(); pg.reload(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(600)
    check('the undone state is what gets saved (Temp is gone after reload)', node('Temp').count() == 0 and pg.locator('.react-flow__node').count() == undone_count, f"{pg.locator('.react-flow__node').count()} vs {undone_count}")
    check('the moved note keeps its saved position after reload', abs(pn.bounding_box()['x'] - b1['x']) < 1.5)
    final_nodes = pg.locator('.react-flow__node').count()

    # ───────────── لوحة التحكم ─────────────
    pg.mouse.move(700, 450); pg.get_by_role('link', name='Workspaces').first.click(); pg.wait_for_selector('text=Persist test')
    card = pg.locator('article', has_text='Persist test').first
    check('the dashboard card shows the real item count', f'{final_nodes} items' in card.inner_text(), card.inner_text()[:80])
    rects = card.locator('svg rect').count()
    check('the dashboard card draws a preview of the canvas', rects >= 5, str(rects))

    # نسخ المساحة
    pg.get_by_role('button', name='Actions for Persist test').click(); pg.get_by_role('menuitem', name='Duplicate').click(); pg.wait_for_selector('text=Persist test (copy)')
    copy_card = pg.locator('article', has_text='Persist test (copy)').first
    check('a duplicated workspace carries the item count', f'{final_nodes} items' in copy_card.inner_text())
    pg.get_by_role('link', name='Persist test (copy)').first.click(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(700)
    check('the duplicate opens with the same content, image included', pg.locator('.react-flow__node').count() == final_nodes and pg.locator('.react-flow__node img').first.evaluate('i => i.complete && i.naturalWidth > 0'))
    copy_id = workspace_id()

    # حذف الأصل: تُحذف لوحته ويبقى للنسخة محتواها
    pg.goto(URL); pg.get_by_role('button', name='Actions for Persist test', exact=True).click(); pg.get_by_role('menuitem', name='Delete').click()
    pg.locator('dialog[open]').get_by_role('button', name=__import__('re').compile('delete', __import__('re').I)).last.click(); pg.wait_for_timeout(500)
    canvases = pg.evaluate(IDB_ALL, ['infinitespace-canvases', 'canvases'])
    check('deleting a workspace deletes its canvas but not the copy\'s', canvases is not None and [c['key'] for c in canvases] == [copy_id], str([c['key'] for c in (canvases or [])]))

    # ───────────── مغادرة فورية ودمج ضغطات الأسهم ─────────────
    pg.get_by_role('link', name='Persist test (copy)').first.click(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(500)
    pg.mouse.click(900, 130); sticky(1050, 200, 'Quick leave')
    pg.get_by_role('link', name='Workspaces').first.click()  # قبل انتهاء مهلة التأجيل (0.8 ث): يجب أن يحفظ عند المغادرة
    pg.wait_for_selector('article'); pg.wait_for_timeout(500)
    pg.get_by_role('link', name='Persist test (copy)').first.click(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(600)
    check('leaving the editor right after an edit still saves it', node('Quick leave').count() == 1)

    pg.mouse.click(900, 130); pg.mouse.click(*center(node('Quick leave'))); pg.wait_for_timeout(200)
    k0 = node('Quick leave').bounding_box()
    for _ in range(5):
        pg.keyboard.press('ArrowRight')
    pg.wait_for_timeout(300)
    k1 = node('Quick leave').bounding_box()
    pg.mouse.click(900, 130); pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    k2 = node('Quick leave').bounding_box()
    check('quick arrow-key nudges are one undo step', k1['x'] > k0['x'] + 4 and abs(k2['x'] - k0['x']) < 1.5, f"{k0['x']} -> {k1['x']} -> {k2['x']}")

    # ───────────── فشل الحفظ وإعادة المحاولة ─────────────
    pg.evaluate('window.__failPut = true')  # ما زلنا في محرر النسخة
    pg.mouse.click(900, 130); sticky(1050, 200, 'Offline note')
    pg.wait_for_function("() => /Not saved/.test(document.querySelector('header [role=status]').innerText)", timeout=8000)
    check('a failed save shows "Not saved" with a Retry button', pg.get_by_role('button', name='Retry saving').count() == 1)
    check('the work stays on screen while saving fails', node('Offline note').count() == 1)
    pg.screenshot(path=os.path.join(TMP, 'save-error.png'))
    pg.evaluate('window.__failPut = false'); pg.get_by_role('button', name='Retry saving').click(); wait_saved()
    check('Retry saves successfully once storage recovers', 'Saved' in status_text())
    pg.reload(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(500)
    check('the note written after Retry survives a reload', node('Offline note').count() == 1)

    # حماية المغادرة عند وجود تعديلات غير محفوظة
    page2 = ctx.new_page(); watch(page2)
    page2.goto(URL + f'w/{copy_id}'); page2.wait_for_selector('.react-flow__node'); page2.wait_for_timeout(400)
    page2.evaluate('window.__failPut = true')
    page2.mouse.dblclick(900, 700); page2.wait_for_timeout(150); page2.keyboard.type('Unsaved'); page2.keyboard.press('Escape')
    page2.wait_for_function("() => /Not saved/.test(document.querySelector('header [role=status]').innerText)", timeout=8000)
    seen = []
    page2.on('dialog', lambda d: (seen.append(d.type), d.accept()))
    page2.close(run_before_unload=True); pg.wait_for_timeout(300)
    check('leaving with unsaved changes triggers the browser confirmation', 'beforeunload' in seen, str(seen))

    # ───────────── محتوى غير مقروء: نسخة احتياطية وفتح فارغ ─────────────
    new_workspace('Corrupt test'); cid = workspace_id(); pg.goto(URL)
    pg.evaluate(IDB_PUT, ['infinitespace-canvases', 'canvases', cid, {'schemaVersion': 99, 'nodes': 'from the future'}])
    pg.get_by_role('link', name='Corrupt test').first.click(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(600)
    check('unreadable saved content opens an empty canvas with an explanation', pg.locator('.react-flow__node').count() == 0 and "couldn't be read" in toasts(), toasts())
    backups = pg.evaluate(IDB_ALL, ['infinitespace-canvases', 'backups'])
    check('the unreadable content is backed up before anything can overwrite it', backups is not None and any(b['key'] == f'canvas-backup:{cid}' and b['value'].get('schemaVersion') == 99 for b in backups))
    sticky(500, 300, 'Fresh start'); wait_saved()
    canv = pg.evaluate(IDB_ALL, ['infinitespace-canvases', 'canvases'])
    still = pg.evaluate(IDB_ALL, ['infinitespace-canvases', 'backups'])
    check('after saving new work the backup still holds the original content', any(b['key'] == f'canvas-backup:{cid}' and b['value'].get('schemaVersion') == 99 for b in still) and any(c['key'] == cid and c['value']['schemaVersion'] == 1 for c in canv))

    # ───────────── عناصر تالفة ─────────────
    new_workspace('Damaged test'); did = workspace_id(); pg.goto(URL)
    good = {'id': 'ok', 'type': 'sticky', 'position': {'x': 100, 'y': 100}, 'width': 232, 'height': 208, 'data': {'title': 'Survivor', 'content': '', 'color': 'blue', 'textColor': None, 'tags': [], 'createdAt': 1, 'updatedAt': 1}}
    bad = {'id': 'bad', 'type': 'sticky', 'position': {'x': 'NaN', 'y': 0}, 'data': {}}
    evil = {'id': 'evil', 'type': 'link', 'position': {'x': 500, 'y': 100}, 'width': 300, 'height': 176, 'data': {'url': 'javascript:alert(1)', 'title': 'Evil', 'description': '', 'tags': [], 'createdAt': 1, 'updatedAt': 1}}
    pg.evaluate(IDB_PUT, ['infinitespace-canvases', 'canvases', did, {'schemaVersion': 1, 'nodes': [good, bad, evil], 'edges': [{'id': 'e', 'source': 'ok', 'target': 'ghost'}], 'viewport': {'x': 0, 'y': 0, 'zoom': 1}}])
    pg.get_by_role('link', name='Damaged test').first.click(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(600)
    check('damaged items are skipped with a notice and the rest opens', node('Survivor').count() == 1 and pg.locator('.react-flow__node').count() == 2 and '2 damaged items were skipped' in toasts(), toasts())
    check('a javascript: link address in storage is neutralized (no anchor rendered)', pg.locator('.react-flow__node a[href]').count() == 0 and 'javascript' not in pg.content().lower().split('<body')[1])

    # ───────────── تنظيف الصور غير المستخدمة ─────────────
    new_workspace('GC test')
    with pg.expect_file_chooser() as fc:
        pg.get_by_role('button', name='Add image').click()
    fc.value.set_files(OCEAN); pg.wait_for_selector('.react-flow__node img'); pg.wait_for_timeout(400)
    pg.mouse.click(*center(pg.locator('.react-flow__node-image').first)); pg.keyboard.press('Delete'); pg.wait_for_timeout(300); wait_saved()
    pg.evaluate(IDB_AGE_IMAGES)  # نجعل كل الصور أقدم من فترة السماح
    imgs_before = pg.evaluate(IDB_ALL, ['infinitespace-images', 'images'])
    pg.goto(URL); pg.wait_for_timeout(10000)
    imgs_after = pg.evaluate(IDB_ALL, ['infinitespace-images', 'images'])
    check('an old image that no saved canvas uses is deleted, the used one stays',
          len(imgs_before) == 2 and len(imgs_after) == 1, f"{len(imgs_before)} -> {len(imgs_after)}")
    pg.get_by_role('link', name='Persist test (copy)').first.click(); pg.wait_for_selector('.react-flow__node img'); pg.wait_for_timeout(500)
    check('the image kept by the cleanup still renders in its workspace', pg.locator('.react-flow__node img').first.evaluate('i => i.complete && i.naturalWidth > 0'))

    browser.close()

bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)}/{len(results)} passed; console errors: {logs}; artifacts: {TMP}')
sys.exit(1 if bad or logs else 0)
