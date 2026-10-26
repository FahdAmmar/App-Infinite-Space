import { LazyDatabase, requestToPromise, transactionDone } from './indexed-db-utils'

const DB_NAME = 'infinitespace-canvases'
const DB_VERSION = 1
const CANVASES = 'canvases'
const BACKUPS = 'backups'

/** ما يحتاجه المحوّل المركّب من مخزن اللوحات (مفاتيح خارجية: المفتاح معرّف المساحة). */
export interface CanvasStore {
  get(workspaceId: string): Promise<unknown>
  put(workspaceId: string, canvas: unknown): Promise<void>
  delete(workspaceId: string): Promise<void>
  /** نسخة احتياطية لمحتوى غير مقروء (لا يمحوها شيء تلقائياً) */
  putBackup(key: string, value: unknown): Promise<void>
}

/**
 * لوحات المساحات في IndexedDB. السبب: localStorage حدّه نحو 5MB ومتزامن (يجمّد الواجهة عند الكتابة الكبيرة)،
 * أما IndexedDB فغير متزامن وسعته أكبر بكثير. تُخزَّن اللوحة ككائن (structured clone) لا كنص JSON.
 */
export class IndexedDbCanvasStore implements CanvasStore {
  private readonly database = new LazyDatabase(DB_NAME, DB_VERSION, (db) => {
    db.createObjectStore(CANVASES)
    db.createObjectStore(BACKUPS)
  })

  async get(workspaceId: string): Promise<unknown> {
    const db = await this.database.open()
    return requestToPromise<unknown>(db.transaction(CANVASES, 'readonly').objectStore(CANVASES).get(workspaceId))
  }

  async put(workspaceId: string, canvas: unknown): Promise<void> {
    const db = await this.database.open()
    const transaction = db.transaction(CANVASES, 'readwrite')
    transaction.objectStore(CANVASES).put(canvas, workspaceId)
    await transactionDone(transaction)
  }

  async delete(workspaceId: string): Promise<void> {
    const db = await this.database.open()
    const transaction = db.transaction(CANVASES, 'readwrite')
    transaction.objectStore(CANVASES).delete(workspaceId)
    await transactionDone(transaction)
  }

  async putBackup(key: string, value: unknown): Promise<void> {
    const db = await this.database.open()
    const transaction = db.transaction(BACKUPS, 'readwrite')
    transaction.objectStore(BACKUPS).put(value, key)
    await transactionDone(transaction)
  }
}

/** تنفيذ بالذاكرة (للاختبارات) */
export class MemoryCanvasStore implements CanvasStore {
  readonly canvases = new Map<string, unknown>()
  readonly backups = new Map<string, unknown>()

  get(workspaceId: string): Promise<unknown> {
    return Promise.resolve(this.canvases.get(workspaceId))
  }

  put(workspaceId: string, canvas: unknown): Promise<void> {
    this.canvases.set(workspaceId, structuredClone(canvas))
    return Promise.resolve()
  }

  delete(workspaceId: string): Promise<void> {
    this.canvases.delete(workspaceId)
    return Promise.resolve()
  }

  putBackup(key: string, value: unknown): Promise<void> {
    this.backups.set(key, value)
    return Promise.resolve()
  }
}
