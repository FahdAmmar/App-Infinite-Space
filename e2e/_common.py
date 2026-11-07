"""
مساعدات مشتركة لسكربتات e2e القديمة. تعزل كل سكربت عن ميزتين أُضيفتا لاحقاً:
  1. خدمة العمل (PWA): تعترض الطلبات فلا تعمل route() لـ Playwright على ملفات الحزمة. نحجبها هنا، ويفحصها phase17_ux.py وحده.
  2. تعطيل المشهد الزخرفي على الأجهزة الضعيفة: المتصفح بلا واجهة يبلّغ أحياناً عن نواة واحدة فيُعدّ جهازاً ضعيفاً،
     فنثبّت عدد الأنوية كي تبقى فحوصات المشهد (data-effect) قابلة للتشغيل في أي جهاز.
"""

HARDWARE = "Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8})"


def patch_browser(browser):
    original = browser.new_context

    def new_context(*args, **kwargs):
        kwargs.setdefault('service_workers', 'block')
        context = original(*args, **kwargs)
        context.add_init_script(HARDWARE)
        return context

    browser.new_context = new_context
    return browser


def open_add_menu(page):
    """على الشاشات الضيقة (أقل من 900px) تختبئ أدوات الإضافة خلف زر «+»؛ نفتح القائمة إن وُجد الزر ولا شيء على الشاشات الأكبر."""
    button = page.get_by_role('button', name='Open add menu')
    if button.count():
        button.tap() if page.evaluate("matchMedia('(pointer: coarse)').matches") else button.click()
        page.wait_for_timeout(250)
