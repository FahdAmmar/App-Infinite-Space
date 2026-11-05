/**
 * قرارات ضغط الصور (دوال نقية، تُختبر بلا متصفح). الترميز الفعلي في image-compress.ts.
 *
 * الغاية: ملفات أصغر في التخزين المحلي وفي ملفات التصدير (Base64 يزيد الحجم الثلث) دون أن يُلحظ فرق على اللوحة.
 * البطاقة تُعرض بعرض أقصاه 1200px، فشاشة بكثافة مضاعفة تكفيها 2400px؛ نترك هامشاً ونقف عند 2560px.
 */
export const MAX_STORED_SIDE = 2560

/** ملفات أصغر من هذا لا تستحق إعادة الترميز (المكسب لا يوازي خسارة الجودة) إن لم تكن ضخمة الأبعاد */
export const MIN_BYTES_TO_COMPRESS = 400 * 1024

/** نقبل النسخة المضغوطة فقط إن وفّرت هذه النسبة على الأقل */
const MIN_SAVING_RATIO = 0.1

export const WEBP_QUALITY = 0.82

/** أنواع نعيد ترميزها. GIF يفقد حركته، وAVIF مضغوط أصلاً، فيبقيان كما هما. */
const RECOMPRESSIBLE: readonly string[] = ['image/png', 'image/jpeg', 'image/webp']

export interface CompressionPlan {
  compress: boolean
  width: number
  height: number
}

/**
 * هل تُعاد الصورة بصيغة WebP وبأي أبعاد؟ لا نكبّر الصور أبداً، ونحافظ على النسبة.
 * `animated` تأتي من فحص رأس الملف: الحركة تضيع عند الرسم على canvas فنتركها كما هي.
 */
export function planImageCompression(image: { type: string; size: number; width: number; height: number; animated: boolean }): CompressionPlan {
  const keep = { compress: false, width: image.width, height: image.height }
  if (!RECOMPRESSIBLE.includes(image.type) || image.animated) return keep
  const longest = Math.max(image.width, image.height)
  const scale = longest > MAX_STORED_SIDE ? MAX_STORED_SIDE / longest : 1
  const bigFile = image.size >= MIN_BYTES_TO_COMPRESS
  if (scale === 1 && !bigFile) return keep
  return { compress: true, width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) }
}

/** نقبل الناتج إن كان بصيغة WebP حقاً (بعض المتصفحات تعيد PNG عند عدم دعم الترميز) وأصغر بوضوح من الأصل. */
export function shouldUseCompressed(original: { size: number }, result: { type: string; size: number }): boolean {
  return result.type === 'image/webp' && result.size > 0 && result.size <= original.size * (1 - MIN_SAVING_RATIO)
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let text = ''
  for (let i = start; i < start + length && i < bytes.length; i += 1) text += String.fromCharCode(bytes[i] ?? 0)
  return text
}

/**
 * يفحص رأس الملف: APNG فيه قطعة acTL قبل بيانات الصورة، وWebP المتحرك رأسه VP8X بعلم الحركة (البت 1 من البايت 20).
 * يكفي أول كيلوبايت أو اثنين: القطعتان تأتيان في البداية.
 */
export function isAnimatedImage(head: Uint8Array, type: string): boolean {
  if (type === 'image/png') {
    const text = ascii(head, 0, Math.min(head.length, 4096))
    const actl = text.indexOf('acTL')
    const idat = text.indexOf('IDAT')
    return actl !== -1 && (idat === -1 || actl < idat)
  }
  if (type === 'image/webp') {
    return ascii(head, 12, 4) === 'VP8X' && ((head[20] ?? 0) & 0x02) !== 0
  }
  return false
}
