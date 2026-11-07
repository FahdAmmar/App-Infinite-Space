"""
فحوصات المتصفح للنسخ الاحتياطي (المرحلة 17): التذكير، المجلد (محاكى بنظام ملفات المتصفح الخاص OPFS لأن منتقي المجلدات الحقيقي
لا يُؤتمت)، التنزيل البديل، و(استمرار المقبض بعد إعادة التحميل غير مفحوص هنا: انظر الملاحظة داخل السكربت).

التشغيل:  npm run build && npx vite preview --port 4173 &   ثم   python3 e2e/phase17_backup.py
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


FAKE_PICKER = """
Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});
window.showDirectoryPicker = async () => {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('Backups', { create: true });
};
"""
NO_PICKER = "Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8}); delete window.showDirectoryPicker;"
LIST_OPFS = """async () => {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('Backups', { create: true });
  const out = {};
  for await (const [name, handle] of dir.entries()) out[name] = await (await handle.getFile()).text();
  return out;
}"""


def make_workspace(pg, template):
    pg.goto(URL); pg.wait_for_selector('h1')
    if pg.get_by_role('button', name=template, exact=True).count():
        pg.get_by_role('button', name=template, exact=True).click()
    else:
        pg.get_by_role('button', name='Create workspace').first.click()
        pg.get_by_placeholder('Learning Roadmap').fill(template); pg.keyboard.press('Enter')
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(700)


def open_data(pg):
    pg.goto(URL); pg.wait_for_selector('h1')
    pg.get_by_role('button', name='Data & backup').click(); pg.wait_for_timeout(300)


with sync_playwright() as p:
    browser = p.chromium.launch()
    errors = []

    # ---------- تذكير ----------
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script(FAKE_PICKER)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    make_workspace(pg, 'SWOT')
    pg.goto(URL); pg.wait_for_selector('h1')
    check('no reminder for a brand-new workspace', pg.get_by_role('region', name='Backup reminder').count() == 0)
    eight_days = int((time.time() - 8 * 86400) * 1000)
    pg.evaluate("t => localStorage.setItem('infinitespace:v1:backup', JSON.stringify({lastBackupAt: t, snoozedUntil: 0, folderName: null, autoBackup: false}))", eight_days)
    pg.reload(); pg.wait_for_selector('h1')
    check('reminder appears after 8 days without a backup', pg.get_by_role('region', name='Backup reminder').count() == 1)
    check('reminder states the age', pg.get_by_role('region', name='Backup reminder').get_by_text('8 days ago').count() == 1)
    pg.get_by_role('button', name='Remind me later').click(); pg.wait_for_timeout(200)
    check('"Remind me later" hides it', pg.get_by_role('region', name='Backup reminder').count() == 0)
    pg.reload(); pg.wait_for_selector('h1')
    check('the snooze survives a reload', pg.get_by_role('region', name='Backup reminder').count() == 0)

    # الزر يفتح خيارات النسخ
    pg.evaluate("t => localStorage.setItem('infinitespace:v1:backup', JSON.stringify({lastBackupAt: t, snoozedUntil: 0, folderName: null, autoBackup: false}))", eight_days)
    pg.reload(); pg.wait_for_selector('h1')
    pg.get_by_role('region', name='Backup reminder').get_by_role('button', name='Back up', exact=True).click(); pg.wait_for_timeout(300)
    check('the reminder button opens the backup section', pg.get_by_role('heading', name='Backup', exact=True).is_visible())
    ctx.close()

    # ---------- مجلد النسخ ----------
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script(FAKE_PICKER)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    make_workspace(pg, 'SWOT'); make_workspace(pg, 'Kanban')
    open_data(pg)
    check('shows "never" before the first backup', pg.get_by_text('Last backup:').locator('..').get_by_text('never').count() >= 1)
    pg.get_by_role('button', name='Choose backup folder…').click(); pg.wait_for_timeout(1500)
    files = pg.evaluate(LIST_OPFS)
    check('one file per workspace was written', len(files) == 2, f'files={list(files)}')
    check('file names are stable and importable', all(n.endswith('.infinitespace.json') for n in files), str(list(files)))
    parsed = [json.loads(t) for t in files.values()] if files else []
    check('each file is a full export that parses', len(parsed) == 2 and all('nodes' in d or 'workspace' in d for d in parsed), str([list(d)[:4] for d in parsed][:1]))
    check('connecting enables automatic backup and shows the folder', pg.get_by_text('Backups', exact=True).count() >= 1 and pg.get_by_label('Back up automatically while the app is open').is_checked())
    check('"last backup" now says today', pg.get_by_text('today', exact=True).count() >= 1)

    pg.get_by_role('button', name='Back up now').click(); pg.wait_for_timeout(1200)
    files2 = pg.evaluate(LIST_OPFS)
    check('backing up again overwrites instead of piling up files', len(files2) == 2, f'files={len(files2)}')

    # ملاحظة: لا نعيد التحميل هنا. قراءة مقبض OPFS من IndexedDB تُسقط chrome-headless-shell في هذه البيئة (put يعمل وget يسقط المتصفح)،
    # فاستمرار المقبض بعد إعادة التحميل غير مفحوص آلياً؛ يغطيه اختبار الوحدة لطبقة التخزين، ويلزم فحص يدوي في Chrome حقيقي.
    check('the folder and its controls are shown', pg.get_by_role('button', name='Back up now').count() == 1)

    pg.get_by_role('button', name='Disconnect').click(); pg.wait_for_timeout(500)
    check('disconnecting returns to the folder picker and keeps the files', pg.get_by_role('button', name='Choose backup folder…').count() == 1 and len(pg.evaluate(LIST_OPFS)) == 2)
    ctx.close()

    # ---------- متصفح بلا منتقي مجلدات: تنزيل ----------
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script(NO_PICKER)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    make_workspace(pg, 'SWOT'); make_workspace(pg, 'Kanban')
    open_data(pg)
    check('no folder picker offered when unsupported', pg.get_by_role('button', name='Choose backup folder…').count() == 0)
    downloads = []
    pg.on('download', lambda d: downloads.append(d.suggested_filename))
    pg.get_by_role('button', name='Download all workspaces').click(); pg.wait_for_timeout(2500)
    check('downloads one file per workspace', len(downloads) == 2 and all(n.endswith('.infinitespace.json') for n in downloads), str(downloads))
    check('records the backup after downloading', pg.get_by_text('today', exact=True).count() >= 1)
    ctx.close()

    check('no uncaught page errors', not errors, '; '.join(errors)[:200])
    browser.close()

failed = [n for n, ok, _ in results if not ok]
print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
sys.exit(1 if failed else 0)
