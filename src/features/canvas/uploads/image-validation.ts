import { IMAGE_LIMITS } from '../utils/constants'

export type FileCheck = { ok: true } | { ok: false; message: string }

const ACCEPTED: readonly string[] = IMAGE_LIMITS.acceptedTypes

/** قيمة خاصية accept لحقل اختيار الملفات */
export const IMAGE_ACCEPT_ATTRIBUTE = IMAGE_LIMITS.acceptedTypes.join(',')

function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

/**
 * يتحقق من الملف قبل أي معالجة. نعتمد نوع MIME الذي يعلنه المتصفح، ونتحقق لاحقاً من إمكانية فك ترميز
 * الصورة فعلاً (ملف بامتداد صورة لكن محتواه غير ذلك يفشل هناك). SVG مستبعد عمداً:
 * يمكن أن يحمل سكربتات، ولا نحتاجه في هذه المرحلة.
 */
export function validateImageFile(file: Pick<File, 'name' | 'type' | 'size'>): FileCheck {
  if (!ACCEPTED.includes(file.type)) {
    return { ok: false, message: `"${file.name}" is not a supported image. Use PNG, JPEG, WebP, GIF, or AVIF.` }
  }
  if (file.size === 0) return { ok: false, message: `"${file.name}" is empty.` }
  if (file.size > IMAGE_LIMITS.maxBytes) {
    return {
      ok: false,
      message: `"${file.name}" is ${formatMegabytes(file.size)}. The limit is ${formatMegabytes(IMAGE_LIMITS.maxBytes)}.`,
    }
  }
  return { ok: true }
}

export function validatePixelCount(name: string, width: number, height: number): FileCheck {
  if (width < 1 || height < 1) return { ok: false, message: `"${name}" has no visible pixels.` }
  if (width * height > IMAGE_LIMITS.maxPixels) {
    return { ok: false, message: `"${name}" is too large (${width}×${height} px). Resize it and try again.` }
  }
  return { ok: true }
}

/** حجم العرض الابتدائي: عرض افتراضي، مع تصغير الصور الطويلة كي لا يتجاوز الارتفاع الحد الأقصى. */
export function fitImageWidth(naturalWidth: number, naturalHeight: number): number {
  const ratio = naturalHeight / naturalWidth
  const byWidth = IMAGE_LIMITS.defaultWidth
  const byHeight = IMAGE_LIMITS.maxInitialHeight / ratio
  return Math.max(IMAGE_LIMITS.minWidth, Math.round(Math.min(byWidth, byHeight)))
}
