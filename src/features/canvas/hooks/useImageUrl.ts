import { useEffect, useState } from 'react'
import { acquireImageUrl, releaseImageUrl } from '../uploads/image-url-cache'

export type ImageUrlState =
  | { status: 'loading'; url: null }
  | { status: 'ready'; url: string }
  | { status: 'missing'; url: null }

/** يحمّل عنوان عرض الصورة من التخزين المحلي ويحرره عند إزالة البطاقة. */
export function useImageUrl(imageId: string): ImageUrlState {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    void acquireImageUrl(imageId).then((url) => {
      if (!cancelled) setLoaded({ id: imageId, url })
    })
    return () => {
      cancelled = true
      releaseImageUrl(imageId)
    }
  }, [imageId])

  // نتيجة صورة سابقة (قبل الاستبدال) لا تُعرض كأنها الحالية
  if (loaded === null || loaded.id !== imageId) return { status: 'loading', url: null }
  return loaded.url ? { status: 'ready', url: loaded.url } : { status: 'missing', url: null }
}
