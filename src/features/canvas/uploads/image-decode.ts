export interface ImageDimensions {
  width: number
  height: number
}

/**
 * يقرأ أبعاد الصورة ويتحقق ضمناً أنها قابلة لفك الترميز فعلاً
 * (ملف بامتداد .png محتواه نص يفشل هنا فتظهر للمستخدم رسالة واضحة بدل بطاقة فارغة).
 * نفضّل createImageBitmap (لا يمس DOM)، ونرجع إلى عنصر <img> في المتصفحات التي لا تدعمه.
 */
export async function readImageDimensions(blob: Blob): Promise<ImageDimensions> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  }
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise<ImageDimensions>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error('The image could not be decoded'))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
