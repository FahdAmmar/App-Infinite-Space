/**
 * ترميز Base64 للـ Blob وفكّه. نستخدم FileReader (لا خدعة تجميع نص ضخم بـ String.fromCharCode)
 * لأن صوراً حتى 10MB تمر هنا وتجميع الأحرف يدوياً قد يتجاوز حدّ المكدّس.
 */

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/

/** نص Base64 قياسي صحيح الشكل (الطول مضاعف 4 وأحرف مسموحة فقط). لا يتحقق من أن المحتوى صورة. */
export function isBase64(value: string): boolean {
  return value.length % 4 === 0 && BASE64_PATTERN.test(value)
}

/** حجم البيانات بعد الفك دون فكّها فعلاً (يقيّم الحجم قبل تخصيص الذاكرة). */
export function base64DecodedLength(value: string): number {
  if (value.length === 0) return 0
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  return (value.length / 4) * 3 - padding
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('The file could not be read.'))
        return
      }
      // الصيغة: data:<type>;base64,<data>؛ نحتفظ بالبيانات فقط والنوع نخزنه منفصلاً
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

export function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type })
}
