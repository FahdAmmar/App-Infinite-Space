import { downloadBlob } from '@/lib/download'
import {
  backupWorkspacesToFolder,
  hasWritePermission,
  requestWritePermission,
  type DirectoryHandleLike,
  type FolderBackupResult,
} from '@/services/backup/folder-backup'
import { folderHandleStore } from '@/services/backup/folder-handle-store'
import { imageStorage, storage } from '@/services/persistence'
import { makeExportFileName } from '@/services/transfer/workspace-package'
import { exportWorkspace } from '@/services/transfer/workspace-transfer'
import { useBackupStore } from '@/stores/backup-store'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { WorkspaceMeta } from '../types/workspace'

/**
 * النسخ الاحتياطي كما تراه الواجهة. بياناتنا كلها في المتصفح، فهذا خط الدفاع الوحيد ضد مسح بيانات الموقع أو تلف القرص.
 *  - Chromium: مجلد يختاره المستخدم (File System Access)، وتُحدَّث ملفاته تلقائياً والتطبيق مفتوح.
 *  - غيره (Firefox وSafari): تنزيل ملفات التصدير، ويبقى التذكير الدوري.
 * لا نلقي أخطاء: كل فشل يتحول إلى رسالة مفهومة.
 */

type DirectoryPicker = (options?: { mode?: 'readwrite' }) => Promise<DirectoryHandleLike>

const toast = (kind: 'success' | 'error' | 'info', message: string): void => useUiStore.getState().pushToast(kind, message)
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

export function isFolderBackupSupported(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
}

const exportBlob = async (workspace: WorkspaceMeta): Promise<Blob> => (await exportWorkspace(workspace, { storage, imageStorage })).blob
const allWorkspaces = (): WorkspaceMeta[] => useWorkspaceStore.getState().workspaces

function report(result: FolderBackupResult, folderName: string): boolean {
  const { written, failed } = result
  if (failed.length === 0) {
    toast('success', `Backed up ${plural(written.length, 'workspace')} to “${folderName}”.`)
    return true
  }
  toast('error', `${plural(failed.length, 'workspace')} couldn't be backed up (${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}).`)
  return false
}

async function runFolderBackup(directory: DirectoryHandleLike, workspaces: readonly WorkspaceMeta[], silent: boolean): Promise<boolean> {
  const result = await backupWorkspacesToFolder(directory, workspaces, exportBlob)
  const ok = result.failed.length === 0 && result.written.length > 0
  if (ok) useBackupStore.getState().recordBackup(Date.now())
  if (!silent || !ok) report(result, directory.name)
  return ok
}

/** عند بدء التطبيق: هل المجلد المحفوظ جاهز للكتابة الآن أم يحتاج إذناً جديداً من المستخدم؟ */
export async function refreshFolderStatus(): Promise<void> {
  const { folderName, setFolderStatus } = useBackupStore.getState()
  if (!folderName) return setFolderStatus('none')
  const handle = await folderHandleStore.load()
  if (!handle) return useBackupStore.getState().setFolder(null)
  setFolderStatus((await hasWritePermission(handle)) ? 'ready' : 'needs-permission')
}

/** يفتح منتقي المجلدات، يحفظ المقبض، ثم يبدأ بنسخة كاملة. */
export async function chooseBackupFolder(): Promise<boolean> {
  const picker = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
  if (!picker) return false
  try {
    const handle = await picker({ mode: 'readwrite' })
    if (!(await requestWritePermission(handle))) {
      toast('error', "Permission to write to that folder wasn't granted.")
      return false
    }
    await folderHandleStore.save(handle)
    const store = useBackupStore.getState()
    store.setFolder(handle.name)
    store.setFolderStatus('ready')
    store.setAutoBackup(true)
    await runFolderBackup(handle, allWorkspaces(), false)
    return true
  } catch (error) {
    // إغلاق المنتقي دون اختيار (AbortError) ليس خطأ
    if (!(error instanceof DOMException && error.name === 'AbortError')) toast('error', "That folder couldn't be used for backups.")
    return false
  }
}

/** يستعيد إذن المجلد المحفوظ بعد جلسة جديدة (يجب أن يُستدعى من نقرة). */
export async function reconnectBackupFolder(): Promise<boolean> {
  const handle = await folderHandleStore.load()
  if (!handle || !(await requestWritePermission(handle))) {
    toast('error', "The backup folder couldn't be reconnected. Choose it again.")
    return false
  }
  useBackupStore.getState().setFolderStatus('ready')
  await runFolderBackup(handle, allWorkspaces(), false)
  return true
}

export async function disconnectBackupFolder(): Promise<void> {
  await folderHandleStore.clear()
  useBackupStore.getState().setFolder(null)
  toast('info', 'Backup folder disconnected. Files already saved there are left untouched.')
}

/** نسخة كاملة الآن: إلى المجلد إن كان جاهزاً، وإلا تنزيل ملف لكل مساحة. */
export async function backupNow(): Promise<void> {
  const workspaces = allWorkspaces()
  if (workspaces.length === 0) return toast('info', 'There is nothing to back up yet.')
  if (useBackupStore.getState().folderStatus === 'ready') {
    const handle = await folderHandleStore.load()
    if (handle) {
      await runFolderBackup(handle, workspaces, false)
      return
    }
  }
  let saved = 0
  for (const workspace of workspaces) {
    try {
      downloadBlob(await exportBlob(workspace), makeExportFileName(workspace.name, new Date()))
      saved += 1
      // المتصفحات تسمح بتنزيلات متتالية لكن بعضها يسأل المستخدم؛ فاصل قصير يتجنب حجبها
      await new Promise((resolve) => setTimeout(resolve, 350))
    } catch {
      /* نكمل بقية المساحات ونبلغ بالعدد الفعلي */
    }
  }
  if (saved === workspaces.length) {
    useBackupStore.getState().recordBackup(Date.now())
    toast('success', `Downloaded ${plural(saved, 'backup file')}.`)
  } else {
    toast('error', `Only ${saved} of ${workspaces.length} workspaces could be downloaded.`)
  }
}

/** نبضة النسخ التلقائي: المساحات التي تغيّرت منذ آخر نسخة فقط، بصمت حين تنجح. */
export async function autoBackupTick(): Promise<void> {
  const { autoBackup, folderStatus, lastBackupAt, setFolderStatus } = useBackupStore.getState()
  if (!autoBackup || folderStatus !== 'ready') return
  const changed = allWorkspaces().filter((workspace) => workspace.updatedAt > (lastBackupAt ?? 0))
  if (changed.length === 0) return
  const handle = await folderHandleStore.load()
  if (!handle) return
  if (!(await hasWritePermission(handle))) return setFolderStatus('needs-permission')
  await runFolderBackup(handle, changed, true)
}
