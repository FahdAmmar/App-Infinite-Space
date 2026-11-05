import { readImageDimensions } from '@/features/canvas/uploads/image-decode'
import { validatePixelCount } from '@/features/canvas/uploads/image-validation'

/**
 * يتحقق أن الملف صورة تُفكّ فعلاً وضمن حد البكسلات (قبل تخزينها). ملف مستورد يحمل نوعاً مسموحاً
 * لكن محتواه ليس صورة، أو صورة ضخمة البكسلات بحجم صغير، يُرفض هنا كما يُرفض عند الرفع العادي.
 */
export async function verifyImageBlob(blob: Blob): Promise<void> {
  const { width, height } = await readImageDimensions(blob)
  const check = validatePixelCount('image', width, height)
  if (!check.ok) throw new Error(check.message)
}
