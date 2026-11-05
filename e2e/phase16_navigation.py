"""
فحوصات المتصفح للمرحلة 16 (التنقل): التركيز على فرع، قائمة النقر الأيمن، الروابط العميقة.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    python3 e2e/phase16_navigation.py        # أو BASE_URL=http://127.0.0.1:5173/ للتطوير
يطبع PASS/FAIL ويخرج برمز 1 عند أي فشل أو خطأ في الـ console.
"""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


with sync_playwright() as p:
    browser = p.chromium.launch()
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
    def dimmed(text): return 'is-dimmed' in (node(text).get_attribute('class') or '')
    def drag(x1, y1, x2, y2, steps=16):
        pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x2, y2, steps=steps); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(300)
    def new_sticky(x, y, text):
        pg.mouse.move(x, y); pg.mouse.dblclick(x, y)
        pg.wait_for_timeout(120); pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    def child_of(parent, text, dx=330, dy=0):
        n = node(parent); n.hover(); pg.wait_for_timeout(200)
        hx, hy = handle_center(n, 'right'); drag(hx, hy, hx + dx, hy + dy)
        pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    def menu(): return pg.get_by_role('menu', name='Canvas actions')
    def menu_items(): return [t.split('\n')[0].strip() for t in menu().get_by_role('menuitem').all_inner_texts()]

    pg.goto(URL)
    pg.get_by_role('button', name='Create workspace').first.click()
    pg.get_by_placeholder('Learning Roadmap').fill('Navigation')
    pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(500)
    workspace_url = pg.url

    # ───── رسم: A → B → C، وبطاقة D منفصلة ─────
    new_sticky(250, 250, 'Alpha')
    child_of('Alpha', 'Bravo')
    child_of('Bravo', 'Charlie', dx=300)
    new_sticky(300, 650, 'Delta')
    check('four cards were created', n_nodes() == 4, f'{n_nodes()} nodes')
    pg.keyboard.press('Shift+1'); pg.wait_for_timeout(700)  # يُظهر كل البطاقات بعيداً عن اللوحات العائمة (الخصائص والخريطة)

    # ───── التركيز على فرع ─────
    pg.mouse.click(*center(node('Bravo'))); pg.wait_for_timeout(200)
    pg.keyboard.press('f'); pg.wait_for_timeout(300)
    check('F fades a card that is not connected to the selected one', dimmed('Delta') and not dimmed('Alpha') and not dimmed('Bravo') and not dimmed('Charlie'))
    check('the focus pill shows how many cards remain', pg.get_by_text('3 of 4 cards').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    check('Escape clears the selection first and keeps the focus', pg.locator('.react-flow__node.selected').count() == 0 and dimmed('Delta'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('Escape again clears the focus', not dimmed('Delta') and pg.get_by_text('3 of 4 cards').count() == 0)
    pg.mouse.click(*center(node('Alpha'))); pg.wait_for_timeout(200); pg.keyboard.press('f'); pg.wait_for_timeout(300)
    check('focusing the first card keeps everything downstream', not dimmed('Charlie') and dimmed('Delta') and pg.get_by_text('3 of 4 cards').count() == 1)
    pg.get_by_role('button', name='Show all cards (Esc)').click(); pg.wait_for_timeout(300)
    check('the pill button clears the focus', not dimmed('Delta'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250)  # بدون تحديد تُطوى لوحة الخصائص ولا تغطي البطاقات
    pg.mouse.click(*center(node('Charlie'))); pg.wait_for_timeout(200)
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(300)
    pg.get_by_role('combobox', name='Search commands').fill('focus on this'); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('the command palette can focus a branch too', dimmed('Delta') and not dimmed('Alpha'))
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(700)
    check('focus is a view setting: not saved with the workspace', not dimmed('Delta'))

    # ───── قائمة النقر الأيمن: الخلفية ─────
    before = n_nodes()
    pg.mouse.click(900, 120, button='right'); pg.wait_for_timeout(250)
    check('right-click on the canvas opens the menu', menu().count() == 1 and menu().is_visible())
    items = menu_items()
    check('the canvas menu offers creation commands', any('sticky note' in i for i in items) and any('Add image' in i for i in items), str(items))
    check('Paste is disabled with nothing copied', menu().get_by_role('menuitem', name='Paste').is_disabled())
    check('the first available item has keyboard focus', pg.evaluate("document.activeElement?.getAttribute('role')") == 'menuitem')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check('Escape closes the menu', menu().count() == 0)
    pg.mouse.click(900, 120, button='right'); pg.wait_for_timeout(250)
    menu().get_by_role('menuitem', name='Add sticky note here').click(); pg.wait_for_timeout(400)
    check('"Add sticky note here" creates a card', n_nodes() == before + 1, f'{before} -> {n_nodes()}')
    last = pg.locator('.react-flow__node').last.bounding_box()
    check('the new card is placed where the menu was opened', abs(last['x'] + last['width'] / 2 - 900) < 60 and abs(last['y'] + last['height'] / 2 - 120) < 60, str(last))
    pg.keyboard.type('From menu'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check('the menu is gone after running a command', menu().count() == 0)

    # ───── قائمة النقر الأيمن: بطاقة ─────
    pg.mouse.click(*center(node('Delta')), button='right'); pg.wait_for_timeout(250)
    check('right-click on a card opens the card menu', menu().count() == 1 and 'Duplicate' in menu_items())
    check('right-click selects the card it was opened on', pg.locator('.react-flow__node.selected').count() == 1 and 'Delta' in pg.locator('.react-flow__node.selected').first.inner_text())
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowDown')
    check('the arrow keys move through the items', pg.evaluate("document.activeElement?.getAttribute('role')") == 'menuitem')
    menu().get_by_role('menuitem', name='Duplicate').click(); pg.wait_for_timeout(400)
    check('Duplicate from the menu adds a copy', node('Delta').count() >= 1 and n_nodes() == before + 2, f'{n_nodes()} nodes')
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
    pg.mouse.click(*center(node('Delta')), button='right'); pg.wait_for_timeout(250)
    menu().get_by_role('menuitem', name='Delete').click(); pg.wait_for_timeout(400)
    check('Delete from the menu removes the card', n_nodes() == before, f'{n_nodes()} nodes')
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
    check('undo brings it back', node('Delta').count() == 1)
    pg.mouse.click(*center(node('Delta')), button='right'); pg.wait_for_timeout(250)
    menu().get_by_role('menuitem', name='Focus on this branch').click(); pg.wait_for_timeout(400)
    check('"Focus on this branch" fades the unrelated cards', dimmed('Alpha') and not dimmed('Delta'))
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)

    # ───── قائمة النقر الأيمن: وصلة ─────
    edge = pg.locator('.react-flow__edge').first
    bb = edge.locator('path.react-flow__edge-interaction').first.bounding_box() if edge.locator('path.react-flow__edge-interaction').count() else edge.bounding_box()
    pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2, button='right'); pg.wait_for_timeout(250)
    check('right-click on a connection offers to delete it', menu().count() == 1 and 'Delete connection' in menu_items(), str(menu_items()) if menu().count() else 'no menu')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check('right-click on a connection also selects it', pg.locator('.react-flow__edge.selected').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)  # يلغي تحديد الوصلة فتُطوى لوحة الخصائص

    # ───── الروابط العميقة ─────
    pg.mouse.click(*center(node('Charlie')), button='right'); pg.wait_for_timeout(250)
    menu().get_by_role('menuitem', name='Copy link to card').click(); pg.wait_for_timeout(500)
    link = pg.evaluate('navigator.clipboard.readText()')
    check('"Copy link to card" puts a card link on the clipboard', '/w/' in link and '?card=' in link, link)
    check('the link has this workspace and a card id', workspace_url.split('/w/')[1].split('?')[0] in link)
    page2 = ctx.new_page()
    page2.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    page2.goto(link); page2.wait_for_selector('.react-flow'); page2.wait_for_timeout(1500)
    sel = page2.locator('.react-flow__node.selected')
    check('opening the link selects that card', sel.count() == 1 and 'Charlie' in sel.first.inner_text(), sel.first.inner_text() if sel.count() else 'nothing selected')
    bb = sel.first.bounding_box() if sel.count() else None
    check('and brings it into view', bb is not None and 0 <= bb['x'] and bb['x'] + bb['width'] <= 1440 and 0 <= bb['y'] <= 900, str(bb))
    check('the card parameter is removed from the address afterwards', '?card=' not in page2.url, page2.url)
    page2.goto(workspace_url + '?card=00000000-0000-4000-8000-000000000000'); page2.wait_for_selector('.react-flow'); page2.wait_for_timeout(1500)
    check('a link to a card that no longer exists explains it', page2.get_by_text('no longer in this workspace').count() >= 1)
    page2.goto(workspace_url + '?card=%3Cscript%3E'); page2.wait_for_selector('.react-flow'); page2.wait_for_timeout(800)
    # الرسم للبطاقات الظاهرة فقط (onlyRenderVisibleElements)، فنفحص وجود بطاقات لا عددها
    check('a malformed card parameter is ignored quietly', page2.get_by_text('no longer in this workspace').count() == 0 and page2.locator('.react-flow__node').count() >= 1)
    check('and removed from the address', '?card=' not in page2.url, page2.url)
    page2.close()

    # ───── المخطط (Outline) والتكبير الدلالي ─────
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.keyboard.press('o'); pg.wait_for_timeout(400)
    panel = pg.get_by_role('complementary', name='Canvas outline')
    check('O opens the outline', panel.count() == 1 and panel.is_visible())
    rows = panel.locator('li button')
    check('the outline lists every card', rows.count() >= 5, f'{rows.count()} rows')
    check('the search box has focus', pg.evaluate("document.activeElement?.getAttribute('aria-label')") == 'Filter the outline')
    panel.get_by_role('textbox', name='Filter the outline').fill('charlie'); pg.wait_for_timeout(250)
    check('typing filters the list', rows.count() == 1 and 'Charlie' in rows.first.inner_text())
    rows.first.click(); pg.wait_for_timeout(700)
    sel = pg.locator('.react-flow__node.selected')
    check('clicking a row selects that card and shows it', sel.count() == 1 and 'Charlie' in sel.first.inner_text())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('Escape closes the outline', pg.get_by_role('complementary', name='Canvas outline').count() == 0)

    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.mouse.move(600, 500); pg.keyboard.press('g'); pg.wait_for_timeout(300); pg.keyboard.type('Big picture'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    handle = pg.locator('.group-drag-handle').first
    h_near = handle.evaluate('el => el.getBoundingClientRect().height')
    pg.keyboard.press('Escape')
    for _ in range(6):
        pg.get_by_role('button', name='Zoom out (−)').click(); pg.wait_for_timeout(260)
    pg.wait_for_timeout(300)
    zoom_text = pg.get_by_title('Reset zoom to 100%').inner_text()
    scale = pg.evaluate("getComputedStyle(document.querySelector('.canvas-root')).getPropertyValue('--label-scale')")
    check('zoomed far out the label scale grows', float(scale or 1) > 1, f'zoom {zoom_text}, scale {scale}')
    # حجم خط عنوان المجموعة على الشاشة = حجمه في اللوحة × التكبير. بلا تكبير دلالي يكون ~6px عند 42%
    shown = pg.locator('.group-drag-handle').count() > 0
    fs = pg.locator('.group-drag-handle').first.evaluate('el => parseFloat(getComputedStyle(el).fontSize)') if shown else 0
    zoom = float(zoom_text.strip('%')) / 100
    check('so a group title stays readable on screen when zoomed far out', shown and fs * zoom >= 9, f'{fs * zoom:.1f}px on screen at {zoom_text}')
    pg.screenshot(path='/tmp/semantic_zoom.png')

    unexpected = [l for l in logs if 'Content Security Policy' not in l[1]]
    check('no unexpected console or page errors', not unexpected, str(unexpected[:3]))
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f'\n{passed}/{len(results)} checks passed')
sys.exit(0 if passed == len(results) else 1)
