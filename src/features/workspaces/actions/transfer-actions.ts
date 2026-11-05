import { downloadBlob } from '@/lib/download'
import { imageStorage, storage } from '@/services/persistence'
import type { BackupInfo } from '@/services/persistence/storage-adapter'
import { backupFileName, backupToText } from '@/services/transfer/backup-file'
import { restoreCanvasBackup, restoreWorkspaceList } from '@/services/transfer/backup-restore'
import { TransferError } from '@/services/transfer/transfer-error'
import { verifyImageBlob } from '@/services/transfer/verify-image'
import { buildPackage, PACKAGE_MAX_BYTES } from '@/services/transfer/workspace-package'
import { exportStandaloneViewer } from '@/services/transfer/standalone-export'
import { exportWorkspace, importWorkspaceText } from '@/services/transfer/workspace-transfer'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { TemplateId } from '../templates/template-catalog'
import type { WorkspaceInput, WorkspaceMeta } from '../types/workspace'

/**
 * إجراءات التصدير والاستيراد والاسترجاع كما تراها الواجهة: تربط الخدمات (نقية وقابلة للاختبار)
 * بالمخازن الحقيقية وتُبلغ المستخدم بالنتيجة. لا تُلقي أخطاء: كل فشل يتحول إلى رسالة مفهومة.
 */

const toast = (kind: 'success' | 'error' | 'info', message: string): void => useUiStore.getState().pushToast(kind, message)

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof TransferError ? error.message : fallback
}

/** الحالة الحية للمخزن لحظة التنفيذ (لا لقطة قديمة): أسماء المساحات ومعرّفاتها وإضافة مساحات جديدة. */
function commitDeps() {
  const state = useWorkspaceStore.getState()
  return {
    storage,
    adopt: state.adoptWorkspaces,
    existingNames: state.workspaces.map((workspace) => workspace.name),
  }
}

export async function exportWorkspaceToFile(workspace: WorkspaceMeta): Promise<void> {
  try {
    const result = await exportWorkspace(workspace, { storage, imageStorage })
    downloadBlob(result.blob, result.fileName)
    const note =
      result.missingImages > 0
        ? ` ${plural(result.missingImages, 'image card')} had no picture stored in this browser, so ${result.missingImages === 1 ? 'it was' : 'they were'} exported without one.`
        : ''
    toast('success', `Exported “${workspace.name}” as ${result.fileName}.${note}`)
  } catch (error) {
    toast('error', failureMessage(error, "The workspace couldn't be exported."))
  }
}

/** ملف HTML واحد للقراءة فقط يفتح في أي متصفح بلا التطبيق (للمشاركة والأرشفة). لا يغيّر المساحة. */
export async function exportViewerToFile(workspace: WorkspaceMeta): Promise<void> {
  try {
    const result = await exportStandaloneViewer(workspace, { storage, imageStorage })
    downloadBlob(result.blob, result.fileName)
    const note =
      result.missingImages > 0
        ? ` ${plural(result.missingImages, 'image card')} had no picture the viewer can show, so ${result.missingImages === 1 ? 'it was' : 'they were'} left without one.`
        : ''
    toast('success', `Saved a read-only copy as ${result.fileName}. Open it in any browser.${note}`)
  } catch (error) {
    toast('error', failureMessage(error, "The read-only copy couldn't be created."))
  }
}

export async function importWorkspaceFromFile(file: File): Promise<boolean> {
  if (file.size > PACKAGE_MAX_BYTES) {
    toast('error', 'This file is too large to import.')
    return false
  }
  try {
    const text = await file.text()
    const result = await importWorkspaceText(text, { ...commitDeps(), imageStorage, verifyImage: verifyImageBlob })
    const notes = [
      result.skippedItems > 0 ? `${plural(result.skippedItems, 'damaged item')} skipped.` : '',
      result.missingImages > 0 ? `${plural(result.missingImages, 'image')} couldn't be restored.` : '',
    ].filter(Boolean)
    toast('success', `Imported “${result.workspace.name}”.${notes.length > 0 ? ` ${notes.join(' ')}` : ''}`)
    return true
  } catch (error) {
    toast('error', failureMessage(error, "The file couldn't be imported."))
    return false
  }
}

/**
 * ينشئ مساحة من قالب جاهز: تُبنى بطاقات القالب (وحدة كسولة: لا تدخل رسم الاستيراد الثابت للوحة التحكم) ثم تمر
 * عبر مسار الاستيراد نفسه، فتُتحقق وتُحفظ وتُسجَّل بالقواعد والتراجع عند الفشل نفسها. تعيد المساحة أو null عند الفشل.
 */
export async function createWorkspaceFromTemplate(input: WorkspaceInput, templateId: TemplateId): Promise<WorkspaceMeta | null> {
  try {
    const { buildTemplateCanvas } = await import('@/services/templates/build-template')
    const now = Date.now()
    // المحرر يملأ النافذة تقريباً، فنوسّط المحتوى على مقاسها الحالي
    const canvas = buildTemplateCanvas(templateId, now, { width: window.innerWidth, height: window.innerHeight })
    const text = JSON.stringify(
      buildPackage({ workspace: input, nodes: canvas.nodes, edges: canvas.edges, viewport: canvas.viewport, images: {}, exportedAt: now }),
    )
    const result = await importWorkspaceText(text, { ...commitDeps(), imageStorage, verifyImage: verifyImageBlob, now: () => now })
    return result.workspace
  } catch (error) {
    toast('error', failureMessage(error, "The workspace couldn't be created from this template."))
    return null
  }
}

export async function downloadBackup(info: BackupInfo): Promise<void> {
  try {
    const raw = await storage.readBackup(info.key)
    if (raw === null || raw === undefined) {
      toast('error', 'This backup no longer exists.')
      return
    }
    const text = backupToText(raw)
    const type = backupFileName(info, text).endsWith('.json') ? 'application/json' : 'text/plain'
    downloadBlob(new Blob([text], { type }), backupFileName(info, text))
  } catch {
    toast('error', "The backup couldn't be read from browser storage.")
  }
}

export async function restoreBackup(info: BackupInfo): Promise<boolean> {
  try {
    const raw = await storage.readBackup(info.key)
    if (raw === null || raw === undefined) {
      toast('error', 'This backup no longer exists.')
      return false
    }
    if (info.kind === 'canvas') {
      const result = await restoreCanvasBackup(raw, commitDeps())
      const skipped = result.skippedItems > 0 ? ` ${plural(result.skippedItems, 'damaged item')} couldn't be recovered.` : ''
      toast('success', `Restored as “${result.workspace.name}”.${skipped}`)
    } else {
      const state = useWorkspaceStore.getState()
      const restored = await restoreWorkspaceList(raw, {
        adopt: state.adoptWorkspaces,
        existingIds: new Set(state.workspaces.map((workspace) => workspace.id)),
      })
      toast('success', `Restored ${plural(restored.length, 'workspace')}.`)
    }
    return true
  } catch (error) {
    toast('error', failureMessage(error, "The backup couldn't be restored."))
    return false
  }
}

export async function deleteBackupCopy(info: BackupInfo): Promise<boolean> {
  try {
    await storage.deleteBackup(info.key)
    return true
  } catch {
    toast('error', "The backup couldn't be deleted.")
    return false
  }
}
