"""
فحوصات المتصفح لمرحلة الإضافات السريعة (المرحلة 11) على نسخة الإنتاج.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    pip install playwright pillow && playwright install chromium
    python3 e2e/quickwins_flows.py          # أو BASE_URL=http://127.0.0.1:5173/ للتطوير

يغطي: السحب من مقبض إلى لوحة فارغة، لصق النص والروابط، لوحة الأوامر، ضغط الصور (الصور تُولَّد في الكود)، وتصفية الوسوم.
يطبع PASS/FAIL ويخرج برمز 1 عند أي فشل أو خطأ في الـ console.
"""
import os, re, sys, tempfile
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
from _common import patch_browser

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
TMP = tempfile.mkdtemp(prefix='infinitespace-e2e11-')
results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


with sync_playwright() as p:
    browser = patch_browser(p.chromium.launch())
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
    def new_sticky(x, y, text):
        pg.mouse.move(x, y); pg.mouse.dblclick(x, y)
        pg.wait_for_timeout(120); pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(120)
    def drag(x1, y1, x2, y2, steps=16):
        pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x2, y2, steps=steps); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(300)
    def reset():
        pg.keyboard.press('Escape'); pg.keyboard.press('Control+a'); pg.keyboard.press('Delete'); pg.wait_for_timeout(250)
    def create_workspace(name):
        pg.get_by_role('button', name='Create workspace').first.click()
        pg.get_by_placeholder('Learning Roadmap').fill(name)
        pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
        pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(500)

    pg.goto(URL)
    create_workspace('Quick wins')

    # ───── السحب من مقبض إلى لوحة فارغة ─────
    new_sticky(400, 300, 'Root')
    root = node('Root'); root.hover(); pg.wait_for_timeout(200)
    hx, hy = handle_center(root, 'right')
    drag(hx, hy, hx + 5, hy + 3, steps=3)
    check('a tiny drag on a handle creates nothing', n_nodes() == 1 and n_edges() == 0, f'{n_nodes()} nodes, {n_edges()} edges')
    root.hover(); pg.wait_for_timeout(200); hx, hy = handle_center(root, 'right')
    drag(hx, hy, hx + 330, hy + 40)
    check('dragging a handle onto empty canvas creates a connected card', n_nodes() == 2 and n_edges() == 1, f'{n_nodes()} nodes, {n_edges()} edges')
    edge_label = pg.locator('.react-flow__edge').first.get_attribute('aria-label') or ''
    new_id = [i for i in pg.locator('.react-flow__node').evaluate_all('els => els.map(e => e.dataset.id)') if i != root.get_attribute('data-id')][0]
    check('the connection runs from the dragged card to the new one', edge_label.endswith(new_id) and root.get_attribute('data-id') in edge_label)
    rb, nb = root.bounding_box(), pg.locator(f'.react-flow__node[data-id="{new_id}"]').bounding_box()
    check('the new card lands on the side that was dragged toward', nb['x'] > rb['x'] + rb['width'] and abs((nb['x']) - (hx + 330)) < 25, f'{nb} vs drop x {hx + 330}')
    check('the new card opens for typing', pg.locator('.react-flow__node textarea, .react-flow__node [contenteditable="true"], .react-flow__node input').count() >= 1)
    pg.keyboard.type('Child idea'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check('typed text lands in the new card', node('Child idea').count() == 1)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    check('undo removes the new card and its connection together', n_nodes() == 1 and n_edges() == 0, f'{n_nodes()} nodes, {n_edges()} edges')
    root.hover(); pg.wait_for_timeout(200); bx, by = handle_center(root, 'bottom')
    drag(bx, by, bx - 20, by + 220)
    check('dragging the bottom handle works too and the card is below', n_nodes() == 2 and n_edges() == 1 and pg.locator('.react-flow__node').nth(1).bounding_box()['y'] > root.bounding_box()['y'] + 150)
    pg.keyboard.press('Escape')

    # ───── لصق النص والروابط ─────
    def paste_text(text):
        pg.evaluate('(t) => navigator.clipboard.writeText(t)', text)
        pg.wait_for_timeout(150); pg.mouse.move(700, 450); pg.keyboard.press('Control+v'); pg.wait_for_timeout(400)
    reset()
    paste_text('https://example.com/docs?x=1')
    check('a pasted web address becomes a link card', n_nodes() == 1 and pg.locator('.react-flow__node a[href="https://example.com/docs?x=1"]').count() == 1, f'{n_nodes()} nodes')
    reset()
    paste_text('First idea\n\nSecond idea\n\nhttps://example.org')
    check('pasted paragraphs become one card each', n_nodes() == 3, f'{n_nodes()} nodes')
    check('every pasted card is selected', pg.locator('.react-flow__node.selected').count() == 3)
    check('a pasted address among paragraphs becomes a link', pg.locator('.react-flow__node a[href="https://example.org/"]').count() == 1)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(250)
    check('undo removes the whole paste in one step', n_nodes() == 0, f'{n_nodes()} nodes')
    paste_text('javascript:alert(1)')
    check('a dangerous address stays plain text, never a link', n_nodes() == 1 and pg.locator('.react-flow__node a').count() == 0 and node('javascript:alert(1)').count() == 1)
    reset()
    paste_text('hello')
    check('a plain word is a note, not a link', n_nodes() == 1 and pg.locator('.react-flow__node a').count() == 0 and node('hello').count() == 1)
    reset()
    new_sticky(500, 350, 'Typing target')
    node('Typing target').dblclick(); pg.wait_for_timeout(200)
    before = n_nodes()
    pg.evaluate('(t) => navigator.clipboard.writeText(t)', 'pasted while editing'); pg.wait_for_timeout(150)
    pg.keyboard.press('Control+v'); pg.wait_for_timeout(300)
    check('pasting while editing a card types into it and creates no card', n_nodes() == before, f'{before} -> {n_nodes()}')
    pg.keyboard.press('Escape')

    # ───── لوحة الأوامر ─────
    palette = pg.get_by_role('dialog', name='Command palette')
    def open_palette():
        pg.keyboard.press('Control+k'); pg.wait_for_timeout(300)
    def run_command(query):
        open_palette(); pg.get_by_role('combobox', name='Search commands').fill(query); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    reset()
    open_palette()
    check('Ctrl+K opens the command palette', palette.count() == 1 and palette.is_visible())
    check('the search box has focus right away', pg.evaluate("document.activeElement?.getAttribute('role')") == 'combobox')
    check('the list shows create, view and navigation commands', palette.get_by_role('option').count() >= 12, str(palette.get_by_role('option').count()))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('Escape closes the palette', palette.is_visible() is False)
    run_command('sticky')
    check('running "Add sticky note" adds a card and closes the palette', n_nodes() == 1 and not palette.is_visible(), f'{n_nodes()} nodes')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    run_command('find')
    check('running "Find on canvas" opens the find bar with focus in its field', pg.get_by_role('search').count() == 1 and pg.evaluate("document.activeElement?.getAttribute('aria-label')") == 'Find on canvas')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    theme_before = pg.evaluate("document.documentElement.className + '|' + (document.documentElement.getAttribute('data-theme') ?? '')")
    run_command('theme')
    theme_after = pg.evaluate("document.documentElement.className + '|' + (document.documentElement.getAttribute('data-theme') ?? '')")
    check('the theme command switches the theme', theme_before != theme_after, f'{theme_before} -> {theme_after}')
    run_command('theme')
    open_palette(); pg.get_by_role('combobox', name='Search commands').fill('zebra'); pg.wait_for_timeout(150)
    check('an unknown query says no matching commands', 'No matching commands' in palette.inner_text())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    before = n_nodes()
    pg.locator('.react-flow__node').first.dblclick(); pg.wait_for_timeout(250)
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(250)
    check('Ctrl+K does nothing while editing a card', palette.is_visible() is False)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    # القفز إلى مساحة أخرى: ننشئ ثانية ثم نعود إلى الأولى بالاسم
    pg.get_by_role('link', name='Workspaces').first.click(); pg.wait_for_selector('article')
    create_workspace('Second space')
    open_palette(); pg.get_by_role('combobox', name='Search commands').fill('quick'); pg.wait_for_timeout(150)
    opt = palette.get_by_role('option')
    check('other workspaces are listed by name, the current one is not', opt.count() == 1 and 'Open workspace: Quick wins' in opt.first.inner_text(), str([o.inner_text() for o in opt.all()]))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(700); pg.wait_for_selector('.react-flow')
    check('choosing a workspace opens it', n_nodes() >= 1 and pg.get_by_role('button', name=re.compile('Quick wins')).count() + pg.get_by_text('Quick wins').count() >= 1)

    # ───── ضغط الصور عند الإضافة ─────
    # صور الاختبار تُولَّد هنا (قاعدة المشروع: لا ملفات ثنائية في المستودع). صورة كبيرة بتدرج وضجيج خفيف تعطي JPEG
    # عدة ميغابايتات (أقل من حد 10MB)، وصغيرة بلا حاجة للضغط، وGIF متحرك من ثلاثة إطارات.
    IMG = os.path.join(TMP, 'images'); os.makedirs(IMG)
    w, h = 3600, 2400
    gradient = Image.merge('RGB', (
        Image.linear_gradient('L').rotate(90).resize((w, h)),
        Image.linear_gradient('L').resize((w, h)),
        Image.linear_gradient('L').rotate(45).resize((w, h)),
    ))
    noise = Image.effect_noise((w, h), 22).convert('RGB')
    Image.blend(gradient, ImageChops.add(gradient, noise, 1, -128), 0.9).save(f'{IMG}/big.jpg', quality=92)
    Image.blend(gradient, noise, 0.3).crop((0, 0, 300, 200)).save(f'{IMG}/small.png')
    frames = [Image.new('RGB', (60, 60), c) for c in ((30, 30, 30), (120, 120, 120), (220, 220, 220))]
    frames[0].save(f'{IMG}/anim.gif', save_all=True, append_images=frames[1:], duration=100, loop=0)
    def add_image(path, expected):
        with pg.expect_file_chooser() as chooser:
            pg.get_by_role('button', name=re.compile('Add image')).first.click()
        chooser.value.set_files(path)
        pg.wait_for_function('(n) => document.querySelectorAll(".react-flow__node img").length >= n', arg=expected, timeout=15000)
        pg.wait_for_timeout(400)
    def last_image_info():
        return pg.evaluate("""async () => {
            const imgs = [...document.querySelectorAll('.react-flow__node img')]
            const img = imgs[imgs.length - 1]
            await img.decode().catch(() => {})
            const blob = await fetch(img.src).then((r) => r.blob())
            return { type: blob.type, size: blob.size, width: img.naturalWidth, height: img.naturalHeight }
        }""")
    if os.path.getsize(f'{IMG}/big.jpg') > 400 * 1024:
        reset()
        big_size = os.path.getsize(f'{IMG}/big.jpg')
        add_image(f'{IMG}/big.jpg', 1); info = last_image_info()
        check('a huge photo is stored as WebP', info['type'] == 'image/webp', str(info))
        check('the stored photo is clearly smaller than the original file', info['size'] < big_size * 0.9, f"{info['size']} vs {big_size}")
        check('the stored photo is scaled to the 2560 px limit, ratio kept', info['width'] == 2560 and abs(info['height'] - 1707) <= 1, f"{info['width']}x{info['height']}")
        add_image(f'{IMG}/small.png', 2); info = last_image_info()
        check('a small picture is stored untouched', info['type'] == 'image/png' and info['width'] == 300 and info['size'] == os.path.getsize(f'{IMG}/small.png'), str(info))
        add_image(f'{IMG}/anim.gif', 3); info = last_image_info()
        check('an animated GIF is stored untouched so it keeps moving', info['type'] == 'image/gif' and info['size'] == os.path.getsize(f'{IMG}/anim.gif'), str(info))
        reset()
        run_command('keep original')
        reset()
        add_image(f'{IMG}/big.jpg', 1); info = last_image_info()
        check('with compression switched off the original file is kept', info['type'] == 'image/jpeg' and info['size'] == big_size and info['width'] == 3600, str(info))
        run_command('compress new images')
        reset()
        add_image(f'{IMG}/big.jpg', 1); info = last_image_info()
        check('switching compression back on from the palette compresses again', info['type'] == 'image/webp', str(info))
        reset()

    # ───── التصفية بالوسوم ─────
    def tag_selected(*tags):
        for t in tags:
            box = pg.get_by_placeholder('Add a tag, then press Enter'); box.fill(t); box.press('Enter'); pg.wait_for_timeout(150)
    reset()
    new_sticky(300, 300, 'Alpha'); new_sticky(700, 300, 'Beta'); new_sticky(1100, 300, 'Gamma')
    pg.mouse.click(*center(node('Alpha'))); pg.wait_for_timeout(200); tag_selected('design')
    pg.mouse.click(*center(node('Beta'))); pg.wait_for_timeout(200); tag_selected('Design', 'ideas')
    pg.mouse.click(*center(node('Gamma'))); pg.wait_for_timeout(200); tag_selected('later')
    pg.mouse.click(700, 700); pg.wait_for_timeout(200)  # يخرج التركيز من حقل الوسم، وإلا تُكتب c فيه
    pg.keyboard.press('c'); pg.mouse.click(*center(node('Alpha'))); pg.mouse.click(*center(node('Beta'))); pg.wait_for_timeout(250)
    pg.keyboard.press('c'); pg.mouse.click(*center(node('Beta'))); pg.mouse.click(*center(node('Gamma'))); pg.wait_for_timeout(250)  # الأداة تعود إلى التحديد بعد كل وصلة
    pg.keyboard.press('Escape'); pg.mouse.click(700, 700); pg.wait_for_timeout(200)
    check('setup: three tagged cards and two connections', n_nodes() == 3 and n_edges() == 2 and pg.locator('.react-flow__node button.tag-chip').count() >= 4, f'{n_nodes()} nodes, {n_edges()} edges')
    check('no filter is shown at first', pg.get_by_text('of 3 cards').count() == 0)
    dimmed = lambda t: node(t).evaluate("e => e.classList.contains('is-dimmed')")
    pg.mouse.click(*center(node('Gamma'))); pg.wait_for_timeout(200)
    node('Alpha').locator('button.tag-chip', has_text='#design').click(); pg.wait_for_timeout(350)
    check('clicking a tag shows how many cards match', pg.get_by_role('status').filter(has_text='of 3 cards').count() == 1, pg.locator('[role=status]').all_inner_texts().__str__())
    check('cards without the tag fade, matching ones stay', dimmed('Gamma') and not dimmed('Alpha') and not dimmed('Beta'))
    check('matching ignores letter case (Beta has Design, Alpha has design)', not dimmed('Beta') and not dimmed('Alpha'))
    check('only the connection that reaches a faded card fades', pg.locator('.react-flow__edge.is-dimmed').count() == 1 and n_edges() == 2)
    check('clicking a tag chip does not change which card is selected', 'Gamma' in pg.locator('.react-flow__node.selected').first.inner_text())
    pg.mouse.click(*center(node('Gamma'))); pg.wait_for_timeout(200)
    check('a faded card can still be selected (nothing is locked)', 'Gamma' in pg.locator('.react-flow__node.selected').first.inner_text())
    node('Alpha').locator('button.tag-chip', has_text='#design').click(); pg.wait_for_timeout(350)
    check('clicking the same tag again shows everything', not dimmed('Gamma') and pg.get_by_text('of 3 cards').count() == 0)
    run_command('only #design')
    check('the palette can filter by tag too', pg.get_by_text('of 3 cards').count() == 1 and dimmed('Gamma'))
    pg.mouse.click(*center(node('Alpha'))); pg.wait_for_timeout(200)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    check('Escape first clears the selection and keeps the filter', pg.locator('.react-flow__node.selected').count() == 0 and pg.get_by_text('of 3 cards').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('Escape again clears the filter', pg.get_by_text('of 3 cards').count() == 0 and not dimmed('Gamma'))
    node('Gamma').locator('button.tag-chip', has_text='#later').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Show all cards (Esc)').click(); pg.wait_for_timeout(300)
    check('the pill button clears the filter', pg.get_by_text('of 3 cards').count() == 0 and not dimmed('Alpha'))
    node('Gamma').locator('button.tag-chip', has_text='#later').click(); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(800)
    check('the filter is a view setting: it is not saved with the workspace', pg.get_by_text('of 3 cards').count() == 0 and not dimmed('Alpha'))
    check('the tags themselves are saved', node('Gamma').locator('button.tag-chip', has_text='#later').count() == 1)

    unexpected = [l for l in logs if 'Content Security Policy' not in l[1]]
    check('no unexpected console or page errors', not unexpected, str(unexpected[:3]))
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f'\n{passed}/{len(results)} checks passed  (temp: {TMP})')
sys.exit(0 if passed == len(results) else 1)
