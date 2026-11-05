import { deserializeCanvas } from '@/features/canvas/persistence/canvas-codec'
import { blobToBase64 } from '@/lib/base64'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import type { ImageStorage } from '@/services/persistence/image-storage'
import type { StorageAdapter } from '@/services/persistence/storage-adapter'
import { TransferError } from './transfer-error'
import { buildViewerData, buildViewerHtml } from './standalone-viewer'
import { makeExportFileName, PACKAGE_FILE_SUFFIX } from './workspace-package'

/** سقف حجم الملف المستقل: صفحة أكبر من هذا تبطئ المتصفح عند الفتح، والتصدير الكامل (JSON) هو البديل. */
export const VIEWER_MAX_BYTES = 64 * 1024 * 1024

export interface ViewerExportDeps {
  storage: Pick<StorageAdapter, 'loadCanvas'>
  imageStorage: Pick<ImageStorage, 'load'>
  now?: () => number
}

export interface ViewerExportResult {
  blob: Blob
  fileName: string
  imageCount: number
  /** بطاقات صور بلا صورة في الملف (غير موجودة في المتصفح، أو صيغتها غير مدعومة في العارض) */
  missingImages: number
}

export function makeViewerFileName(workspaceName: string, date: Date): string {
  return makeExportFileName(workspaceName, date).replace(PACKAGE_FILE_SUFFIX, '.html')
}

/** يصدّر مساحة كصفحة HTML واحدة للقراءة فقط. لا يغيّر شيئاً في المساحة نفسها. */
export async function exportStandaloneViewer(workspace: WorkspaceMeta, deps: ViewerExportDeps): Promise<ViewerExportResult> {
  const now = deps.now?.() ?? Date.now()

  let loaded
  try {
    loaded = await deps.storage.loadCanvas(workspace.id)
  } catch (error) {
    throw new TransferError('storage', "This workspace couldn't be read from browser storage.", { cause: error })
  }
  if (loaded.unreadable) {
    throw new TransferError(
      'unreadable',
      "This workspace's saved content can't be read, so it can't be exported. Download its recovery copy from Data & backup instead.",
    )
  }
  const decoded = loaded.canvas ? deserializeCanvas(loaded.canvas, now) : { nodes: [], edges: [] }

  const images: Record<string, string> = {}
  let bytes = 0
  const imageIds = [...new Set(decoded.nodes.flatMap((node) => (node.type === 'image' ? [node.data.imageId] : [])))]
  for (const id of imageIds) {
    const blob = await deps.imageStorage.load(id).catch(() => null)
    if (!blob) continue
    const data = await blobToBase64(blob)
    bytes += data.length
    if (bytes > VIEWER_MAX_BYTES) {
      throw new TransferError('too-large', 'This workspace has too many images for a single HTML file. Use Export (JSON) instead.')
    }
    images[id] = `data:${blob.type};base64,${data}`
  }

  const data = buildViewerData({
    name: workspace.name,
    description: workspace.description,
    nodes: decoded.nodes,
    edges: decoded.edges,
    images,
    exportedAt: now,
  })
  const html = buildViewerHtml(data)
  const blob = new Blob([html], { type: 'text/html' })
  const withImage = data.nodes.filter((node) => node.image !== null).length
  return {
    blob,
    fileName: makeViewerFileName(workspace.name, new Date(now)),
    imageCount: withImage,
    missingImages: decoded.nodes.filter((node) => node.type === 'image').length - withImage,
  }
}
