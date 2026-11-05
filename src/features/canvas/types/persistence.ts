import type { StorageFailureReason } from '@/services/persistence/storage-adapter'

/**
 * حالة حفظ اللوحة كما يراها المستخدم في الشريط العلوي.
 *  - saved: كل ما على الشاشة محفوظ (الحالة بعد التحميل أيضاً).
 *  - unsaved: يوجد تغيير ينتظر الحفظ (مهلة التأخير الصغيرة قبل الكتابة).
 *  - saving: الكتابة جارية الآن.
 *  - error: فشل الحفظ؛ التعديلات باقية في الذاكرة فقط ويمكن إعادة المحاولة.
 *  - paused: الحفظ موقوف عمداً لأن تبويباً آخر غيّر المساحة؛ لا كتابة حتى يختار المستخدم (لئلا نمحو تعديلاته).
 */
export type SaveStatus =
  | { kind: 'saved'; at: number | null }
  | { kind: 'unsaved' }
  | { kind: 'saving' }
  | { kind: 'error'; reason: StorageFailureReason }
  | { kind: 'paused' }
