import { imageStorage } from '@/services/persistence'
import type { ImageStorage } from '@/services/persistence/image-storage'

/**
 * ذاكرة مؤقتة لعناوين الصور (blob: URL).
 *
 * المشكلة: React Flow لا يرسم إلا العقد الظاهرة، فتُبنى بطاقة الصورة وتُهدم أثناء التحريك.
 * لو أعدنا القراءة من IndexedDB وإنشاء عنوان جديد كل مرة لرأى المستخدم وميضاً وتحميلاً متكرراً.
 *
 * الحل: عدّاد مراجع لكل صورة. ما دامت ظاهرة (عدّاد > 0) يبقى عنوانها حياً. وعند الإخفاء تنتقل إلى قائمة
 * «خاملة» محدودة الحجم نحتفظ بها للعودة السريعة، وما يزيد عن الحد يُلغى عنوانه (revokeObjectURL)
 * فتتحرر ذاكرة المتصفح. لا نلغي أبداً عنواناً ما زالت بطاقة تعرضه.
 */
const MAX_IDLE = 24

interface Entry {
  url: Promise<string | null>
  refs: number
}

const entries = new Map<string, Entry>()
const idle: string[] = []

function evictIdle(): void {
  while (idle.length > MAX_IDLE) {
    const oldest = idle.shift()
    if (oldest === undefined) break
    const entry = entries.get(oldest)
    if (!entry || entry.refs > 0) continue
    entries.delete(oldest)
    void entry.url.then((url) => {
      if (url) URL.revokeObjectURL(url)
    })
  }
}

export function acquireImageUrl(id: string, storage: ImageStorage = imageStorage): Promise<string | null> {
  let entry = entries.get(id)
  if (!entry) {
    const url = storage
      .load(id)
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null)
    entry = { url, refs: 0 }
    entries.set(id, entry)
  }
  entry.refs += 1
  const position = idle.indexOf(id)
  if (position !== -1) idle.splice(position, 1)
  return entry.url
}

export function releaseImageUrl(id: string): void {
  const entry = entries.get(id)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  if (entry.refs === 0) {
    idle.push(id)
    evictIdle()
  }
}

/** للاختبارات: يفرّغ كل شيء ويلغي العناوين. */
export function resetImageUrlCache(): void {
  for (const entry of entries.values()) {
    void entry.url.then((url) => {
      if (url) URL.revokeObjectURL(url)
    })
  }
  entries.clear()
  idle.length = 0
}
