import type { BackupInfo } from '@/services/persistence/storage-adapter'

/** نص النسخة كما تُنزَّل: النص الخام كما هو، والكائنات (من IndexedDB) بصيغة JSON منسّقة. */
export function backupToText(raw: unknown): string {
  if (typeof raw === 'string') return raw
  return JSON.stringify(raw, null, 2)
}

function isJsonText(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

/**
 * اسم ملف نسخة التنزيل. النص التالف الذي لا يُقرأ كـ JSON يُسمّى .txt كي لا يُوهم المستخدم بأنه ملف صالح،
 * لكن يبقى متاحاً له أو لمطوّر يفحصه.
 */
export function backupFileName(info: Pick<BackupInfo, 'kind' | 'workspaceId' | 'createdAt'>, text: string): string {
  const extension = isJsonText(text) ? 'json' : 'txt'
  const stamp = info.createdAt ? new Date(info.createdAt).toISOString().slice(0, 10) : 'copy'
  // معرّف المساحة قد يكون عشوائياً من ملف؛ نبقي حروفاً آمنة فقط ونقصّه
  const id = info.workspaceId ? `-${info.workspaceId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12)}` : ''
  return `infinitespace-backup-${info.kind}${id}-${stamp}.${extension}`
}
