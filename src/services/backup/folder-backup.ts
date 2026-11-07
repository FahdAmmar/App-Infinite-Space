import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { backupFileName } from './backup-policy'

/** الحد الأدنى من واجهات File System Access التي نستخدمها (queryPermission/requestPermission غير موجودة في lib.dom). */
export interface WritableLike {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
export interface FileHandleLike {
  createWritable(): Promise<WritableLike>
}
export interface DirectoryHandleLike {
  readonly name: string
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
}

export interface FolderBackupResult {
  written: string[]
  /** أسماء المساحات التي فشل نسخها (التصدير أو الكتابة) */
  failed: string[]
}

/**
 * يكتب كل مساحة كملف تصدير كامل (نفس صيغة «Export» فيمكن استيراده من التطبيق) في المجلد المختار.
 * الكتابة عبر createWritable ذرّية: المتصفح يكتب في ملف مؤقت ولا يستبدل الأصل إلا عند close()، فلا يبقى ملف نصف مكتوب.
 * فشل مساحة واحدة لا يوقف البقية.
 */
export async function backupWorkspacesToFolder(
  directory: DirectoryHandleLike,
  workspaces: readonly WorkspaceMeta[],
  exportBlob: (workspace: WorkspaceMeta) => Promise<Blob>,
): Promise<FolderBackupResult> {
  const result: FolderBackupResult = { written: [], failed: [] }
  for (const workspace of workspaces) {
    try {
      const blob = await exportBlob(workspace)
      const handle = await directory.getFileHandle(backupFileName(workspace), { create: true })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      result.written.push(workspace.name)
    } catch {
      result.failed.push(workspace.name)
    }
  }
  return result
}

/** هل لدينا إذن الكتابة الآن دون إظهار نافذة؟ (الإذن يضيع غالباً بين الجلسات ويحتاج نقرة المستخدم لاستعادته) */
export async function hasWritePermission(directory: DirectoryHandleLike): Promise<boolean> {
  try {
    return (await directory.queryPermission?.({ mode: 'readwrite' })) === 'granted'
  } catch {
    return false
  }
}

/** يطلب الإذن؛ يجب استدعاؤه من نقرة المستخدم. */
export async function requestWritePermission(directory: DirectoryHandleLike): Promise<boolean> {
  try {
    return (await directory.requestPermission?.({ mode: 'readwrite' })) === 'granted'
  } catch {
    return false
  }
}
