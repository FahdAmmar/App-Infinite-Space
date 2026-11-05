/**
 * «تكبير دلالي»: عند التصغير الشديد يصغر عنوان المجموعة مع كل شيء حتى لا يُقرأ، فنكبّره بنسبة عكسية للتكبير
 * كي تبقى أسماء المجموعات مقروءة وتصلح كخريطة للوحة الكبيرة.
 * القيمة تُقرَّب إلى ربع خطوة: لا يتغير الاشتراك (ولا إعادة الرسم) مع كل نبضة تكبير بل حين تتبدل الدرجة فقط.
 */
const READABLE_ZOOM = 0.75
const MAX_SCALE = 3

export function labelScale(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0 || zoom >= READABLE_ZOOM) return 1
  const stepped = Math.round((READABLE_ZOOM / zoom) * 4) / 4
  return Math.min(MAX_SCALE, Math.max(1, stepped))
}
