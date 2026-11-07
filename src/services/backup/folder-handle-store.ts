import type { DirectoryHandleLike } from './folder-backup'

/**
 * مقبض المجلد المختار يُحفظ في IndexedDB (المقابض قابلة للنسخ البنيوي) ليبقى بين الجلسات.
 * قاعدة مستقلة عن قاعدة اللوحات كي لا نمسّ ترقيات مخططها.
 */
const DB_NAME = 'infinitespace-backup'
const STORE = 'handles'
const KEY = 'folder'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

/** مخزن المقبض الفعلي (قابل للاستبدال في الاختبار). */
export interface HandleBackend {
  get(): Promise<DirectoryHandleLike | undefined>
  put(handle: DirectoryHandleLike): Promise<void>
  remove(): Promise<void>
}

const indexedDbBackend: HandleBackend = {
  get: () => run('readonly', (store) => store.get(KEY)) as Promise<DirectoryHandleLike | undefined>,
  put: async (handle) => void (await run('readwrite', (store) => store.put(handle, KEY))),
  remove: async () => void (await run('readwrite', (store) => store.delete(KEY))),
}

/**
 * يضيف نسخة في الذاكرة تتجاوز القراءة المتكررة من IndexedDB (النبضة التلقائية كل بضع دقائق، وكل نقرة «Back up now»)؛
 * undefined تعني «لم تُقرأ بعد في هذه الجلسة».
 */
export function createFolderHandleStore(backend: HandleBackend) {
  let cached: DirectoryHandleLike | null | undefined
  return {
    async load(): Promise<DirectoryHandleLike | null> {
      if (cached !== undefined) return cached
      try {
        cached = (await backend.get()) ?? null
      } catch {
        return null
      }
      return cached
    },
    async save(handle: DirectoryHandleLike): Promise<void> {
      await backend.put(handle)
      cached = handle
    },
    async clear(): Promise<void> {
      cached = null
      await backend.remove().catch(() => undefined)
    },
    /** للاختبارات: ينسى النسخة التي في الذاكرة فتُقرأ القراءة التالية من التخزين */
    forgetCache(): void {
      cached = undefined
    },
  }
}

export const folderHandleStore = createFolderHandleStore(indexedDbBackend)
