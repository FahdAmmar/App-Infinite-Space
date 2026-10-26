"""
فحوصات المتصفح لمرحلة التلميع (Magic UI، GSAP، Three.js الاختياري، الاستجابة وإمكانية الوصول).

التشغيل:
    npm run build && npx vite preview --port 4173 &
    pip install playwright pillow && playwright install chromium
    python3 e2e/phase5_polish.py            # أو BASE_URL=http://127.0.0.1:5173/ للتطوير

يغطي: دورة حياة مشهد Three.js (يعمل، يرسم فعلاً، يُوقف ويُحرَّر، لا يدخل المحرر، يتوقف مع إخفاء التبويب)،
تفضيل تقليل الحركة، تأثيرات Magic UI وحركات GSAP (وأنها لا تترك أنماطاً مضمّنة ولا تخل بالتموضع)،
التنقل بلوحة المفاتيح (رابط التخطي، التركيز المرئي، العقد)، التخطيط عند أربعة أحجام شاشة،
أهداف اللمس، وaxe-core. يعتمد على Pillow لمقارنة اللقطات (pip install pillow).
يخرج برمز 1 عند أي فشل أو خطأ في الـ console (تحذيرات WebGL البرمجية في Chromium بلا واجهة لا تُعدّ أخطاء).
"""
import io, os, sys, tempfile
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4173/')
AXE = os.environ.get('AXE_PATH', '')  # مسار axe.min.js (اختياري): بدونه تُتجاوز فحوصات axe
SHOTS = os.path.join(tempfile.mkdtemp(prefix='infinitespace-e2e5-'), 'shots'); os.makedirs(SHOTS)
results = []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))

# عدّاد requestAnimationFrame وأدنى شفافية لعناصر الدخول (لقياس الحركة دون الاعتماد على التوقيت الدقيق للقطات)
INIT = """
window.__raf = 0;
const _raf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (cb) => { window.__raf++; return _raf(cb) };
window.__minOpacity = 1;
setInterval(() => {
  for (const el of document.querySelectorAll('[data-reveal="top"],[data-reveal="left"],[data-reveal="bottom"],[data-reveal="card"]')) {
    const o = parseFloat(getComputedStyle(el).opacity); if (o < window.__minOpacity) window.__minOpacity = o;
  }
}, 16);
"""

def audit(page, label):
    if not AXE:
        return
    if page.evaluate("typeof window.axe") != 'object':
        page.add_script_tag(path=AXE)
    res = page.evaluate("""async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }); return r.violations.map(v => v.id + ': ' + v.nodes.slice(0,2).map(n => n.target.join(' ')).join(' | ')) }""")
    check(f'axe: {label}', not res, '; '.join(res))

def new_workspace(pg, name):
    pg.goto(URL); pg.get_by_role('button', name='Create workspace').first.click()
    pg.get_by_placeholder('Learning Roadmap').fill(name); pg.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    pg.wait_for_url('**/w/**'); pg.wait_for_selector('.react-flow')

def sticky(pg, x, y, text):
    pg.mouse.move(x, y); pg.mouse.dblclick(x, y); pg.wait_for_timeout(120); pg.keyboard.type(text); pg.keyboard.press('Escape'); pg.wait_for_timeout(150); pg.mouse.click(980, 200)

def clip_image(pg, selector):
    box = pg.locator(selector).bounding_box()
    return Image.open(io.BytesIO(pg.screenshot(clip=box))).convert('RGB')

def diff_pixels(a, b):
    d = ImageChops.difference(a, b).convert('L')
    return sum(1 for v in d.getdata() if v > 12)

