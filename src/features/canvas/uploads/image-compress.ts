import type { ImageDimensions } from './image-decode'
import { isAnimatedImage, planImageCompression, shouldUseCompressed, WEBP_QUALITY } from './image-compress-plan'

export interface CompressedImage {
  blob: Blob
  /** أبعاد الصورة المخزَّنة بعد الضغط (قد تكون أصغر من الأصل) */
  width: number
  height: number
}

async function encodeWebp(bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) return null
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, width, height)
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
}

/**
 * يصغّر الصورة الضخمة ويعيد ترميزها بصيغة WebP إن وفّر ذلك مساحة واضحة؛ وإلا يعيد null فتُخزَّن كما هي.
 * لا يرمي أبداً: أي فشل (متصفح بلا ترميز WebP، ذاكرة، ملف غريب) يعني ببساطة «لا ضغط»، فلا تضيع الصورة بسببه.
 * الصور المتحركة لا تُمس لأن الرسم على canvas يُبقي الإطار الأول فقط.
 */
export async function compressImage(file: File, source: ImageDimensions): Promise<CompressedImage | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
    const plan = planImageCompression({
      type: file.type,
      size: file.size,
      width: source.width,
      height: source.height,
      animated: isAnimatedImage(head, file.type),
    })
    if (!plan.compress) return null
    const bitmap = await createImageBitmap(file)
    try {
      const blob = await encodeWebp(bitmap, plan.width, plan.height)
      if (!blob || !shouldUseCompressed(file, blob)) return null
      return { blob, width: plan.width, height: plan.height }
    } finally {
      bitmap.close()
    }
  } catch {
    return null
  }
}
