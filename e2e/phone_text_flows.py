"""
فحوصات المتصفح للهاتف والنصوص الطويلة والعربية: بطاقة بالعرض الصحيح، حقول بخط 16px على اللمس،
عدم تحميل مشهد Three.js على الهاتف، ظهور بداية الاسم العربي عند القص، ومساحة أوسع لعنوان المحرر.

التشغيل:
    npm run build && npx vite preview --port 4173 &
    python3 e2e/phone_text_flows.py
"""
import os, sys
from playwright.sync_api import sync_playwright
from _common import patch_browser, open_add_menu

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
results = []
LATIN = 'Quarterly planning for the next product launch and roadmap'[:60]
ARABIC = 'مساحة عمل لتخطيط المشروع الكبير والأفكار المتفرعة '[:60]


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


# أول حرف في النص يجب أن يقع داخل الصندوق الذي يقصّ المحتوى فعلاً (أقرب سلف overflow:hidden)، وإلا اختفت بداية الاسم
FIRST_CHAR_VISIBLE = """el => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t = w.nextNode(); while (t && !t.textContent.trim()) t = w.nextNode();
  if (!t) return { ok: false, width: 0 };
  let clip = el; while (clip && getComputedStyle(clip).overflowX !== 'hidden') clip = clip.parentElement;
  if (!clip) clip = el;
  const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 1);
  const a = r.getBoundingClientRect(), b = clip.getBoundingClientRect();
  return { ok: a.width > 0 && a.left >= b.left - 1 && a.right <= b.right + 1, width: Math.round(clip.clientWidth) } }"""
VISIBLE_FIELD_SIZES = """() => [...document.querySelectorAll('input,textarea,select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8
  && !['checkbox', 'radio', 'range', 'color', 'file'].includes(e.type) }).map(e => ({ label: (e.getAttribute('aria-label') || e.placeholder || e.tagName).slice(0, 24), size: parseFloat(getComputedStyle(e).fontSize) }))"""
CARD_BOX = "() => { const r = document.querySelector('article').getBoundingClientRect(); return { right: Math.round(r.right), width: Math.round(r.width), vw: innerWidth, sw: document.documentElement.scrollWidth } }"


def create_workspace(pg, name):
    pg.goto(URL)
    pg.get_by_role('button', name='Create workspace').first.click(); pg.wait_for_timeout(500)  # انتقال دخول النافذة
    pg.get_by_placeholder('Learning Roadmap').fill(name); pg.wait_for_timeout(500)
    pg.get_by_placeholder('Learning Roadmap').press('Enter')  # إرسال بلوحة المفاتيح: لا يعتمد على موضع الزر داخل النافذة
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(700)


with sync_playwright() as p:
    browser = patch_browser(p.chromium.launch())
    logs = []

    def phone(width):
        ctx = browser.new_context(viewport={'width': width, 'height': 844}, has_touch=True, is_mobile=True, color_scheme='dark')
        pg = ctx.new_page()
        pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
        return ctx, pg

    # ---- هاتف 390: بطاقة الاسم الطويل وتحميل المشهد وعنوان المحرر وحقول الكتابة
    ctx, pg = phone(390)
    requests = []
    pg.on('request', lambda r: requests.append(r.url))
    for name in (LATIN, ARABIC):
        create_workspace(pg, name)
        if name == ARABIC:
            title = pg.locator('header button[title="Rename workspace"]').first.evaluate(FIRST_CHAR_VISIBLE)
            check('390px: the editor title keeps the beginning of a long Arabic name visible', title['ok'], str(title))
            check('390px: the editor title gets at least 60px of text room', title['width'] >= 60, str(title))
    pg.goto(URL); pg.wait_for_selector('article'); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(1200)
    boxes = pg.evaluate("() => [...document.querySelectorAll('article')].map(a => { const r = a.getBoundingClientRect(); return { right: Math.round(r.right), width: Math.round(r.width) } })")
    meta = pg.evaluate("() => ({ vw: innerWidth, sw: document.documentElement.scrollWidth })")
    check('390px: every workspace card with a 60-character name fits the screen', len(boxes) == 2 and all(b['right'] <= 390 for b in boxes), str(boxes))
    check('390px: the page does not grow wider than the phone', meta['vw'] == 390 and meta['sw'] <= 390, str(meta))
    names = pg.locator('article h3')
    seen = [names.nth(i).evaluate(FIRST_CHAR_VISIBLE) for i in range(names.count())]
    check('390px: each card name keeps its beginning visible when truncated', len(seen) == 2 and all(x['ok'] for x in seen), str(seen))
    check('390px: the decorative 3D scene is never downloaded on a phone', not any('createBackgroundScene' in u for u in requests))

    pg.get_by_role('button', name='Create workspace').first.click(); pg.wait_for_timeout(500)
    dialog_fields = pg.evaluate(VISIBLE_FIELD_SIZES)
    check('touch: the create-workspace fields are at least 16px (no iOS zoom on focus)', dialog_fields and all(f['size'] >= 16 for f in dialog_fields), str(dialog_fields))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)

    pg.get_by_role('link', name=ARABIC.strip(), exact=False).first.click(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(900)
    surfaces = {}
    pg.keyboard.press('Control+f'); pg.wait_for_timeout(400); surfaces['find bar'] = pg.evaluate(VISIBLE_FIELD_SIZES); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(400); surfaces['command palette'] = pg.evaluate(VISIBLE_FIELD_SIZES); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    pg.locator('header button[title="Rename workspace"]').click(); pg.wait_for_timeout(400); surfaces['title edit'] = pg.evaluate(VISIBLE_FIELD_SIZES); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    open_add_menu(pg); pg.get_by_role('button', name='Sticky note', exact=True).click(); pg.mouse.click(190, 420); pg.wait_for_timeout(700); surfaces['card editor'] = pg.evaluate(VISIBLE_FIELD_SIZES)
    for surface, fields in surfaces.items():
        check(f'touch: the {surface} fields are at least 16px', fields and all(f['size'] >= 16 for f in fields), str(fields))
    ctx.close()

    # ---- هاتف 320: أضيق شاشة مدعومة
    ctx, pg = phone(320)
    create_workspace(pg, LATIN)
    pg.goto(URL); pg.wait_for_selector('article'); pg.wait_for_timeout(1000)
    box = pg.evaluate(CARD_BOX)
    check('320px: a card with a 60-character name fits the screen', box['right'] <= 320 and box['vw'] == 320 and box['sw'] <= 320, str(box))
    ctx.close()

    # ---- سطح المكتب: المشهد ما زال يُحمَّل ويظهر، ولا تتغير الحقول على الفأرة
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark'); pg = ctx.new_page()
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    desktop_requests = []
    pg.on('request', lambda r: desktop_requests.append(r.url))
    pg.goto(URL); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(1500)
    check('1440px: the decorative 3D scene is still loaded and drawn on desktop',
          any('createBackgroundScene' in u for u in desktop_requests) and pg.locator('[data-effect="running"]').count() == 1)
    pg.get_by_role('button', name='Create workspace').first.click(); pg.wait_for_timeout(400)
    desktop_fields = pg.evaluate(VISIBLE_FIELD_SIZES)
    check('1440px: fields keep their compact size with a mouse (the 16px rule is touch-only)', desktop_fields and any(f['size'] < 16 for f in desktop_fields), str(desktop_fields))
    ctx.close()

    unexpected = [l for l in logs if 'Content Security Policy' not in l[1]]
    check('no unexpected console or page errors', not unexpected, str(unexpected[:3]))
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f'\n{passed}/{len(results)} checks passed')
sys.exit(0 if passed == len(results) else 1)
