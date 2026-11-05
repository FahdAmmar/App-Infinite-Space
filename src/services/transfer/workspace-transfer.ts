import { deserializeCanvas, serializeCanvas, type DecodedCanvas } from '@/features/canvas/persistence/canvas-codec'
import { summarizeCanvas } from '@/features/canvas/persistence/workspace-summary'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import type { WorkspaceInput, WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { createWorkspaceMeta, makeCopyName } from '@/features/workspaces/utils/factory'
import { base64ToBlob, base64DecodedLength, blobToBase64 } from '@/lib/base64'
import { createId } from '@/lib/id'
import type { ImageStorage } from '@/services/persistence/image-storage'
import type { StorageAdapter } from '@/services/persistence/storage-adapter'
import { TransferError } from './transfer-error'
import {
  PACKAGE_MAX_BYTES,
  buildPackage,
  isAcceptedImageType,
  makeExportFileName,
  parsePackage,
  type PackagedImage,
} from './workspace-package'

const EMPTY_VIEWPORT = { x: 0, y: 0, zoom: 1 } as const

// ───────────── التصدير ─────────────

export interface ExportDeps {
  storage: Pick<StorageAdapter, 'loadCanvas'>
  imageStorage: Pick<ImageStorage, 'load'>
  now?: () => number
}

export interface ExportResult {
  blob: Blob
  fileName: string
  /** صور حُزمت داخل الملف */
  imageCount: number
  /** بطاقات صور لم نجد ملفها في المتصفح (حُذف أو مُسح): تُصدَّر البطاقة دون صورة */
  missingImages: number
}

function uniqueImageIds(nodes: readonly CanvasNode[]): string[] {
  const ids = new Set<string>()
  for (const node of nodes) if (node.type === 'image') ids.add(node.data.imageId)
  return [...ids]
}

export async function exportWorkspace(workspace: WorkspaceMeta, deps: ExportDeps): Promise<ExportResult> {
  const now = deps.now?.() ?? Date.now()

  let loaded
  try {
    loaded = await deps.storage.loadCanvas(workspace.id)
  } catch (error) {
    throw new TransferError('storage', "This workspace couldn't be read from browser storage.", { cause: error })
  }
  if (loaded.unreadable) {
    // لا نصدّر لوحة فارغة بدل لوحة المستخدم: يظن أن تصديره سليم وهو ليس كذلك
    throw new TransferError(
      'unreadable',
      "This workspace's saved content can't be read, so it can't be exported. Download its recovery copy from Data & backup instead.",
    )
  }

  const decoded = loaded.canvas
    ? deserializeCanvas(loaded.canvas, now)
    : { nodes: [], edges: [], viewport: { ...EMPTY_VIEWPORT }, discardedCount: 0 }

  const images: Record<string, PackagedImage> = {}
  let missingImages = 0
  let encodedBytes = 0
  for (const id of uniqueImageIds(decoded.nodes)) {
    const blob = await deps.imageStorage.load(id).catch(() => null)
    if (!blob || !isAcceptedImageType(blob.type)) {
      missingImages += 1
      continue
    }
    const data = await blobToBase64(blob)
    encodedBytes += data.length
    // فحص مبكر قبل تجميع الملف كله في الذاكرة
    if (encodedBytes > PACKAGE_MAX_BYTES) {
      throw new TransferError('too-large', 'This workspace has too many images to export as a single file.')
    }
    images[id] = { type: blob.type, data }
  }

  const pkg = buildPackage({
    workspace: { name: workspace.name, description: workspace.description, color: workspace.color, icon: workspace.icon },
    nodes: decoded.nodes,
    edges: decoded.edges,
    viewport: decoded.viewport,
    images,
    exportedAt: now,
  })
  const blob = new Blob([JSON.stringify(pkg)], { type: 'application/json' })
  if (blob.size > PACKAGE_MAX_BYTES) {
    throw new TransferError('too-large', 'This workspace is too large to export as a single file.')
  }
  return { blob, fileName: makeExportFileName(workspace.name, new Date(now)), imageCount: Object.keys(images).length, missingImages }
}

// ───────────── الإضافة الذرّية لمساحة جديدة ─────────────

export interface CommitDeps {
  storage: Pick<StorageAdapter, 'saveCanvas' | 'deleteCanvas'>
  /** يسجّل المساحات في القائمة ويحفظها؛ false إن فشل الحفظ (فيُتراجع عن كل شيء) */
  adopt: (workspaces: WorkspaceMeta[]) => Promise<boolean>
  existingNames: readonly string[]
  now?: () => number
}

function uniqueName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((item) => item.toLocaleLowerCase()))
  return taken.has(name.toLocaleLowerCase()) ? makeCopyName(name, existing) : name
}

