import { useUiStore } from '@/stores/ui-store'
import { HybridStorageAdapter } from './hybrid-storage-adapter'
import { IndexedDbCanvasStore } from './indexed-db-canvas-store'
import { IndexedDbImageStorage } from './indexed-db-image-storage'
import { ResilientImageStorage, type ImageStorage } from './image-storage'
import { LocalStorageAdapter, toStorageError } from './local-storage-adapter'
import type { KeyValueStore, StorageAdapter } from './storage-adapter'

/** مخزن بالذاكرة فقط: بديل عند حجب localStorage (مثلاً وضع التصفح الخاص أو سياسات الخصوصية). */
class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }
}

function resolveStore(): { store: KeyValueStore; persistent: boolean } {
  try {
    const probeKey = 'infinitespace:v1:probe'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return { store: window.localStorage, persistent: true }
  } catch (error) {
    // الامتلاء لا يعني أن التخزين غير متاح: القراءة تعمل والبيانات الحالية موجودة
    if (toStorageError(error).reason === 'quota') {
      return { store: window.localStorage, persistent: true }
    }
    return { store: new MemoryStore(), persistent: false }
  }
}

const resolved = resolveStore()

/** نسخة التطبيق الوحيدة من طبقة الحفظ. غيّر هذا السطر فقط لاستبدال طريقة التخزين لاحقاً. */
export const storage: StorageAdapter = new HybridStorageAdapter(
  new LocalStorageAdapter(resolved.store),
  typeof indexedDB === 'undefined' ? null : new IndexedDbCanvasStore(),
)

/** false عندما نعمل بذاكرة مؤقتة، فنصارح المستخدم أن التغييرات لن تبقى بعد إغلاق التبويب. */
export const isStoragePersistent: boolean = resolved.persistent

/**
 * مخزن الصور: IndexedDB أولاً، وإن تعذّر الحفظ ننتقل للذاكرة ونُبلغ المستخدم مرة واحدة.
 * (لا يُفتح اتصال IndexedDB إلا عند أول حفظ أو قراءة.)
 */
let notifiedFallback = false
export const imageStorage: ImageStorage = new ResilientImageStorage(new IndexedDbImageStorage(), () => {
  if (notifiedFallback) return
  notifiedFallback = true
  useUiStore
    .getState()
    .pushToast('info', 'Browser storage for images is unavailable. Images will stay in memory until you close this tab.')
})
