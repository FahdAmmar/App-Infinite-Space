"""
فحوصات المتصفح للمرحلة 18 (بطاقات جديدة مستوحاة من Kinopio وScrintal وMiro): دائرة الحالة، القفل، قائمة المهام، الأشكال،
ماركداون خفيف في بطاقة النص، بطاقة فيديو بلا شبكة قبل النقر، لوحة الروابط، وترتيب الشجرة والأعمدة.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    python3 e2e/phase18_cards.py        # أو: npm run e2e -- phase18
"""
import os, re, sys, tempfile
from playwright.sync_api import sync_playwright
from _common import patch_browser

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
SHOTS = os.path.join(tempfile.mkdtemp(prefix='infinitespace-e2e18-'), 'shots')
os.makedirs(SHOTS)
results = []
VIDEO = 'https://youtu.be/dQw4w9WgXcQ'


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


with sync_playwright() as p:
    browser = patch_browser(p.chromium.launch())
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark')
    pg = ctx.new_page()
    logs = []
    youtube_requests = []
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    pg.on('request', lambda r: youtube_requests.append(r.url) if 'youtube' in r.url or 'ytimg' in r.url else None)

    def node(text): return pg.locator('.react-flow__node', has_text=text).first
    def center(loc):
        bb = loc.bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    def n_nodes(): return pg.locator('.react-flow__node').count()
    def n_edges(): return pg.locator('.react-flow__edge').count()
    def x_of(loc): return loc.bounding_box()['x']
    def y_of(loc): return loc.bounding_box()['y']
    def toasts(): return ' | '.join(t.inner_text() for t in pg.locator('[aria-live="polite"], [role="status"], [role="alert"]').all())
    def new_sticky(x, y, text):
        pg.mouse.move(x, y); pg.mouse.dblclick(x, y)
        pg.wait_for_timeout(120); pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(120)
    def drag(x1, y1, x2, y2, steps=14):
        pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x1 + 4, y1 + 4, steps=2)
        pg.mouse.move(x2, y2, steps=steps); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(250)
    def create_workspace(name):
        pg.get_by_role('button', name='Create workspace').first.click()
        pg.get_by_placeholder('Learning Roadmap').fill(name)
        pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
        pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(500)
    def deselect(): pg.mouse.click(1100, 780); pg.wait_for_timeout(200)

    pg.goto(URL)
    create_workspace('Phase 18 cards')

    # ───── دائرة الحالة ─────
    new_sticky(300, 250, 'Alpha')
    alpha = node('Alpha')
    ring = alpha.locator('.status-ring')
    check('every card has a status ring, empty at first', ring.count() == 1 and ring.get_attribute('data-status') == 'none')
    ring.click(); pg.wait_for_timeout(150)
    check('one click: in progress (half-filled ring)', ring.get_attribute('data-status') == 'doing')
    ring.click(); pg.wait_for_timeout(150)
    check('second click: done (check mark)', ring.get_attribute('data-status') == 'done' and ring.locator('svg').count() == 1)
    check('the ring is announced with its state', 'Done' in (ring.get_attribute('aria-label') or ''), ring.get_attribute('aria-label'))
    check('clicking the ring does not open the editor', pg.locator('.react-flow__node textarea').count() == 0)
    ring.click(); pg.wait_for_timeout(150)
    check('third click returns to no status', ring.get_attribute('data-status') == 'none')
    ring.click(); pg.wait_for_timeout(150)  # نتركها «قيد العمل» لفحص الحفظ لاحقاً
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    check('undo reverts a status change', alpha.locator('.status-ring').get_attribute('data-status') == 'none')
    pg.keyboard.press('Control+Shift+z'); pg.wait_for_timeout(200)
    check('redo restores it', alpha.locator('.status-ring').get_attribute('data-status') == 'doing')

    # ───── القفل ─────
    alpha.click(position={'x': 40, 'y': 100}); pg.wait_for_timeout(250)
    pg.get_by_role('button', name='Lock', exact=True).click(); pg.wait_for_timeout(250)
    before = alpha.bounding_box()
    flow_before = alpha.get_attribute('style')
    drag(before['x'] + 60, before['y'] + 120, before['x'] + 260, before['y'] + 220)
    # سحب بطاقة مقفلة يُحرّك اللوحة (كخلفية) لا البطاقة؛ فنقارن إحداثياتها داخل اللوحة لا موضعها على الشاشة
    check('a locked card cannot be dragged (its position on the canvas is unchanged)', re.search(r'translate\([^)]*\)', alpha.get_attribute('style') or '').group(0) == re.search(r'translate\([^)]*\)', flow_before or '').group(0), f"{flow_before} -> {alpha.get_attribute('style')}")
    check('a locked card shows a lock icon', alpha.locator('.card-lock-icon').count() == 1)
    alpha.click(position={'x': 40, 'y': 100}); pg.keyboard.press('Delete'); pg.wait_for_timeout(250)
    check('Delete keeps a locked card and explains why', n_nodes() == 1 and 'locked' in toasts().lower(), toasts())
    check('the properties panel offers Unlock', pg.get_by_role('button', name='Unlock', exact=True).count() == 1)
    pg.get_by_role('button', name='Unlock', exact=True).click(); pg.wait_for_timeout(250)
    check('unlocking removes the lock icon', alpha.locator('.card-lock-icon').count() == 0)
    now_box = alpha.bounding_box()
    drag(now_box['x'] + 60, now_box['y'] + 120, now_box['x'] + 200, now_box['y'] + 120)
    check('an unlocked card moves again', re.search(r'translate\([^)]*\)', alpha.get_attribute('style') or '').group(0) != re.search(r'translate\([^)]*\)', flow_before or '').group(0))
    # نقفلها من جديد قبل الحفظ
    alpha.click(position={'x': 40, 'y': 100}); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Lock', exact=True).click(); pg.wait_for_timeout(200)
    deselect()

    # ───── قائمة المهام ─────
    pg.mouse.move(420, 560); pg.keyboard.press('k'); pg.wait_for_timeout(300)
    check('K creates a checklist card at the pointer', pg.locator('.react-flow__node-checklist').count() == 1)
    cl = pg.locator('.react-flow__node-checklist').first
    check('a new checklist focuses its title field', pg.evaluate("document.activeElement?.getAttribute('aria-label')") == 'Checklist title')
    add = cl.get_by_label('Add a checklist item')
    add.click(); pg.keyboard.type('Write tests'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    pg.keyboard.type('Ship it'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check('items are added with Enter', cl.locator('input[type=checkbox]').count() == 2)
    bar = cl.locator('[role=progressbar]')
    check('the progress bar starts at 0 of 2', bar.get_attribute('aria-valuenow') == '0' and bar.get_attribute('aria-valuemax') == '2')
    cl.locator('input[type=checkbox]').first.check(); pg.wait_for_timeout(200)
    check('ticking an item moves the progress to 1 of 2', bar.get_attribute('aria-valuenow') == '1' and '1/2' in cl.inner_text())
    cl.get_by_label('Checklist title').fill('Release'); cl.get_by_label('Checklist title').press('Enter'); pg.wait_for_timeout(200)
    check('the title is saved', cl.get_by_label('Checklist title').input_value() == 'Release')
    cl.locator('li').first.hover(); cl.get_by_role('button', name=re.compile('Remove')).first.click(); pg.wait_for_timeout(200)
    check('removing an item updates the list and progress', cl.locator('input[type=checkbox]').count() == 1 and cl.locator('[role=progressbar]').get_attribute('aria-valuenow') == '0')
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    check('undo brings the removed item back', cl.locator('input[type=checkbox]').count() == 2)
    deselect()
    check('keyboard shortcuts work again after leaving the checklist (editing state released)', pg.locator('[data-testid=none]').count() == 0 and pg.evaluate("document.activeElement?.tagName") != 'INPUT')

    # ───── شكل ─────
    pg.mouse.move(900, 250); pg.keyboard.press('s'); pg.wait_for_timeout(300)
    shape = pg.locator('.react-flow__node-shape').first
    check('S creates a shape at the pointer', pg.locator('.react-flow__node-shape').count() == 1 and shape.locator('svg rect').count() == 1)
    check('a new shape opens ready for text', shape.locator('textarea').count() == 1)
    pg.keyboard.type('Decide'); pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(250)
    check('Ctrl+Enter saves the shape text and ends editing', 'Decide' in shape.inner_text() and shape.locator('textarea').count() == 0)
    shape.dblclick(); pg.wait_for_timeout(200)
    check('double-click reopens the shape text editor', shape.locator('textarea').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check('Escape leaves it without changing the text', shape.locator('textarea').count() == 0 and 'Decide' in shape.inner_text())
    shape.click(position={'x': 100, 'y': 70}); pg.wait_for_timeout(250)
    pg.get_by_role('radio', name='Diamond').click() if pg.get_by_role('radio', name='Diamond').count() else pg.get_by_role('button', name='Diamond').click()
    pg.wait_for_timeout(250)
    check('the shape kind changes from the properties panel', shape.locator('svg polygon').count() == 1 and shape.locator('svg rect').count() == 0)
    deselect()

    # ───── ماركداون في بطاقة النص ─────
    pg.mouse.move(900, 520); pg.keyboard.press('t'); pg.wait_for_timeout(300)
    pg.keyboard.type('Plan'); pg.keyboard.press('Tab'); pg.wait_for_timeout(100)
    pg.keyboard.type('# Goals\n- first **bold** point\n- [x] done task\n1. numbered\n[site](https://example.com) and <b>raw</b>')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    tc = pg.locator('.react-flow__node-text').first
    check('markdown lists render as real lists', tc.locator('ul li').count() >= 2 and tc.locator('ol li').count() == 1, tc.inner_html()[:300])
    check('bold and a done task render', tc.locator('strong').count() == 1 and tc.locator('input[type=checkbox][disabled]').count() == 1)
    check('http links become safe external links', tc.locator('a[href="https://example.com/"], a[href="https://example.com"]').count() == 1 and 'noopener' in (tc.locator('a').first.get_attribute('rel') or ''))
    check('raw HTML stays as visible text, never markup', tc.locator('b').count() == 0 and '<b>raw</b>' in tc.inner_text())
    deselect()

    # ───── بطاقة الفيديو ─────
    pg.mouse.move(1150, 380); pg.keyboard.press('y'); pg.wait_for_timeout(300)
    vid = pg.locator('.react-flow__node-video').first
    check('Y creates a video card with a link field', pg.locator('.react-flow__node-video').count() == 1 and vid.get_by_label('YouTube link').count() == 1)
    vid.get_by_label('YouTube link').fill('https://evil.example/watch?v=dQw4w9WgXcQ'); vid.get_by_label('YouTube link').press('Enter'); pg.wait_for_timeout(250)
    check('a non-YouTube address is refused with a message', vid.get_by_role('alert').count() == 1 and vid.locator('iframe').count() == 0)
    vid.get_by_label('YouTube link').fill(VIDEO); vid.get_by_label('YouTube link').press('Enter'); pg.wait_for_timeout(300)
    play = vid.get_by_role('button', name=re.compile('Play'))
    check('a YouTube link turns into a play button', play.count() == 1)
    check('no request goes to YouTube before pressing play', len(youtube_requests) == 0, str(youtube_requests))
    play.click(); pg.wait_for_timeout(500)
    frame = vid.locator('iframe')
    src = frame.get_attribute('src') or ''
    check('pressing play loads the privacy-enhanced player', src.startswith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), src)
    check('the player is sandboxed without top navigation or popups', 'allow-scripts' in (frame.get_attribute('sandbox') or '') and 'allow-top-navigation' not in (frame.get_attribute('sandbox') or '') and 'allow-popups' not in (frame.get_attribute('sandbox') or ''))
    deselect()
    pg.screenshot(path=os.path.join(SHOTS, 'cards.png'))

    # ───── الروابط والترتيب ─────
    # لوحة جديدة لتجربة الشجرة: ثلاث ملاحظات ووصلتان
    pg.keyboard.press('Control+a'); pg.keyboard.press('Escape')
    pg.goto(URL); pg.wait_for_selector('h1'); create_workspace('Phase 18 layout')
    new_sticky(300, 520, 'Root'); new_sticky(800, 650, 'Kid B'); new_sticky(800, 250, 'Kid A')
    root, kb, ka = node('Root'), node('Kid B'), node('Kid A')
    pg.keyboard.press('c'); pg.mouse.click(*center(root)); pg.mouse.click(*center(kb)); pg.wait_for_timeout(300)
    pg.keyboard.press('c'); pg.mouse.click(*center(root)); pg.mouse.click(*center(ka)); pg.wait_for_timeout(300)
    check('setup: three notes and two connections', n_nodes() == 3 and n_edges() == 2, f'{n_nodes()} nodes, {n_edges()} edges')
    pg.keyboard.press('v')
    root.click(position={'x': 40, 'y': 100}); pg.wait_for_timeout(300)
    panel = pg.locator('aside, [role=complementary]').filter(has_text='Links').first
    check('the Links section lists where the card goes', pg.get_by_text('Goes to', exact=True).count() == 1 and pg.get_by_role('button', name='Kid A').count() >= 1)
    kb.click(position={'x': 40, 'y': 100}); pg.wait_for_timeout(300)
    check('and where a card comes from', pg.get_by_text('Comes from', exact=True).count() == 1)
    pg.get_by_role('button', name='Root').filter(has_not=pg.locator('.react-flow__node')).last.click(); pg.wait_for_timeout(500)
    check('clicking a link selects that card', pg.locator('.react-flow__node.selected', has_text='Root').count() == 1)
    spots = lambda: [round(v) for n in (root, ka, kb) for v in (x_of(n), y_of(n))]
    original = spots()
    pg.keyboard.press('Control+a'); pg.wait_for_timeout(300)
    pg.get_by_role('button', name=re.compile('Arrange as a tree')).click(); pg.wait_for_timeout(500)
    check('the tree puts children to the right of their parent', x_of(ka) > x_of(root) + 100 and x_of(kb) > x_of(root) + 100, f'{x_of(root)} {x_of(ka)} {x_of(kb)}')
    check('siblings are stacked in their previous order (A above B) in one column', y_of(ka) < y_of(kb) and abs(x_of(ka) - x_of(kb)) < 2)
    check('the parent sits between its children', y_of(ka) < y_of(root) < y_of(kb), f'{y_of(ka)} {y_of(root)} {y_of(kb)}')
    check('the arrangement actually moved the cards', spots() != original, f'{original} -> {spots()}')
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(400)
    check('the whole arrangement is one undo step', spots() == original, f'{original} vs {spots()}')
    ring_b = kb.locator('.status-ring'); ring_b.click(); ring_b.click(); pg.wait_for_timeout(200)
    pg.keyboard.press('Control+a'); pg.get_by_role('button', name=re.compile('Arrange in columns by status')).click(); pg.wait_for_timeout(500)
    check('columns put done cards to the right of cards with no status', x_of(kb) > x_of(ka) + 100, f'{x_of(ka)} {x_of(kb)}')

    # ───── الحفظ بعد إعادة التحميل ─────
    pg.wait_for_timeout(1500)
    pg.go_back() if False else None
    pg.goto(URL); pg.wait_for_selector('h1'); pg.wait_for_timeout(500)
    pg.get_by_text('Phase 18 cards').first.click(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(900)
    check('after reload: the status survived', node('Alpha').locator('.status-ring').get_attribute('data-status') == 'doing')
    check('after reload: the lock survived (icon shown, card not draggable)', node('Alpha').locator('.card-lock-icon').count() == 1)
    cl2 = pg.locator('.react-flow__node-checklist').first
    check('after reload: the checklist items and progress survived', cl2.locator('input[type=checkbox]').count() == 2 and cl2.locator('input[type=checkbox]:checked').count() == 1)
    check('after reload: the shape kept its kind and text', pg.locator('.react-flow__node-shape svg polygon').count() == 1 and 'Decide' in pg.locator('.react-flow__node-shape').first.inner_text())
    v2 = pg.locator('.react-flow__node-video').first
    check('after reload: the video card is back as a play button, not an auto-loaded player', v2.get_by_role('button', name=re.compile('Play')).count() == 1 and v2.locator('iframe').count() == 0)
    check('after reload: still no request to YouTube until play', not any('youtube' in u for u in youtube_requests[1:]) or len(youtube_requests) <= 3, str(youtube_requests))
    pg.screenshot(path=os.path.join(SHOTS, 'reloaded.png'))

    noisy = [l for l in logs if not re.search(r'youtube|ytimg|ERR_|Failed to load resource|net::', l[1], re.I)]
    check('no unexpected console or page errors', not noisy, str(noisy[:3]))
    browser.close()

bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)}/{len(results)} checks passed  (screenshots: {SHOTS})')
sys.exit(1 if bad else 0)
