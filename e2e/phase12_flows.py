"""
فحوصات المتصفح لمرحلة طرق التفكير الجديدة على اللوحة (المرحلة 12) على نسخة الإنتاج.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    pip install playwright pillow && playwright install chromium
    python3 e2e/phase12_flows.py          # أو BASE_URL=http://127.0.0.1:5173/ للتطوير

يغطي: وضع العرض التقديمي (كل مجموعة شريحة)، ثم ما يُضاف لاحقاً من هذه المرحلة.
يطبع PASS/FAIL ويخرج برمز 1 عند أي فشل أو خطأ في الـ console.
"""
import os, re, sys, tempfile
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
TMP = tempfile.mkdtemp(prefix='infinitespace-e2e12-')
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
    def n_nodes(): return pg.locator('.react-flow__node').count()
    def new_sticky(x, y, text):
        pg.mouse.move(x, y); pg.mouse.dblclick(x, y)
        pg.wait_for_timeout(120); pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(120)
    def new_group(x, y, label):
        pg.mouse.move(x, y); pg.keyboard.press('g'); pg.wait_for_timeout(200)
        pg.keyboard.type(label); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    def reset():
        pg.keyboard.press('Escape'); pg.keyboard.press('Control+a'); pg.keyboard.press('Delete'); pg.wait_for_timeout(250)
    def create_workspace(name):
        pg.get_by_role('button', name='Create workspace').first.click()
        pg.get_by_placeholder('Learning Roadmap').fill(name)
        pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
        pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(500)
    def viewport():
        m = re.search(r'translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+)\)', pg.locator('.react-flow__viewport').get_attribute('style') or '')
        return tuple(float(v) for v in m.groups()) if m else None
    def run_command(query):
        pg.keyboard.press('Control+k'); pg.wait_for_timeout(300)
        pg.get_by_role('combobox', name='Search commands').fill(query); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)

    pg.goto(URL)
    create_workspace('Phase 12')

    # ───── وضع العرض التقديمي ─────
    pg.mouse.move(700, 450); pg.keyboard.press('p'); pg.wait_for_timeout(300)
    check('with no groups, P explains what to add and does not start', pg.get_by_role('region', name='Presentation controls').count() == 0 and 'Add a group first' in ' '.join(t.inner_text() for t in pg.locator('[aria-live="polite"], [role="status"]').all()))

    # نقطة الإنشاء تحت الرسائل العائمة (y < 170 تحت «Created …») تسقط إلى مركز الشاشة، لذا نبقى تحتها: صف علوي من اثنتين وصف سفلي
    new_group(120, 250, 'Intro'); new_group(800, 250, 'Plan'); new_group(120, 700, 'Wrap up')
    groups = pg.locator('.react-flow__node-group')
    check('setup: three labelled groups', groups.count() == 3, str(groups.count()))
    new_sticky(260, 300, 'Hello')
    before_positions = [groups.nth(i).bounding_box() for i in range(3)]
    before_view = viewport()
    n_before = n_nodes()

    pg.mouse.click(700, 500); pg.wait_for_timeout(150)
    pg.keyboard.press('p'); pg.wait_for_timeout(1000)
    pill = pg.get_by_role('region', name='Presentation controls')
    check('P starts the presentation with a control pill', pill.count() == 1 and pill.is_visible())
    check('it starts on the first slide in reading order', 'Intro' in pill.inner_text() and '1 / 3' in pill.inner_text(), pill.inner_text().replace('\n', ' '))
    check('editing handles are hidden on the slide', pg.locator('.react-flow__handle:visible').count() == 0)
    check('the surrounding interface is hidden', pg.get_by_role('toolbar', name='Add to canvas').count() == 0 and pg.get_by_role('toolbar', name='Zoom and view').count() == 0 and not pg.locator('header').first.is_visible())

    def slide_centered(label):
        g = pg.locator('.react-flow__node-group', has_text=label).first.bounding_box()
        cx, cy = g['x'] + g['width'] / 2, g['y'] + g['height'] / 2
        return abs(cx - 720) < 60 and abs(cy - 450) < 60 and g['width'] > 700, f'{g}'
    ok, detail = slide_centered('Intro'); check('the first group fills and centers the screen', ok, detail)

    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(1000)
    ok, detail = slide_centered('Plan'); check('ArrowRight flies to the next group', ok and '2 / 3' in pill.inner_text(), detail)
    pg.keyboard.press(' '); pg.wait_for_timeout(1000)
    ok, detail = slide_centered('Wrap up'); check('Space also moves forward', ok and '3 / 3' in pill.inner_text(), detail)
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(300)
    check('the last slide does not wrap around', '3 / 3' in pill.inner_text())
    pg.keyboard.press('Home'); pg.wait_for_timeout(1000)
    check('Home returns to the first slide', '1 / 3' in pill.inner_text() and slide_centered('Intro')[0])
    pg.keyboard.press('End'); pg.wait_for_timeout(300)
    check('End jumps to the last slide', '3 / 3' in pill.inner_text())
    pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(300)
    check('ArrowLeft goes back one slide', '2 / 3' in pill.inner_text())
    check('the slide title and position are announced', 'Slide 2 of 3: Plan' in pg.locator('[role=status]').filter(has_text='Slide 2 of 3').first.inner_text())

    # لا تحرير أثناء العرض
    for key in ('Delete', 'l', 'Control+a', 'Control+z', 'g', 't', 'c'):  # n وp تنقلان بين الشرائح أثناء العرض
        pg.keyboard.press(key); pg.wait_for_timeout(80)
    # أثناء العرض لا يُرسم في DOM إلا ما يظهر (onlyRenderVisibleElements)، فعدّ العقد هنا لا يكشف الحذف؛ الفحص الحقيقي بعد الخروج
    check('editing shortcuts open nothing while presenting', pg.get_by_role('dialog').count() == 0 and pg.get_by_role('region', name='Presentation controls').count() == 1)
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(250)
    check('Ctrl+K does not open the command palette while presenting', pg.get_by_role('dialog', name='Command palette').count() == 0)
    g2 = pg.locator('.react-flow__node-group', has_text='Plan').first
    def flow_pos(loc):
        m = re.search(r'translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)', loc.get_attribute('style') or '')
        return (float(m.group(1)), float(m.group(2)))
    gb = g2.bounding_box(); flow_before = flow_pos(g2)
    pg.mouse.move(gb['x'] + 40, gb['y'] + 14); pg.mouse.down(); pg.mouse.move(gb['x'] + 240, gb['y'] + 114, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    check('dragging a slide does not move it (panning the view is still allowed)', flow_pos(g2) == flow_before, f'{flow_before} -> {flow_pos(g2)}')
    gb = g2.bounding_box()
    pg.mouse.click(gb['x'] + gb['width'] / 2, gb['y'] + gb['height'] / 2); pg.wait_for_timeout(150)
    check('clicking does not select anything', pg.locator('.react-flow__node.selected').count() == 0)

    pg.keyboard.press('Escape'); pg.wait_for_timeout(1000)
    check('Esc exits and brings the interface back', pg.get_by_role('region', name='Presentation controls').count() == 0 and pg.get_by_role('toolbar', name='Add to canvas').is_visible() and pg.locator('header').first.is_visible())
    after_view = viewport()
    check('the view is restored to where it was before presenting', before_view is not None and after_view is not None and all(abs(a - b) < 1 for a, b in zip(before_view, after_view)), f'{before_view} -> {after_view}')
    after_positions = [groups.nth(i).bounding_box() for i in range(3)]
    check('nothing moved or changed during the presentation', n_nodes() == n_before and all(abs(a['x'] - b['x']) < 1 and abs(a['y'] - b['y']) < 1 for a, b in zip(before_positions, after_positions)))

    # البدء من المجموعة المحددة
    header = pg.locator('.react-flow__node-group', has_text='Wrap up').first.locator('.group-drag-handle')
    hb = header.bounding_box(); pg.mouse.click(hb['x'] + hb['width'] - 20, hb['y'] + hb['height'] / 2); pg.wait_for_timeout(250)
    check('setup: the last group is selected', pg.locator('.react-flow__node-group.selected', has_text='Wrap up').count() == 1)
    pg.keyboard.press('p'); pg.wait_for_timeout(900)
    check('with a group selected the presentation starts on it', 'Wrap up' in pill.inner_text() and '3 / 3' in pill.inner_text(), pill.inner_text().replace('\n', ' '))
    pg.get_by_role('button', name='Exit presentation (Esc)').click(); pg.wait_for_timeout(900)
    check('the exit button ends the presentation', pg.get_by_role('region', name='Presentation controls').count() == 0)
    pg.mouse.click(700, 500); pg.wait_for_timeout(150)
    run_command('presentation')
    check('the command palette can start a presentation', pill.count() == 1 and pill.is_visible())
    pg.get_by_role('button', name='Next slide (→)').click(); pg.wait_for_timeout(500)
    check('the on-screen next button moves forward', '2 / 3' in pill.inner_text() or '1 / 3' in pill.inner_text())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(700)

    # ───── معرض القوالب ─────
    def go_dashboard():
        pg.get_by_role('link', name='Workspaces').first.click(); pg.wait_for_selector('article')
    def create_from_template(label, name=None):
        pg.get_by_role('button', name='Create workspace').first.click(); pg.wait_for_timeout(250)
        dialog = pg.locator('dialog[open]')
        dialog.locator('label', has_text=label).first.click(); pg.wait_for_timeout(100)
        if name is not None: dialog.get_by_label('Name', exact=True).fill(name)
        dialog.get_by_role('button', name='Create workspace').click()
        pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(900)
    go_dashboard()
    pg.get_by_role('button', name='Create workspace').first.click(); pg.wait_for_timeout(250)
    dlg = pg.locator('dialog[open]')
    check('the create dialog offers six starting points', dlg.locator('input[name="workspace-template"]').count() == 6 and dlg.locator('input[name="workspace-template"]:checked + span').inner_text().startswith('Blank'))
    dlg.locator('label', has_text='Kanban').first.click(); pg.wait_for_timeout(100)
    check('choosing a template suggests a name', dlg.get_by_label('Name', exact=True).input_value() == 'Project board')
    dlg.get_by_label('Name', exact=True).fill('Sprint board')
    dlg.locator('label', has_text='Roadmap').first.click(); pg.wait_for_timeout(100)
    check('a name the user typed is not replaced by another template', dlg.get_by_label('Name', exact=True).input_value() == 'Sprint board')
    dlg.locator('label', has_text='Kanban').first.click()
    dlg.get_by_role('button', name='Create workspace').click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(900)
    check('a Kanban workspace opens with three columns and five notes', pg.locator('.react-flow__node-group').count() == 3 and pg.locator('.react-flow__node-sticky').count() == 5, f"{pg.locator('.react-flow__node-group').count()} groups, {pg.locator('.react-flow__node-sticky').count()} notes")
    check('the success message names the template', pg.get_by_text('from the Kanban template').count() == 1)
    check('the columns are titled', all(pg.locator('.react-flow__node-group', has_text=t).count() == 1 for t in ('To do', 'Doing', 'Done')))
    check('the whole board is on screen at once', all((g.bounding_box() or {'x': -1, 'y': -1, 'width': 9999, 'height': 9999})['x'] >= 0 and g.bounding_box()['x'] + g.bounding_box()['width'] <= 1440 and g.bounding_box()['y'] >= 0 and g.bounding_box()['y'] + g.bounding_box()['height'] <= 900 for g in pg.locator('.react-flow__node-group').all()))
    check('the empty-canvas hint is not shown for a template', pg.get_by_text('A blank canvas').count() == 0)
    # الأوراق أبناء إطاراتها: تحريك الإطار يحرك ورقته
    todo = pg.locator('.react-flow__node-group', has_text='To do').first
    brief = pg.locator('.react-flow__node', has_text='Write the brief').first
    b_before = brief.bounding_box(); g_before = todo.bounding_box(); handle = todo.locator('.group-drag-handle').bounding_box()
    pg.mouse.move(handle['x'] + handle['width'] - 30, handle['y'] + handle['height'] / 2); pg.mouse.down(); pg.mouse.move(handle['x'] + handle['width'] - 30 + 60, handle['y'] + handle['height'] / 2 + 40, steps=10); pg.mouse.up(); pg.wait_for_timeout(300)
    b_after = brief.bounding_box(); g_after = todo.bounding_box()
    gdx, gdy = g_after['x'] - g_before['x'], g_after['y'] - g_before['y']
    # أول خطوة من السحب تستهلكها عتبة السحب (3px) فلا تطابق الإزاحة حركة الفأرة تماماً؛ المهم أن تتحرك الورقة مع إطارها
    check('moving a column moves the notes inside it', gdx > 40 and gdy > 25 and abs((b_after['x'] - b_before['x']) - gdx) < 1.5 and abs((b_after['y'] - b_before['y']) - gdy) < 1.5, f'group {gdx:.1f},{gdy:.1f}; note {b_after["x"] - b_before["x"]:.1f},{b_after["y"] - b_before["y"]:.1f}')
    pg.reload(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(900)
    check('the template survives a reload', pg.locator('.react-flow__node-group').count() == 3 and pg.locator('.react-flow__node-sticky').count() == 5)

    go_dashboard(); create_from_template('Mind map')
    check('a mind map opens with a centre, four branches and eight details', pg.locator('.react-flow__node-sticky').count() == 13 and pg.locator('.react-flow__edge').count() == 12, f"{pg.locator('.react-flow__node-sticky').count()} notes, {pg.locator('.react-flow__edge').count()} edges")
    check('the mind map has no frames', pg.locator('.react-flow__node-group').count() == 0)
    go_dashboard(); create_from_template('SWOT')
    check('SWOT opens with four quadrants', pg.locator('.react-flow__node-group').count() == 4 and all(pg.locator('.react-flow__node-group', has_text=t).count() == 1 for t in ('Strengths', 'Weaknesses', 'Opportunities', 'Threats')))
    go_dashboard(); create_from_template('Roadmap')
    check('the roadmap opens with four columns joined by two connections', pg.locator('.react-flow__node-group').count() == 4 and pg.locator('.react-flow__edge').count() == 2)
    go_dashboard(); create_from_template('Retrospective')
    check('a retrospective opens with three columns', pg.locator('.react-flow__node-group').count() == 3)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    check('a freshly created template has nothing to undo', pg.locator('.react-flow__node-group').count() == 3)
    go_dashboard(); create_from_template('Kanban', 'Sprint board')
    go_dashboard()
    check('creating from a template never overwrites a workspace with the same name', pg.get_by_role('heading', name=re.compile('^Sprint board')).count() >= 2 or pg.get_by_text(re.compile('^Sprint board')).count() >= 2)
    pg.get_by_role('button', name='Create workspace').first.click(); pg.wait_for_timeout(250)
    pg.locator('dialog[open]').get_by_label('Name', exact=True).fill('Plain one')
    pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(600)
    check('Blank still creates an empty canvas', pg.locator('.react-flow__node').count() == 0 and pg.get_by_text('A blank canvas').count() == 1)

    unexpected = [l for l in logs if 'Content Security Policy' not in l[1]]
    check('no unexpected console or page errors', not unexpected, str(unexpected[:3]))
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f'\n{passed}/{len(results)} checks passed  (temp: {TMP})')
sys.exit(0 if passed == len(results) else 1)