/**
 * يكتب اللوحة ثم يسجّل المساحة. الترتيب مقصود: لو سُجّلت المساحة أولاً ثم فشلت كتابة اللوحة
 * لظهرت مساحة فارغة بلا سبب. عند أي فشل نتراجع عمّا كُتب (rollback) كي لا تتراكم بيانات يتيمة.
 */
export async function commitWorkspace(
  deps: CommitDeps,
  input: WorkspaceInput,
  canvas: Pick<DecodedCanvas, 'nodes' | 'edges' | 'viewport'>,
  rollbackExtras: () => Promise<void>,
): Promise<WorkspaceMeta> {
  const now = deps.now?.() ?? Date.now()
  const meta: WorkspaceMeta = {
    ...createWorkspaceMeta({ ...input, name: uniqueName(input.name, deps.existingNames) }, now),
    ...summarizeCanvas(canvas.nodes),
  }

  const rollback = async (): Promise<void> => {
    await deps.storage.deleteCanvas(meta.id).catch(() => undefined)
    await rollbackExtras()
  }

  try {
    await deps.storage.saveCanvas(meta.id, serializeCanvas(canvas.nodes, canvas.edges, canvas.viewport))
  } catch (error) {
    await rollback()
    throw new TransferError('storage', "The workspace couldn't be saved. Browser storage may be full or blocked.", { cause: error })
  }
  if (!(await deps.adopt([meta]))) {
    await rollback()
    throw new TransferError('storage', "The workspace couldn't be added. Browser storage may be full or blocked.")
  }
  return meta
}

// ───────────── الاستيراد ─────────────

export interface ImportDeps extends CommitDeps {
  imageStorage: Pick<ImageStorage, 'save' | 'remove'>
  /** يتحقق أن الملف صورة تُفكّ فعلاً وضمن حد البكسلات؛ يرمي إن لم يكن (يُحسب «صورة مفقودة») */
  verifyImage?: (blob: Blob) => Promise<void>
}

export interface ImportResult {
  workspace: WorkspaceMeta
  /** عناصر تالفة في الملف لم تُستورد */
  skippedItems: number
  /** بطاقات صور بلا صورة (غير موجودة في الملف أو غير صالحة) */
  missingImages: number
}

export async function importWorkspaceText(text: string, deps: ImportDeps): Promise<ImportResult> {
  const parsed = parsePackage(text, deps.now?.() ?? Date.now())
  if (!parsed.ok) throw new TransferError('invalid', parsed.message)
  const { workspace, canvas, images } = parsed.value

  // الصور: نُنشئ معرّفاً جديداً لكل صورة. إعادة استعمال المعرّفات من الملف تسمح لملف خبيث بالإشارة
  // إلى صور موجودة أصلاً لمساحات أخرى في هذا المتصفح، أو بالكتابة فوقها.
  const idMap = new Map<string, string>()
  const savedIds: string[] = []
  const removeSaved = async (): Promise<void> => {
    await Promise.all(savedIds.map((id) => deps.imageStorage.remove(id).catch(() => undefined)))
  }

  try {
    for (const [oldId, image] of images) {
      if (base64DecodedLength(image.data) === 0) continue
      let blob: Blob
      try {
        blob = base64ToBlob(image.data, image.type)
        await deps.verifyImage?.(blob)
      } catch {
        continue // ترميز تالف أو ليست صورة صالحة: تبقى بطاقتها بلا صورة
      }
      const newId = await deps.imageStorage.save(blob)
      savedIds.push(newId)
      idMap.set(oldId, newId)
    }
  } catch (error) {
    await removeSaved()
    throw new TransferError('storage', "The images couldn't be saved. Browser storage may be full or blocked.", { cause: error })
  }

  let missingImages = 0
  const nodes = canvas.nodes.map((node): CanvasNode => {
    if (node.type !== 'image') return node
    const mapped = idMap.get(node.data.imageId)
    if (mapped) return { ...node, data: { ...node.data, imageId: mapped } }
    missingImages += 1
    // معرّف جديد غير موجود: تُعرض «الصورة غير متاحة»، ولا تشير أبداً لصورة مساحة أخرى
    return { ...node, data: { ...node.data, imageId: `missing-${createId()}` } }
  })

  const created = await commitWorkspace(deps, workspace, { nodes, edges: canvas.edges, viewport: canvas.viewport }, removeSaved)
  return { workspace: created, skippedItems: canvas.discardedCount, missingImages }
}