with sync_playwright() as p:
    browser = p.chromium.launch()
    logs = []
    def watch(page):
        page.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
        page.on('pageerror', lambda e: logs.append(('pageerror', str(e))))

    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark')
    ctx.add_init_script(INIT)
    pg = ctx.new_page(); watch(pg)
    requests = []
    pg.on('request', lambda r: requests.append(r.url))

    # ───────────── لوحة تحكم فارغة: Border Beam ─────────────
    pg.goto(URL); pg.wait_for_selector('text=Create your first workspace', timeout=8000) if pg.get_by_text('Create your first workspace').count() else pg.wait_for_timeout(800)
    supports = pg.evaluate("CSS.supports('offset-path', 'rect(0 auto auto 0)')")
    beam = pg.locator('.border-beam-frame')
    if pg.locator('.border-beam').count():
        shown = beam.first.evaluate("e => getComputedStyle(e).display") != 'none'
        check('the empty state shows a border beam where offset-path is supported (hidden otherwise)', shown == supports, f'supports={supports} shown={shown}')
        if supports:
            check('the beam animates on the compositor (CSS offset-distance keyframes)', pg.locator('.border-beam').first.evaluate("e => getComputedStyle(e).animationName") == 'border-beam')
    else:
        check('the empty state renders a border beam element', False, 'not found')

    # ───────────── Three.js ─────────────
    new_workspace(pg, 'Fx test')
    pg.goto(URL); pg.wait_for_selector('[data-effect="running"]', timeout=8000); pg.wait_for_timeout(600)
    container = pg.locator('[data-effect="running"]')
    check('the background effect starts: exactly one canvas inside its container', container.locator('canvas').count() == 1 and pg.locator('canvas').count() == 1)
    check('the effect never takes pointer input and is hidden from assistive technology',
          container.evaluate("e => getComputedStyle(e).pointerEvents") == 'none' and container.get_attribute('aria-hidden') == 'true')
    cb = container.locator('canvas').bounding_box()
    check('the canvas has a real size', cb['width'] > 150 and cb['height'] > 150, str(cb))
    on_img = clip_image(pg, '[data-effect="running"]')
    toggle = pg.get_by_role('button', name='Turn off background effect')
    check('the toggle reports the effect as on', toggle.get_attribute('aria-pressed') == 'true')
    toggle.click(); pg.wait_for_timeout(500)
    check('turning it off removes the canvas and frees the scene', pg.locator('canvas').count() == 0 and pg.locator('[data-effect]').count() == 0)
    off_img = clip_image(pg, '.pointer-events-none.select-none') if pg.locator('.pointer-events-none.select-none').count() else None
    check('the toggle label and state update', pg.get_by_role('button', name='Turn on background effect').get_attribute('aria-pressed') == 'false')
    if off_img is not None and on_img.size == off_img.size:
        check('the WebGL canvas actually paints visible pixels (differs from the same area without it)', diff_pixels(on_img, off_img) > 150, str(diff_pixels(on_img, off_img)))
    pg.reload(); pg.wait_for_timeout(1500)
    check('the preference to keep it off survives a reload (no canvas)', pg.locator('canvas').count() == 0)
    pg.get_by_role('button', name='Turn on background effect').click(); pg.wait_for_selector('[data-effect="running"]', timeout=8000)
    check('turning it back on restarts it', pg.locator('canvas').count() == 1)

    # يتوقف عند إخفاء التبويب
    pg.wait_for_timeout(2500)
    before = pg.evaluate('window.__raf'); pg.wait_for_timeout(500); running_rate = pg.evaluate('window.__raf') - before
    pg.evaluate("Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(300)
    before = pg.evaluate('window.__raf'); pg.wait_for_timeout(500); hidden_rate = pg.evaluate('window.__raf') - before
    pg.evaluate("delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(300)
    before = pg.evaluate('window.__raf'); pg.wait_for_timeout(500); resumed_rate = pg.evaluate('window.__raf') - before
    check('rendering stops while the tab is hidden and resumes when visible', running_rate > 10 and hidden_rate <= 2 and resumed_rate > 10, f'{running_rate}/{hidden_rate}/{resumed_rate}')

    # تبديل السمة لا يعيد بناء المشهد
    pg.get_by_role('button', name='Switch to light theme').click(); pg.wait_for_timeout(500)
    check('switching theme keeps the same running scene', pg.locator('[data-effect="running"] canvas').count() == 1)
    audit(pg, 'dashboard with effect (light)')
    pg.screenshot(path=SHOTS + '/dashboard-light-effect.png')
    pg.get_by_role('button', name='Switch to dark theme').click(); pg.wait_for_timeout(300)
    audit(pg, 'dashboard with effect (dark)')

    # ───────────── Magic Card ─────────────
    card = pg.locator('article').first
    cbx = card.bounding_box()
    pg.mouse.move(cbx['x'] + cbx['width'] * 0.3, cbx['y'] + cbx['height'] * 0.4, steps=4); pg.wait_for_timeout(450)
    spot = card.evaluate("e => [e.style.getPropertyValue('--spot-x'), e.style.getPropertyValue('--spot-y')]")
    check('hovering a card writes the spotlight position', spot[0].endswith('px') and spot[1].endswith('px'), str(spot))
    check('the spotlight layer fades in on hover', card.evaluate("e => getComputedStyle(e, '::before').opacity") == '1')
    pg.mouse.move(5, 5); pg.wait_for_timeout(450)
    check('and fades out when the pointer leaves', card.evaluate("e => getComputedStyle(e, '::before').opacity") == '0')

    # نسخ المساحة: البطاقة الجديدة تدخل بحركة
    pg.get_by_role('button', name='Actions for Fx test').click(); pg.get_by_role('menuitem', name='Duplicate').click()
    pg.wait_for_selector('text=Fx test (copy)'); pg.wait_for_timeout(1400)
    check('animations leave no inline styles behind on the dashboard cards', pg.evaluate("[...document.querySelectorAll('[data-workspace-id]')].every(e => !/opacity|transform/.test(e.getAttribute('style') || ''))"))

    # ───────────── دخول المحرر (GSAP) ─────────────
    pg.evaluate('window.__minOpacity = 1')
    pg.get_by_role('link', name='Fx test (copy)').first.click(); pg.wait_for_selector('.react-flow'); pg.wait_for_timeout(1500)
    check('editor chrome fades in on entry (opacity starts below 1)', pg.evaluate('window.__minOpacity') < 0.9, str(pg.evaluate('window.__minOpacity')))
    left = pg.evaluate("[...document.querySelectorAll('[data-reveal]')].map(e => e.getAttribute('style') || '')")
    check('and GSAP clears its inline styles afterwards (CSS positioning stays in charge)', all(not ('opacity' in s or 'transform' in s) for s in left), str(left))
    dock = pg.locator('[role="toolbar"][aria-label="Add to canvas"]').bounding_box()
    check('the bottom dock is still exactly centered after the entry animation', abs((dock['x'] + dock['width'] / 2) - 720) < 2, str(dock))

    # حفظ + نبضة التأكيد لا تترك أثراً
    sticky(pg, 400, 300, 'Hello'); pg.wait_for_function("() => /^Saved/.test(document.querySelector('header [role=status]').innerText.trim())", timeout=8000); pg.wait_for_timeout(800)
    check('the saved check icon is left without inline animation styles', pg.evaluate("(document.querySelector('header [role=status] svg').getAttribute('style') || '') === ''"))

    # ───────────── لوحة المفاتيح ─────────────
    pg.reload(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(1200)
    pg.keyboard.press('Tab')  # بلا نقر قبلها: كما يفعل من يفتح الصفحة ويبدأ بلوحة المفاتيح
    skip = pg.get_by_role('link', name='Skip to canvas')
    sb = skip.bounding_box()
    check('the first Tab stop is a visible "Skip to canvas" link', skip.evaluate("e => document.activeElement === e") and sb is not None and sb['width'] > 60 and 0 <= sb['y'] < 100, str(sb))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    check('activating it moves focus to the canvas without changing the URL', pg.evaluate("document.activeElement && document.activeElement.id") == 'canvas-main' and '#' not in pg.url)

    focused_node = False
    for _ in range(60):
        pg.keyboard.press('Tab')
        if pg.evaluate("!!document.activeElement && document.activeElement.classList.contains('react-flow__node')"):
            focused_node = True; break
    check('a card can be reached with the Tab key', focused_node)
    ring = pg.evaluate("(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth] })()")
    check('the focused card shows a visible focus ring', ring[0] != 'none' and ring[1] not in ('0px', ''), str(ring))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check('Enter selects it and opens the properties panel', 'selected' in (pg.evaluate("document.activeElement.className") or '') and pg.locator('aside[aria-label="Properties"]').count() == 1)
    node_before = pg.locator('.react-flow__node').first.bounding_box()
    for _ in range(4): pg.keyboard.press('ArrowRight')
    pg.wait_for_timeout(250)
    node_after = pg.locator('.react-flow__node').first.bounding_box()
    check('the arrow keys move the selected card', node_after['x'] > node_before['x'] + 3, f"{node_before['x']} -> {node_after['x']}")
    pg.keyboard.press('Delete'); pg.wait_for_timeout(250)
    check('Delete removes it, and Ctrl+Z brings it back', pg.locator('.react-flow__node').count() == 0 and (pg.keyboard.press('Control+z') or True) and pg.wait_for_timeout(250) is None and pg.locator('.react-flow__node').count() == 1)

    # مؤشر التركيز لكل عناصر الواجهة التي تُبلغ بـ Tab (لوحة التحكم)
    def focus_audit(label, max_tabs=60):
        bad = []
        pg.evaluate('document.activeElement && document.activeElement.blur()')
        for _ in range(max_tabs):
            pg.keyboard.press('Tab')
            info = pg.evaluate("""(() => { const e = document.activeElement; if (!e || e === document.body) return null
                const f = getComputedStyle(e); const focused = [f.outlineStyle, f.outlineWidth, f.boxShadow, f.borderTopColor]
                // عناصر داخل بطاقة قد يظهر مؤشرها على البطاقة نفسها (has-[a:focus-visible])
                const host = e.closest('article'); const hostRing = host ? getComputedStyle(host) : null
                const ancestorRing = !!hostRing && hostRing.outlineStyle !== 'none' && hostRing.outlineWidth !== '0px'
                e.blur(); const b = getComputedStyle(e); const plain = [b.outlineStyle, b.outlineWidth, b.boxShadow, b.borderTopColor]; e.focus({ focusVisible: true })
                const visible = (focused[0] !== 'none' && focused[1] !== '0px') || focused[2] !== plain[2] || focused[3] !== plain[3] || ancestorRing
                return { tag: e.tagName.toLowerCase(), name: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), visible } })()""")
            if info is None: break
            if not info['visible']: bad.append(f"{info['tag']}:{info['name']}")
        check(f'every keyboard stop shows a focus indicator ({label})', not bad, ', '.join(bad))
    pg.goto(URL); pg.wait_for_selector('article'); focus_audit('dashboard')
    pg.get_by_role('link', name='Fx test (copy)').first.click(); pg.wait_for_selector('.react-flow__node'); pg.wait_for_timeout(900)
    pg.mouse.click(980, 200); focus_audit('editor', 40)

    # ───────────── تقليل الحركة ─────────────
    rctx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark', reduced_motion='reduce'); rctx.add_init_script(INIT)
    rp = rctx.new_page(); watch(rp)
    rp.goto(URL); rp.wait_for_timeout(1500)
    check('reduced motion: dashboard content is fully visible immediately (no entrance animation)', rp.evaluate('window.__minOpacity') == 1, str(rp.evaluate('window.__minOpacity')))
    check('reduced motion: the border beam is hidden', rp.locator('.border-beam-frame').count() == 0 or rp.locator('.border-beam-frame').first.evaluate("e => getComputedStyle(e).display") == 'none')
    new_workspace(rp, 'Calm'); rp.goto(URL); rp.wait_for_selector('article'); rp.wait_for_timeout(1200)
    check('reduced motion: no WebGL canvas is created', rp.locator('canvas').count() == 0 and rp.locator('[data-effect]').count() == 0)
    tg = rp.locator('button[aria-label*="reduced motion"]')
    check('reduced motion: the toggle is disabled and explains why', tg.count() == 1 and tg.is_disabled())
    rp.get_by_role('link', name='Calm').first.click(); rp.wait_for_selector('.react-flow'); rp.wait_for_timeout(300)
    check('reduced motion: the editor appears without an entrance animation', rp.evaluate('window.__minOpacity') == 1)
    rctx.close()

    # ───────────── المحرر لا يحمّل Three.js ─────────────
    ectx = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark')
    ep = ectx.new_page(); watch(ep); ereq = []; ep.on('request', lambda r: ereq.append(r.url))
    ep.goto(URL); ep.get_by_role('button', name='Create workspace').first.click(); ep.get_by_placeholder('Learning Roadmap').fill('Direct'); ep.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    ep.wait_for_url('**/w/**'); ep.wait_for_selector('.react-flow'); wid = ep.url
    ereq.clear(); ep.goto(wid); ep.wait_for_selector('.react-flow'); ep.wait_for_timeout(1200)
    check('opening the editor directly never downloads the Three.js chunk', not any('createBackgroundScene' in u for u in ereq), str([u for u in ereq if 'createBackgroundScene' in u]))
    check('and the editor has no WebGL canvas', ep.locator('canvas').count() == 0)
    ectx.close()

    # ───────────── أحجام الشاشة ─────────────
    rctx2 = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark'); rp2 = rctx2.new_page(); watch(rp2)
    new_workspace(rp2, 'Sizes')
    sticky(rp2, 500, 300, 'One'); sticky(rp2, 800, 420, 'Two')
    rp2.wait_for_function("() => /^Saved/.test(document.querySelector('header [role=status]').innerText.trim())", timeout=8000)
    editor_url = rp2.url
    def inter(a, b): return not (a['x'] + a['width'] <= b['x'] or b['x'] + b['width'] <= a['x'] or a['y'] + a['height'] <= b['y'] or b['y'] + b['height'] <= a['y'])
    for w, h in ((390, 844), (768, 1024), (1024, 768), (1440, 900)):
        rp2.set_viewport_size({'width': w, 'height': h}); rp2.goto(URL); rp2.wait_for_selector('article'); rp2.wait_for_timeout(900)
        over = rp2.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        check(f'{w}px dashboard: no horizontal overflow', over <= 1, str(over))
        rp2.screenshot(path=SHOTS + f'/dashboard-{w}.png')
        rp2.goto(editor_url); rp2.wait_for_selector('.react-flow__node'); rp2.wait_for_timeout(900)
        over = rp2.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        dock = rp2.locator('[role="toolbar"][aria-label="Add to canvas"]').bounding_box(); zoom = rp2.locator('[role="toolbar"][aria-label="Zoom and view"]').bounding_box()
        tools = rp2.locator('[role="toolbar"][aria-label="Canvas tools"]').bounding_box()
        groups = [g.bounding_box() for g in rp2.locator('[data-reveal="top"]').all()]
        inside = all(b['x'] >= -1 and b['x'] + b['width'] <= w + 1 and b['y'] >= -1 and b['y'] + b['height'] <= h + 1 for b in (dock, zoom, tools) + tuple(groups))
        check(f'{w}px editor: no overflow, chrome inside the viewport', over <= 1 and inside, f'over={over}')
        check(f'{w}px editor: the dock, zoom cluster and tool rail never overlap', not inter(dock, zoom) and not inter(dock, tools) and not inter(zoom, tools), f'{dock} {zoom} {tools}')
        check(f'{w}px editor: top-bar groups do not overlap', len(groups) < 2 or not inter(groups[0], groups[1]), str(groups))
        rp2.mouse.click(w // 2, h // 3); rp2.wait_for_timeout(100)
        rp2.locator('.react-flow__node').first.click(); rp2.wait_for_timeout(300)
        panel = rp2.locator('aside[aria-label="Properties"]')
        if panel.count():
            if w < 1024 and panel.get_by_role('button', name='Expand properties').count():  # تبدأ مطويّة تحت 1024px
                panel.get_by_role('button', name='Expand properties').click(); rp2.wait_for_timeout(200)
            pb = panel.bounding_box()
            check(f'{w}px editor: the properties panel stays inside the viewport and clear of the dock', pb['x'] >= -1 and pb['x'] + pb['width'] <= w + 1 and pb['y'] >= -1 and not inter(pb, dock), f'{pb} {dock}')
        else:
            check(f'{w}px editor: the properties panel opens for a selected card', False)
        rp2.screenshot(path=SHOTS + f'/editor-{w}.png')
        audit(rp2, f'editor at {w}px with the panel open')
    rctx2.close()

    # ───────────── جهاز لمس ─────────────
    tctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, color_scheme='dark', device_scale_factor=2)
    tp = tctx.new_page(); watch(tp)
    tp.goto(URL); tp.get_by_role('button', name='Create workspace').first.click(); tp.get_by_placeholder('Learning Roadmap').fill('Touch'); tp.locator('dialog[open]').get_by_role('button', name='Create workspace').click()
    tp.wait_for_url('**/w/**'); tp.wait_for_selector('.react-flow'); tp.wait_for_timeout(900)
    check('touch device is detected as a coarse pointer', tp.evaluate("matchMedia('(pointer: coarse)').matches"))
    small = tp.evaluate("""[...document.querySelectorAll('button:not([data-compact]), [role=menuitem]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5) }).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28))""")
    check('every ordinary button is at least 44x44 px on touch', not small, ', '.join(small))
    tp.get_by_role('button', name='Sticky note', exact=True).tap(); tp.touchscreen.tap(195, 420); tp.wait_for_timeout(200); tp.keyboard.press('Escape'); tp.wait_for_timeout(300)
    handle = tp.evaluate("(() => { const h = document.querySelector('.connect-handle'); if (!h) return null; const r = h.getBoundingClientRect(); return [r.width, r.height] })()")
    check('connection dots are larger on touch screens', handle is not None and handle[0] >= 18, str(handle))
    tctx.close()
    browser.close()

bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)}/{len(results)} passed; console errors: {logs}; screenshots: {SHOTS}')
sys.exit(1 if bad or logs else 0)
