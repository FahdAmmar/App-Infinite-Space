"""
فحوصات المتصفح لمرحلة سلامة البيانات (المرحلة 7) على نسخة الإنتاج.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    pip install playwright && playwright install chromium
    python3 e2e/phase7_data_safety.py       # أو BASE_URL=http://127.0.0.1:5173/ للتطوير

يغطي: التصدير (ملف صالح)، الاستيراد (مساحة جديدة)، مركز البيانات (التخزين والنسخ)، استرجاع نسخة لوحة غير مقروءة،
شاشة الخطأ عند فشل تحميل المحرر، ولافتة تعارض التبويبات (إيقاف الحفظ ثم الإبقاء على النسخة).
يطبع PASS/FAIL ويخرج برمز 1 عند أي فشل أو خطأ في الـ console.
ملاحظة: شُغّل فعلياً في Chromium (Playwright 1.56)؛ صُحّح محدد قسم الاسترجاع ليستخدم دور العنوان لأن النص الجزئي يطابق أكثر من عنصر.
"""
import json, os, sys, tempfile
from playwright.sync_api import sync_playwright
from _common import patch_browser

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
TMP = tempfile.mkdtemp(prefix='infinitespace-e2e7-')
WS_ID = 'e2e7-workspace'
WS_NAME = 'E2E Plan'
results = []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))

# مساحة واحدة جاهزة تُزرع في localStorage عند أول تحميل فقط (لا نكتب فوق ما يغيّره الاختبار لاحقاً)
SEED = """
(() => {
  const key = 'infinitespace:v1:workspaces';
  if (localStorage.getItem(key)) return;
  const now = Date.now();
  localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, workspaces: [{
    id: '%s', name: '%s', description: 'e2e', color: 'rose', icon: 'compass',
    createdAt: now, updatedAt: now, lastOpenedAt: null, nodeCount: 0, preview: [] }] }));
})();
""" % (WS_ID, WS_NAME)

IDB_PUT = """async ([dbName, storeName, key, value]) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open(dbName); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
  await new Promise((res, rej) => { const tx = db.transaction(storeName, 'readwrite'); tx.objectStore(storeName).put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) });
  db.close() }"""

BROADCAST_SAVED = """(id) => { const c = new BroadcastChannel('infinitespace:v1:canvas-sync'); c.postMessage({ type: 'saved', workspaceId: id, tabId: 'other-tab' }); setTimeout(() => c.close(), 200) }"""

def open_data_dialog(page):
    page.get_by_role('button', name='Data & backup').click()
    page.get_by_role('dialog').wait_for()

def card_names(page):
    return page.locator('[data-workspace-id] h3').all_inner_texts()

