import { createId } from '@/lib/id'

/**
 * تخزين بيانات الصور. الواجهة منفصلة عن التنفيذ كي يمكن استبدال IndexedDB لاحقاً (مثلاً بخادم)
 * دون المساس بالمكوّنات. نخزّن الـ Blob نفسه (لا نص base64: أكبر بـ 33% ويثقل الذاكرة والتخزين).
 */
export interface StoredImageInfo {
  id: string
  createdAt: number
}

export interface ImageStorage {
  /** يحفظ الصورة ويعيد معرّفها */
  save(blob: Blob): Promise<string>
  /** يعيد الصورة، أو null إن لم توجد (حُذفت أو مُسح تخزين المتصفح) */
  load(id: string): Promise<Blob | null>
  remove(id: string): Promise<void>
  /** كل الصور المخزّنة (معرّف وتاريخ إضافة) دون بياناتها؛ يستعملها تنظيف الصور غير المستخدمة. */
  list(): Promise<StoredImageInfo[]>
}

/** تنفيذ بالذاكرة: للاختبارات، وبديل عند منع المتصفح لـ IndexedDB (مثلاً بعض أوضاع التصفح الخاص). */
export class MemoryImageStorage implements ImageStorage {
  private readonly blobs = new Map<string, { blob: Blob; createdAt: number }>()

  save(blob: Blob): Promise<string> {
    const id = createId()
    this.blobs.set(id, { blob, createdAt: Date.now() })
    return Promise.resolve(id)
  }

  load(id: string): Promise<Blob | null> {
    return Promise.resolve(this.blobs.get(id)?.blob ?? null)
  }

  remove(id: string): Promise<void> {
    this.blobs.delete(id)
    return Promise.resolve()
  }

  list(): Promise<StoredImageInfo[]> {
    return Promise.resolve([...this.blobs].map(([id, { createdAt }]) => ({ id, createdAt })))
  }
}

/**
 * يغلّف تخزيناً أساسياً (IndexedDB)، وعند أول فشل في الحفظ ينتقل إلى الذاكرة ويبلّغ مرة واحدة.
 * السبب: فشل الحفظ لا يجب أن يمنع المستخدم من وضع صورته على اللوحة، لكن يجب أن يعرف أنها لن تبقى.
 * القراءة تجرّب الأساسي أولاً ثم الذاكرة (صور حُفظت بعد الانتقال).
 */
export class ResilientImageStorage implements ImageStorage {
  private readonly fallback = new MemoryImageStorage()
  private degraded = false

  constructor(
    private readonly primary: ImageStorage,
    private readonly onFallback: (error: unknown) => void,
  ) {}

  async save(blob: Blob): Promise<string> {
    if (!this.degraded) {
      try {
        return await this.primary.save(blob)
      } catch (error) {
        this.degraded = true
        this.onFallback(error)
      }
    }
    return this.fallback.save(blob)
  }

  async load(id: string): Promise<Blob | null> {
    const fromFallback = await this.fallback.load(id)
    if (fromFallback) return fromFallback
    try {
      return await this.primary.load(id)
    } catch {
      return null
    }
  }

  async remove(id: string): Promise<void> {
    await this.fallback.remove(id)
    try {
      await this.primary.remove(id)
    } catch {
      // الحذف غير حرج: صورة يتيمة أفضل من خطأ يظهر للمستخدم
    }
  }

  async list(): Promise<StoredImageInfo[]> {
    const fromFallback = await this.fallback.list()
    let fromPrimary: StoredImageInfo[] = []
    try {
      fromPrimary = await this.primary.list()
    } catch {
      /* التخزين الأساسي غير متاح: نعرض ما في الذاكرة فقط */
    }
    return [...fromFallback, ...fromPrimary]
  }
}
