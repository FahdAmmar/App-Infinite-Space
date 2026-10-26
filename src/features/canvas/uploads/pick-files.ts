/**
 * يفتح نافذة اختيار الملفات ويعيد ما اختاره المستخدم (مصفوفة فارغة عند الإلغاء).
 * ننشئ حقل الإدخال مؤقتاً بدل إبقائه في الشجرة: لا حالة إضافية ولا مرجع لتمريره بين المكوّنات.
 * يجب استدعاؤه من داخل حدث نقر/ضغط مفتاح مباشر وإلا منعه المتصفح.
 */
export function pickFiles(options: { accept: string; multiple: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = options.accept
    input.multiple = options.multiple
    input.addEventListener('change', () => resolve(Array.from(input.files ?? [])), { once: true })
    // حدث cancel مدعوم في المتصفحات الحديثة؛ بدونه يبقى الوعد معلقاً دون أذى (لا موارد محجوزة)
    input.addEventListener('cancel', () => resolve([]), { once: true })
    input.click()
  })
}
