/**
 * قياس مساحة التخزين المتاحة وطلب «التخزين الدائم». المتصفح هو من يقرر الحصة والمنح،
 * لذلك كل الدوال تقبل كائن StorageManager بديلاً (للاختبار) وتتعامل مع غيابه دون أخطاء.
 */

export type UsageLevel = 'ok' | 'warning' | 'critical'

export interface StorageManagerLike {
  estimate?: () => Promise<{ usage?: number; quota?: number }>
  persisted?: () => Promise<boolean>
  persist?: () => Promise<boolean>
}

export type StorageEstimateResult =
  | { supported: false }
  | {
      supported: true
      usage: number
      quota: number
      /** نسبة الاستخدام بين 0 و 1 */
      ratio: number
      level: UsageLevel
      /** null: المتصفح لا يخبرنا (لا يدعم persisted) */
      persisted: boolean | null
    }

export const WARNING_RATIO = 0.8
export const CRITICAL_RATIO = 0.95

export function classifyUsage(ratio: number): UsageLevel {
  if (ratio >= CRITICAL_RATIO) return 'critical'
  if (ratio >= WARNING_RATIO) return 'warning'
  return 'ok'
}

function defaultManager(): StorageManagerLike | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

/** الرقم التقديري يشمل كل بيانات الموقع (لا اللوحات وحدها) والمتصفحات تقرّبه عمداً لأسباب خصوصية. */
export async function readStorageEstimate(manager: StorageManagerLike | undefined = defaultManager()): Promise<StorageEstimateResult> {
  if (!manager?.estimate) return { supported: false }
  try {
    const { usage, quota } = await manager.estimate()
    if (typeof usage !== 'number' || typeof quota !== 'number' || !Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) {
      return { supported: false }
    }
    const ratio = Math.min(1, Math.max(0, usage / quota))
    let persisted: boolean | null = null
    try {
      persisted = manager.persisted ? await manager.persisted() : null
    } catch {
      persisted = null
    }
    return { supported: true, usage: Math.max(0, usage), quota, ratio, level: classifyUsage(ratio), persisted }
  } catch {
    return { supported: false }
  }
}

export type PersistOutcome = 'granted' | 'denied' | 'unsupported'

/** المتصفح قد يرفض الطلب (قراره وفق سلوك المستخدم)؛ نعرض النتيجة الحقيقية ولا نفترض النجاح. */
export async function requestPersistentStorage(manager: StorageManagerLike | undefined = defaultManager()): Promise<PersistOutcome> {
  if (!manager?.persist) return 'unsupported'
  try {
    return (await manager.persist()) ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

/** نص تحذير الامتلاء، أو null حين لا حاجة لتحذير. النسبة تُقرَّب لأقرب رقم صحيح. */
export function describeStorageWarning(level: UsageLevel, ratio: number): string | null {
  const percent = Math.round(ratio * 100)
  if (level === 'critical') {
    return `Browser storage is ${percent}% full, so new changes may fail to save. Export the workspaces you want to keep, then delete ones you no longer need.`
  }
  if (level === 'warning') {
    return `Browser storage is ${percent}% full. Consider exporting workspaces you want to keep (⋯ menu → Export).`
  }
  return null
}
