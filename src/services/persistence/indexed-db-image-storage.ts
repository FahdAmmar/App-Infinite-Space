import { createId } from '@/lib/id'
import type { ImageStorage, StoredImageInfo } from './image-storage'
import { LazyDatabase, requestToPromise, transactionDone } from './indexed-db-utils'

const DB_NAME = 'infinitespace-images'
const STORE_NAME = 'images'
const DB_VERSION = 1

interface ImageRecord {
  id: string
  blob: Blob
  createdAt: number
}

/** تخزين الصور في IndexedDB (قاعدة واحدة ومخزن واحد، المفتاح هو id). */
export class IndexedDbImageStorage implements ImageStorage {
  private readonly database = new LazyDatabase(DB_NAME, DB_VERSION, (db) => {
    db.createObjectStore(STORE_NAME, { keyPath: 'id' })
  })

  async save(blob: Blob): Promise<string> {
    const db = await this.database.open()
    const id = createId()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const record: ImageRecord = { id, blob, createdAt: Date.now() }
    transaction.objectStore(STORE_NAME).put(record)
    await transactionDone(transaction)
    return id
  }

  async load(id: string): Promise<Blob | null> {
    const db = await this.database.open()
    const record = await requestToPromise<ImageRecord | undefined>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id),
    )
    return record?.blob ?? null
  }

  async remove(id: string): Promise<void> {
    const db = await this.database.open()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    await transactionDone(transaction)
  }

  /** معرّفات كل الصور المخزّنة وتواريخ إضافتها، دون قراءة بياناتها (للتنظيف). */
  async list(): Promise<StoredImageInfo[]> {
    const db = await this.database.open()
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const infos: StoredImageInfo[] = []
    const request = transaction.objectStore(STORE_NAME).openCursor()
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve()
          return
        }
        const record = cursor.value as Partial<ImageRecord>
        if (typeof record.id === 'string') {
          infos.push({ id: record.id, createdAt: typeof record.createdAt === 'number' ? record.createdAt : 0 })
        }
        cursor.continue()
      }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB cursor failed'))
    })
    return infos
  }
}