with sync_playwright() as p:
    browser = patch_browser(p.chromium.launch())
    ctx = browser.new_context(accept_downloads=True)
    ctx.add_init_script(SEED)
    errors = []
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    # فتح المحرر مرة واحدة ينشئ قواعد IndexedDB (المخازن تُبنى عند أول استخدام)
    page.goto(URL)
    page.locator(f"[data-workspace-id='{WS_ID}'] a").click()
    page.get_by_text('Saved', exact=True).first.wait_for()
    page.go_back()
    page.locator(f"[data-workspace-id='{WS_ID}']").wait_for()

    # ───── مركز البيانات ─────
    open_data_dialog(page)
    dialog = page.get_by_role('dialog')
    check('data dialog shows the storage section', dialog.get_by_text('Browser storage').count() == 1)
    check('data dialog shows the recovery section', dialog.get_by_role('heading', name='Recovery copies').count() == 1)
    # قراءة النسخ غير متزامنة (تظهر «Looking for recovery copies…» أولاً)، فننتظر النتيجة بدل العد الفوري
    empty_note = dialog.get_by_text('No recovery copies')
    try: empty_note.first.wait_for(timeout=5000)
    except Exception: pass
    check('recovery list starts empty', empty_note.count() == 1)
    page.keyboard.press('Escape')

    # ───── التصدير ─────
    page.get_by_role('button', name=f'Actions for {WS_NAME}').click()
    with page.expect_download() as download_info:
        page.get_by_role('menuitem', name='Export').click()
    download = download_info.value
    exported_path = os.path.join(TMP, download.suggested_filename)
    download.save_as(exported_path)
    body = json.load(open(exported_path, encoding='utf-8'))
    check('export file has the expected name', download.suggested_filename.endswith('.infinitespace.json'), download.suggested_filename)
    check('export file declares its format and workspace', body.get('format') == 'infinitespace-workspace' and body['workspace']['name'] == WS_NAME)

    # ───── الاستيراد ─────
    open_data_dialog(page)
    page.set_input_files('[data-testid=import-file-input]', exported_path)
    page.get_by_text('Imported', exact=False).first.wait_for()
    page.keyboard.press('Escape')
    names = card_names(page)
    check('import adds a new workspace without touching the original', len(names) == 2 and WS_NAME in names, str(names))
    check('import renames a clashing workspace', any('(copy)' in n for n in names), str(names))

    # ───── ملف غير صالح ─────
    bad_path = os.path.join(TMP, 'not-a-workspace.json')
    open(bad_path, 'w').write('{"hello": "world"}')
    open_data_dialog(page)
    page.set_input_files('[data-testid=import-file-input]', bad_path)
    page.get_by_text("isn't an InfiniteSpace workspace file", exact=False).first.wait_for()
    check('importing a foreign JSON file is rejected with a clear message', True)
    page.keyboard.press('Escape')
    check('a rejected import adds nothing', len(card_names(page)) == 2)

    # ───── استرجاع نسخة لوحة غير مقروءة ─────
    page.evaluate(IDB_PUT, ['infinitespace-canvases', 'canvases', WS_ID,
                            {'schemaVersion': 99, 'nodes': [{'id': 'n1', 'type': 'sticky', 'position': {'x': 0, 'y': 0},
                             'data': {'title': 'kept', 'content': 'from a newer version', 'color': 'yellow', 'tags': []}}]}])
    page.locator(f"[data-workspace-id='{WS_ID}'] a").click()
    page.get_by_text("couldn't be read", exact=False).first.wait_for()
    page.go_back()
    open_data_dialog(page)
    unreadable = page.get_by_role('dialog').get_by_text('Unreadable canvas of', exact=False)
    try: unreadable.first.wait_for(timeout=5000)
    except Exception: pass
    check('an unreadable canvas appears under recovery copies', unreadable.count() == 1)
    page.get_by_role('button', name='Restore as new workspace').click()
    page.get_by_text('Restored as', exact=False).first.wait_for()
    page.keyboard.press('Escape')
    check('restoring a recovery copy creates a "Recovered workspace"', 'Recovered workspace' in card_names(page), str(card_names(page)))

    # ───── لافتة تعارض التبويبات ─────
    editor = ctx.new_page()
    editor.goto(URL.rstrip('/') + f'/w/{WS_ID}')
    editor.get_by_text('Saved', exact=True).first.wait_for()
    other = ctx.new_page()
    other.goto(URL)
    other.evaluate(BROADCAST_SAVED, WS_ID)
    editor.get_by_text('This workspace was changed in another tab.').wait_for()
    check('another tab saving shows the conflict banner', True)
    # موضع اللافتة: تحت شريط الأعلى لا فوقه، وداخل الشاشة، على سطح المكتب والهاتف معاً
    for label, size in (('desktop', {'width': 1440, 'height': 900}), ('phone', {'width': 390, 'height': 844})):
        editor.set_viewport_size(size); editor.wait_for_timeout(300)
        banner = editor.get_by_role('alert').filter(has_text='changed in another tab').bounding_box()
        # العنصر <header> نفسه يشمل حشوة شفافة؛ المهم ألا تغطي اللافتة الأزرار المرئية فيه
        topbar_bottom = editor.evaluate("() => Math.max(...[...document.querySelectorAll('header:not(aside header) a, header:not(aside header) button')].map((e) => e.getBoundingClientRect().bottom))")
        inside = banner is not None and banner['x'] >= 0 and banner['x'] + banner['width'] <= size['width'] and banner['y'] + banner['height'] <= size['height']
        check(f'the conflict banner sits inside the {label} screen', inside, str(banner))
        check(f'the conflict banner does not overlap the {label} top bar', banner is not None and banner['y'] >= topbar_bottom, f'{banner} vs top bar bottom {topbar_bottom}')
        editor.screenshot(path=os.path.join(TMP, f'conflict-banner-{label}.png'))
    editor.set_viewport_size({'width': 1440, 'height': 900})
    check('saving is shown as paused', editor.get_by_text('Saving paused').count() >= 1)
    editor.get_by_role('button', name='Keep this version').click()
    editor.get_by_text('This workspace was changed in another tab.').wait_for(state='detached')
    check('keeping this version dismisses the banner', True)
    editor.close(); other.close()

    # ───── فشل تحميل المحرر ─────
    broken = ctx.new_page()
    broken.route('**/assets/WorkspaceEditorPage-*.js', lambda route: route.abort())
    broken.goto(URL)
    broken.locator(f"[data-workspace-id='{WS_ID}'] a").click()
    broken.get_by_text("This page couldn't load").wait_for()
    check('a failed editor download shows the error screen, not a blank page', broken.get_by_role('link', name='Back to workspaces').count() == 1)
    broken.close()

    browser.close()

relevant_errors = [e for e in errors if 'Failed to load resource' not in e and 'dynamically imported' not in e and 'Route error' not in e]
check('no unexpected console or page errors', not relevant_errors, '; '.join(relevant_errors[:3]))
failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
sys.exit(1 if failed else 0)
