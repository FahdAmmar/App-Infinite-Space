import { StorageError } from './storage-adapter'

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

/**
 * اتصال كسول بقاعدة IndexedDB: يُفتح عند أول استخدام ويُعاد استخدامه.
 * فشل الفتح لا يُخزَّن (تُعاد المحاولة في الاستدعاء التالي)، وإن حُذفت القاعدة أو رُقّيت من تبويب آخر
 * نغلق الاتصال ونعيد الفتح عند الحاجة بدل أن نبقى على اتصال ميت.
 */
export class LazyDatabase {
  private promise: Promise<IDBDatabase> | null = null

  constructor(
    private readonly name: string,
    private readonly version: number,
    private readonly upgrade: (db: IDBDatabase) => void,
  ) {}

  open(): Promise<IDBDatabase> {
    if (this.promise) return this.promise
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new StorageError('unavailable', 'IndexedDB is not available.'))
        return
      }
      const request = indexedDB.open(this.name, this.version)
      request.onupgradeneeded = () => this.upgrade(request.result)
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          this.promise = null
        }
        resolve(db)
      }
      request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'))
      request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'))
    })
    this.promise = opening
    opening.catch(() => {
      if (this.promise === opening) this.promise = null
    })
    return opening
  }
}
