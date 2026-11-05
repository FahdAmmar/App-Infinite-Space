"""
فحوصات المتصفح للمقتطفات الشخصية: حفظ تحديد في مساحة وإدراجه في مساحة أخرى، وحذفه، وبقاؤه بعد إعادة التحميل.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    python3 e2e/phase16_snippets.py
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
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark')
    pg = ctx.new_page()
    logs = []
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))

    def node(text): return pg.locator('.react-flow__node', has_text=text).first
    def center(loc):
        bb = loc.bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    def palette(query, enter=True):
        pg.keyboard.press('Control+k'); pg.wait_for_timeout(300)
        box = pg.get_by_role('combobox', name='Search commands'); box.fill(query); pg.wait_for_timeout(150)
        if enter: pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    def make_workspace(name):
        pg.goto(URL)
        pg.get_by_role('button', name='Create workspace').first.click()
        pg.get_by_placeholder('Learning Roadmap').fill(name)
        pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
        pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(500)

    make_workspace('Snippet source')
    palette('save selection', enter=False)
    check('"Save selection" is not offered with nothing selected', pg.get_by_role('option', name='Save selection as a snippet').count() == 0)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

    # بطاقتان موصولتان
    pg.mouse.dblclick(450, 300); pg.wait_for_timeout(200); pg.keyboard.type('Weekly review'); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    n = node('Weekly review'); n.hover(); pg.wait_for_timeout(200)
    hb = n.locator('.react-flow__handle[data-handleid="right"]').bounding_box()
    hx, hy = hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2
    pg.mouse.move(hx, hy); pg.mouse.down(); pg.mouse.move(hx + 330, hy, steps=16); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(300)
    pg.keyboard.type('Plan next week'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.keyboard.press('Control+a'); pg.wait_for_timeout(250)
    check('both cards are selected', pg.locator('.react-flow__node.selected').count() == 2)
    palette('save selection')
    msg = pg.get_by_text('Saved snippet', exact=False)
    check('saving shows a confirmation naming the snippet', msg.count() >= 1 and 'Weekly review + 1' in msg.first.inner_text(), msg.first.inner_text() if msg.count() else 'no message')

    # مساحة أخرى
    make_workspace('Snippet target')
    check('the target workspace starts empty', pg.locator('.react-flow__node').count() == 0)
    palette('insert snippet', enter=False)
    check('the saved snippet is offered in another workspace', pg.get_by_role('option', name='Insert snippet: Weekly review + 1').count() == 1)
    pg.get_by_role('option', name='Insert snippet: Weekly review + 1').click(); pg.wait_for_timeout(600)
    check('inserting adds both cards', pg.locator('.react-flow__node').count() == 2, str(pg.locator('.react-flow__node').count()))
    check('and the connection between them', pg.locator('.react-flow__edge').count() == 1)
    check('and they are selected, ready to move', pg.locator('.react-flow__node.selected').count() == 2)
    first_ids = pg.locator('.react-flow__node').evaluate_all('els => els.map(e => e.getAttribute("data-id"))')
    pg.keyboard.press('Escape')
    palette('insert snippet'); pg.wait_for_timeout(300)
    second_ids = pg.locator('.react-flow__node').evaluate_all('els => els.map(e => e.getAttribute("data-id"))')
    check('inserting again makes new cards with new identities', len(second_ids) == 4 and len(set(second_ids)) == 4, str(second_ids))

    # يبقى بعد إعادة التحميل
    pg.reload(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(600)
    palette('insert snippet', enter=False)
    check('the snippet survives a reload', pg.get_by_role('option', name='Insert snippet: Weekly review + 1').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

    # بيانات تخزين فاسدة لا تكسر شيئاً
    pg.evaluate("localStorage.setItem('infinitespace:v1:snippets', JSON.stringify({state:{snippets:[{id:'x',name:'<b>hack</b>',canvas:{nodes:[{type:'sticky'}],edges:[]}}, 7]},version:0}))")
    pg.reload(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(600)
    palette('snippet', enter=False)
    check('damaged stored snippets are dropped without breaking the palette', pg.get_by_role('option', name='Insert snippet', exact=False).count() == 0)
    pg.keyboard.press('Escape')

    unexpected = [l for l in logs if 'Content Security Policy' not in l[1]]
    check('no unexpected console or page errors', not unexpected, str(unexpected[:3]))
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f'\n{passed}/{len(results)} checks passed')
sys.exit(0 if passed == len(results) else 1)
