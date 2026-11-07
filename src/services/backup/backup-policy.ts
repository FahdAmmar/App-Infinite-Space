/** سياسة النسخ الاحتياطي (دوال نقية): متى نذكّر المستخدم، وما اسم ملف كل مساحة في مجلد النسخ. */

const DAY_MS = 24 * 60 * 60 * 1000
/** عمر آخر نسخة الذي يستحق التذكير */
export const REMINDER_AFTER_DAYS = 7
/** مدة «ذكّرني لاحقاً» */
export const SNOOZE_DAYS = 3

export interface ReminderInput {
  now: number
  workspaceCount: number
  /** وقت آخر نسخة ناجحة، أو null إن لم تحدث أي نسخة */
  lastBackupAt: number | null
  /** أقدم مساحة موجودة: مرجع العمر حين لا توجد نسخة بعد (لا نزعج من أنشأ مساحته للتو) */
  oldestCreatedAt: number | null
  snoozedUntil: number
}

export function shouldRemindBackup({ now, workspaceCount, lastBackupAt, oldestCreatedAt, snoozedUntil }: ReminderInput): boolean {
  if (workspaceCount === 0 || now < snoozedUntil) return false
  const reference = lastBackupAt ?? oldestCreatedAt
  if (reference === null) return false
  return now - reference >= REMINDER_AFTER_DAYS * DAY_MS
}

export function snoozeUntil(now: number): number {
  return now + SNOOZE_DAYS * DAY_MS
}

/** «لم تُنسخ بعد» أو «منذ 9 أيام»: وصف عمر النسخة الأخيرة للمستخدم. */
export function describeBackupAge(lastBackupAt: number | null, now: number): string {
  if (lastBackupAt === null) return 'never'
  const days = Math.floor((now - lastBackupAt) / DAY_MS)
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * اسم ثابت لكل مساحة (لا يتضمن التاريخ) فتحلّ كل نسخة محل سابقتها بدل أن تتراكم عشرات الملفات.
 * معرّف المساحة (8 خانات) يمنع تصادم مساحتين بنفس الاسم؛ إعادة تسمية المساحة تنتج ملفاً جديداً ويبقى القديم كأرشيف.
 */
export function backupFileName(workspace: { id: string; name: string }): string {
  const slug =
    workspace.name
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace'
  return `${slug}-${workspace.id.replace(/[^a-z0-9]/gi, '').slice(0, 8)}.infinitespace.json`
}
