"""
فحوصات المتصفح لمرحلة إنتاجية اللوحة (المرحلة 8) على نسخة الإنتاج.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    pip install playwright && playwright install chromium
    python3 e2e/phase8_productivity.py      # أو BASE_URL=http://127.0.0.1:5173/ للتطوير

يغطي: إعادة ربط وصلة بالسحب (خطوة تراجع واحدة، ورفض الوصل الذاتي)، النسخ والقص واللصق (مع الوصلات بين
المنسوخ، وبين مساحتين)، المحاذاة والتوزيع، التثبيت على الشبكة، الطبقات، البحث على اللوحة، وشريط الأدوات
على شاشة هاتف. يطبع PASS/FAIL ويخرج برمز 1 عند أي فشل أو خطأ في الـ console.
"""
import os, re, sys, tempfile
from playwright.sync_api import sync_playwright
from _common import patch_browser, open_add_menu

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
SHOTS = os.path.join(tempfile.mkdtemp(prefix='infinitespace-e2e8-'), 'shots')
os.makedirs(SHOTS)
results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


with sync_playwright() as p:
    browser = patch_browser(p.chromium.launch())
    # كتابة الحافظة تحتاج صلاحية في Chromium الرأسي؛ في المتصفح العادي تُمنح تلقائياً بعد ضغطة مفتاح
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark', permissions=['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page()
    logs = []
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))

    def node(text): return pg.locator('.react-flow__node', has_text=text).first
    def center(loc):
        bb = loc.bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    def handle_center(loc, side):
        bb = loc.locator(f'.react-flow__handle[data-handleid="{side}"]').bounding_box()
        return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    def n_nodes(): return pg.locator('.react-flow__node').count()
    def n_edges(): return pg.locator('.react-flow__edge').count()
    def n_selected(): return pg.locator('.react-flow__node.selected').count()
    def toasts(): return ' | '.join(t.inner_text() for t in pg.locator('[aria-live="polite"], [role="status"], [role="alert"]').all())
    def new_sticky(x, y, text):
        pg.mouse.move(x, y); pg.mouse.dblclick(x, y)
        pg.wait_for_timeout(120); pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(120)
    def drag(x1, y1, x2, y2, steps=14):
        # أول حركة صغيرة تتجاوز عتبة سحب البطاقة (3 بكسل) ثم نكمل؛ المؤشر ينتهي عند الهدف نفسه
        pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x1 + 4, y1 + 4, steps=2)
        pg.mouse.move(x2, y2, steps=steps); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(250)
    def reset():
        # تحديد الكل ثم حذف: يترك لوحة فارغة بين المجموعات
        pg.keyboard.press('Escape'); pg.keyboard.press('Control+a'); pg.keyboard.press('Delete'); pg.wait_for_timeout(250)
    def pos(loc):
        m = re.search(r'translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)', loc.get_attribute('style') or '')
        return (float(m.group(1)), float(m.group(2))) if m else (None, None)
    def top_text_at(x, y):
        return pg.evaluate("([x, y]) => document.elementFromPoint(x, y)?.closest('.react-flow__node')?.innerText ?? ''", [x, y])
    def create_workspace(name):
        pg.get_by_role('button', name='Create workspace').first.click()
        pg.get_by_placeholder('Learning Roadmap').fill(name)
        pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
        pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(500)

    pg.goto(URL)
    create_workspace('Phase 8 flow')
    new_sticky(330, 300, 'Alpha'); new_sticky(780, 230, 'Beta'); new_sticky(780, 560, 'Gamma')
    a, b, g = node('Alpha'), node('Beta'), node('Gamma')
    aid, bid, gid = a.get_attribute('data-id'), b.get_attribute('data-id'), g.get_attribute('data-id')
    pg.keyboard.press('c'); pg.mouse.click(*center(a)); pg.mouse.click(*center(b)); pg.wait_for_timeout(300)
    check('setup: three notes and one connection', n_nodes() == 3 and n_edges() == 1, f'{n_nodes()} nodes, {n_edges()} edges')
    edge = pg.locator('.react-flow__edge').first

    # ───── إعادة ربط الوصلة ─────
    ux, uy = center(edge.locator('.react-flow__edgeupdater-target'))
    g.hover(); pg.wait_for_timeout(200); gx, gy = handle_center(g, 'left')
    drag(ux, uy, gx, gy)
    label = edge.get_attribute('aria-label') or ''
    check('dragging the target end moves the connection to another card', label.endswith(gid) and n_edges() == 1, label[-40:])
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    check('reattaching is one undo step', (edge.get_attribute('aria-label') or '').endswith(bid))
    sx, sy = center(edge.locator('.react-flow__edgeupdater-source'))
    b.hover(); pg.wait_for_timeout(200); bx, by = handle_center(b, 'right')
    drag(sx, sy, bx, by)
    check('moving the source end onto the target card is refused', 'cannot be connected to itself' in toasts(), toasts())
    check('a refused reattach leaves the connection unchanged', (edge.get_attribute('aria-label') or '').endswith(bid) and f'from {aid}' in (edge.get_attribute('aria-label') or ''))

    # ───── نسخ ولصق وقص ─────
    pg.mouse.click(*center(a)); pg.keyboard.down('Shift'); pg.mouse.click(*center(b)); pg.keyboard.up('Shift')
    check('shift-click selects two cards', n_selected() == 2, str(n_selected()))
    before_ids = set(pg.locator('.react-flow__node').evaluate_all('els => els.map(e => e.dataset.id)'))
    pg.keyboard.press('Control+c'); pg.wait_for_timeout(250); pg.mouse.move(420, 690); pg.keyboard.press('Control+v'); pg.wait_for_timeout(300)
    check('paste adds copies and keeps the connection between them', n_nodes() == 5 and n_edges() == 2, f'{n_nodes()} nodes, {n_edges()} edges')
    check('the pasted copies are the selection', n_selected() == 2)
    new_ids = set(pg.locator('.react-flow__node').evaluate_all('els => els.map(e => e.dataset.id)')) - before_ids
    labels = [e.get_attribute('aria-label') or '' for e in pg.locator('.react-flow__edge').all()]
    check('the new connection joins the copies, not the originals', any(all(i in l for i in new_ids) for l in labels) and len(new_ids) == 2)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    check('undo removes the whole paste in one step', n_nodes() == 3 and n_edges() == 1, f'{n_nodes()} nodes, {n_edges()} edges')
    pg.keyboard.press('Control+Shift+z'); pg.wait_for_timeout(250)
    check('redo restores the paste', n_nodes() == 5 and n_edges() == 2)
    pg.mouse.click(*center(g)); pg.keyboard.press('Control+x'); pg.wait_for_timeout(350)
    check('cut removes the card', n_nodes() == 4 and pg.locator('.react-flow__node', has_text='Gamma').count() == 0, str(n_nodes()))
    pg.mouse.move(1000, 600); pg.keyboard.press('Control+v'); pg.wait_for_timeout(300)
    check('pasting after a cut brings the card back', n_nodes() == 5 and pg.locator('.react-flow__node', has_text='Gamma').count() == 1)

    # ───── الطبقات ─────
    reset()
    check('select all then delete empties the canvas', n_nodes() == 0 and n_edges() == 0)
    new_sticky(420, 300, 'Under'); new_sticky(900, 300, 'Over')
    over = node('Over'); drag(*center(over), 520, 340)
    ub, ob = node('Under').bounding_box(), node('Over').bounding_box()
    overlap = (ob['x'] + 30, ob['y'] + 30)
    check('the two notes overlap', ub['x'] < overlap[0] < ub['x'] + ub['width'] and ub['y'] < overlap[1] < ub['y'] + ub['height'])
    check('the later note is on top at first', 'Over' in top_text_at(*overlap), top_text_at(*overlap))
    # العقدة المحددة تُرفع فوق غيرها أثناء التحديد (elevateNodesOnSelect)، فنلغي التحديد قبل قراءة الترتيب الحقيقي
    def deselect(): pg.mouse.click(1000, 760); pg.wait_for_timeout(200)
    pg.mouse.click(ub['x'] + 8, ub['y'] + ub['height'] - 12); pg.keyboard.press(']')  # الزاوية السفلية: شريط التحديد العائم فوق الملاحظة الأخرى ويغطي الزاوية العلوية; pg.wait_for_timeout(250); deselect()
    check('] brings the selected note to the front', 'Under' in top_text_at(*overlap), top_text_at(*overlap))
    pg.mouse.click(ub['x'] + 8, ub['y'] + 8); pg.keyboard.press('['); pg.wait_for_timeout(250); deselect()
    check('[ sends it back again', 'Over' in top_text_at(*overlap), top_text_at(*overlap))

    # ───── محاذاة وتوزيع ─────
    reset()
    new_sticky(250, 260, 'R1'); new_sticky(520, 520, 'R2'); new_sticky(1100, 330, 'R3')
    pg.keyboard.press('Control+a'); pg.wait_for_timeout(250)
    def boxes(): return sorted((node(t).bounding_box() for t in ('R1', 'R2', 'R3')), key=lambda r: r['x'])
    pg.get_by_role('button', name='Align left edges').click(); pg.wait_for_timeout(250)
    xs = [r['x'] for r in boxes()]
    check('align left puts all left edges on one line', max(xs) - min(xs) < 1.5, str(xs))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    xs = [r['x'] for r in boxes()]
    check('align is one undo step', max(xs) - min(xs) > 20, str(xs))
    pg.keyboard.press('Control+a'); pg.wait_for_timeout(250)
    pg.get_by_role('button', name='Align vertical centers').click(); pg.wait_for_timeout(250)
    ys = [r['y'] + r['height'] / 2 for r in boxes()]
    check('align vertical centers puts centers on one line', max(ys) - min(ys) < 1.5, str(ys))
    bs = boxes(); gaps_before = [bs[1]['x'] - (bs[0]['x'] + bs[0]['width']), bs[2]['x'] - (bs[1]['x'] + bs[1]['width'])]
    pg.get_by_role('button', name='Distribute horizontally (3 or more items)').click(); pg.wait_for_timeout(250)
    bs = boxes(); gaps = [bs[1]['x'] - (bs[0]['x'] + bs[0]['width']), bs[2]['x'] - (bs[1]['x'] + bs[1]['width'])]
    check('distribute makes the gaps equal', abs(gaps[0] - gaps[1]) < 1.5 and abs(gaps_before[0] - gaps_before[1]) > 20, f'{gaps_before} -> {gaps}')

    # ───── التثبيت على الشبكة ─────
    reset(); new_sticky(300, 300, 'Snap')
    snap = node('Snap')
    pg.get_by_role('button', name='Turn on snap to grid').click(); pg.wait_for_timeout(150)
    cx, cy = center(snap); drag(cx, cy, cx + 37, cy + 23)
    x, y = pos(snap)
    check('with snap on, a drag lands on the 20 px grid', x is not None and x % 20 == 0 and y % 20 == 0, f'{x}, {y}')
    pg.get_by_role('button', name='Turn off snap to grid').click(); pg.wait_for_timeout(150)
    cx, cy = center(snap); drag(cx, cy, cx + 13, cy + 7)
    x, y = pos(snap)
    check('with snap off, positions are free again', not (x % 20 == 0 and y % 20 == 0), f'{x}, {y}')

    # ───── البحث على اللوحة ─────
    reset()
    new_sticky(300, 300, 'Apple pie'); new_sticky(700, 300, 'Banana bread'); new_sticky(1100, 300, 'Banana split'); new_sticky(1250, 620, 'Faraway')
    pg.keyboard.press('Control+f'); pg.wait_for_timeout(200)
    bar = pg.get_by_role('search')
    check('Ctrl+F opens the find bar', bar.count() == 1)
    pg.get_by_role('searchbox', name='Find on canvas').fill('banana'); pg.wait_for_timeout(300)
    check('find counts both matches', '1 of 2' in bar.inner_text(), bar.inner_text())
    check('the first match is selected', n_selected() == 1 and 'Banana bread' in pg.locator('.react-flow__node.selected').first.inner_text())
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    check('Enter steps to the next match', '2 of 2' in bar.inner_text() and 'Banana split' in pg.locator('.react-flow__node.selected').first.inner_text())
    pg.get_by_role('searchbox', name='Find on canvas').fill('zzz-nothing'); pg.wait_for_timeout(250)
    check('find reports when nothing matches', 'No matches' in bar.inner_text())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check('Esc closes the find bar', pg.get_by_role('search').count() == 0)
    # البحث السابق حرّك العرض إلى آخر مطابقة، فنسحب اللوحة حتى تخرج الملاحظة من الشاشة (بحد أقصى 8 سحبات)
    pg.mouse.click(1000, 130); pg.wait_for_timeout(200)  # لوحة الخصائص تغطي يمين الشاشة عند وجود تحديد
    for _ in range(8):
        pg.mouse.move(1000, 130); pg.mouse.down(); pg.mouse.move(100, 130, steps=12); pg.mouse.up(); pg.wait_for_timeout(250)
        # خارج الشاشة تُزال البطاقة من DOM (onlyRenderVisibleElements)، فغيابها يعني أنها خرجت
        if pg.locator('.react-flow__node', has_text='Faraway').count() == 0: break
    check('after panning away the note is off screen', pg.locator('.react-flow__node', has_text='Faraway').count() == 0)
    pg.keyboard.press('Control+f'); pg.get_by_role('searchbox', name='Find on canvas').fill('faraway'); pg.wait_for_timeout(700)
    fx, fy = center(node('Faraway'))
    check('find pans the view to the match', 60 < fx < 1380 and 60 < fy < 840, f'{fx:.0f}, {fy:.0f}')
    pg.keyboard.press('Escape')

    # ───── لصق في مساحة أخرى ─────
    pg.mouse.click(*center(node('Banana split'))); pg.keyboard.press('Control+c'); pg.wait_for_timeout(250)
    pg.get_by_role('link', name='Workspaces').first.click(); pg.wait_for_selector('article')
    create_workspace('Phase 8 target')
    pg.mouse.move(700, 450); pg.keyboard.press('Control+v'); pg.wait_for_timeout(400)
    check('a card copied in one workspace pastes into another', n_nodes() == 1 and 'Banana split' in node('Banana').inner_text(), str(n_nodes()))

    # ───── شريط الأدوات على الهاتف ─────
    mctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, color_scheme='dark', device_scale_factor=2)
    mp = mctx.new_page()
    mp.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
    mp.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    mp.goto(URL)
    mp.get_by_role('button', name='Create workspace').first.click()
    mp.get_by_placeholder('Learning Roadmap').fill('Phone')
    mp.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    mp.wait_for_url('**/w/**'); mp.wait_for_selector('.react-flow'); mp.wait_for_timeout(600)
    hint, rail = mp.locator('#canvas-empty-heading').locator('xpath=..'), mp.get_by_role('toolbar', name='Canvas tools')
    hb, rb = hint.bounding_box(), rail.bounding_box()
    check('the empty-canvas hint stays clear of the tool rail on a phone', hb is not None and rb is not None and hb['x'] >= rb['x'] + rb['width'], f'{hb} vs {rb}')
    for (x, y) in ((110, 260), (270, 420)):
        open_add_menu(mp); mp.get_by_role('button', name=re.compile('Sticky note')).click(); mp.touchscreen.tap(x, y); mp.wait_for_timeout(300)
    check('two notes are created by tapping on a phone', mp.locator('.react-flow__node').count() == 2, str(mp.locator('.react-flow__node').count()))
    # الملاحظة الجديدة تبدأ في وضع الكتابة، وفيه لا يعمل «تحديد الكل»؛ نخرج منه أولاً
    mp.keyboard.press('Escape'); mp.wait_for_timeout(200)
    # ───── تحديد بطاقة واحدة: لوحة الخصائص المطوية وشريط الإجراءات ─────
    nb = mp.locator('.react-flow__node').first.bounding_box()
    mp.touchscreen.tap(nb['x'] + 24, nb['y'] + nb['height'] - 24); mp.wait_for_timeout(500)
    panel = mp.locator('aside[aria-label="Properties"]').bounding_box()
    zt0 = mp.get_by_role('toolbar', name='Zoom and view').bounding_box()
    check('the collapsed properties panel is a title bar, not a tall empty block', panel is not None and panel['height'] < 80, str(panel))
    check('the properties panel does not cover the zoom and view toolbar', panel is not None and panel['y'] + panel['height'] <= zt0['y'] + 1, f'{panel} vs {zt0}')
    one = mp.locator('[role="toolbar"][aria-label="Actions for the selected item"]').bounding_box()
    check('the single-item action bar stays inside the phone screen', one is not None and one['x'] >= 0 and one['x'] + one['width'] <= 390, str(one))
    mp.keyboard.press('Control+a'); mp.wait_for_timeout(400)
    zb = mp.get_by_role('toolbar', name='Zoom and view').bounding_box()
    check('the zoom and view toolbar fits inside a 390 px screen', zb is not None and zb['x'] >= 0 and zb['x'] + zb['width'] <= 390, str(zb))
    btns = mp.get_by_role('toolbar', name='Zoom and view').get_by_role('button').all()
    off = [b.get_attribute('aria-label') for b in btns if (b.bounding_box() or {'x': -1, 'width': 0})['x'] < 0 or (b.bounding_box() or {'x': 0, 'width': 999})['x'] + (b.bounding_box() or {'width': 999})['width'] > 390]
    check('every zoom and view button is on screen', not off, str(off))
    mp.get_by_role('button', name='Show minimap').tap(); mp.wait_for_timeout(300)
    mm, zt = mp.locator('.react-flow__minimap').bounding_box(), mp.get_by_role('toolbar', name='Zoom and view').bounding_box()
    check('the minimap sits above the two-row zoom toolbar without overlapping it', mm is not None and zt is not None and mm['y'] + mm['height'] <= zt['y'] + 1, f'{mm} vs {zt}')
    mp.get_by_role('button', name='Hide minimap').tap(); mp.wait_for_timeout(200)
    tb = mp.locator('[role="toolbar"][aria-label^="Actions for"]')
    bb = tb.bounding_box() if tb.count() else None
    check('the selection toolbar stays inside a 390 px screen', bb is not None and bb['x'] >= 0 and bb['x'] + bb['width'] <= 390, str(bb))
    hb = mp.evaluate("() => Math.max(...[...document.querySelectorAll('body > div header:not(aside header) a, body > div header:not(aside header) button')].map((e) => e.getBoundingClientRect().bottom))")
    check('the selection toolbar is not hidden under the top bar', bb is not None and bb['y'] >= hb and bb['y'] + bb['height'] <= 844, f'{bb} vs top bar bottom {hb}')
    check('the phone page does not scroll sideways', mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    mp.screenshot(path=os.path.join(SHOTS, 'phone-selection-toolbar.png'))
    mp.keyboard.press('Escape'); mp.get_by_role('button', name=re.compile('Find on canvas')).first.tap(); mp.wait_for_timeout(300)
    fb = mp.get_by_role('search').bounding_box()
    check('the find bar fits a phone screen', fb is not None and fb['x'] >= 0 and fb['x'] + fb['width'] <= 390, str(fb))
    mp.screenshot(path=os.path.join(SHOTS, 'phone-find-bar.png'))

    unexpected = [l for l in logs if 'Content Security Policy' not in l[1]]
    check('no unexpected console or page errors', not unexpected, str(unexpected[:3]))
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f'\n{passed}/{len(results)} checks passed  (screenshots: {SHOTS})')
sys.exit(0 if passed == len(results) else 1)
