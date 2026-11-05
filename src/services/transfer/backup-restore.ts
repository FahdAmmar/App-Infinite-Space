import { deserializeCanvas, type DecodedCanvas } from '@/features/canvas/persistence/canvas-codec'
import type { WorkspaceInput, WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { DEFAULT_COLOR, DEFAULT_ICON } from '@/features/workspaces/utils/constants'
import { sanitizeWorkspace } from '@/services/persistence/local-storage-adapter'
import { TransferError } from './transfer-error'
import { commitWorkspace, type CommitDeps } from './workspace-transfer'

/**
 * استرجاع النسخ الاحتياطية «غير المقروءة». النسخة حُفظت لأن القراءة العادية فشلت (تلف أو إصدار أحدث)،
 * لذلك نقرأها هنا بتساهل: نُنقذ ما يُفهم منها ونعدّ المتروك، وتبقى النسخة الأصلية كما هي حتى يحذفها المستخدم.
 */

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** يعيد لوحة منقَذة، أو null إن لم يُفهم منها شيء. */
export function salvageCanvas(raw: unknown, now: number = Date.now()): DecodedCanvas | null {
  const value = asJson(raw)
  if (!isRecord(value) || !Array.isArray(value.nodes)) return null
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
  const { viewport } = value
  const decoded = deserializeCanvas(
    {
      schemaVersion: 1,
      nodes: value.nodes,
      edges: Array.isArray(value.edges) ? value.edges : [],
      viewport: isRecord(viewport) && finite(viewport.x) && finite(viewport.y) && finite(viewport.zoom) ? { x: viewport.x, y: viewport.y, zoom: viewport.zoom } : { x: 0, y: 0, zoom: 1 },
    },
    now,
  )
  return decoded.nodes.length > 0 ? decoded : null
}

/** يعيد المساحات المفهومة من نسخة قائمة المساحات (بمعرّفاتها الأصلية كي ترتبط بلوحاتها المحفوظة). */
export function salvageWorkspaces(raw: unknown, now: number = Date.now()): WorkspaceMeta[] {
  const value = asJson(raw)
  if (!isRecord(value) || !Array.isArray(value.workspaces)) return []
  const seen = new Set<string>()
  const result: WorkspaceMeta[] = []
  for (const entry of value.workspaces) {
    const workspace = sanitizeWorkspace(entry, now)
    if (workspace && !seen.has(workspace.id)) {
      seen.add(workspace.id)
      result.push(workspace)
    }
  }
  return result
}

export const RECOVERED_WORKSPACE_INPUT: WorkspaceInput = {
  name: 'Recovered workspace',
  description: 'Restored from a backup copy.',
  color: DEFAULT_COLOR,
  icon: DEFAULT_ICON,
}

export interface CanvasRestoreResult {
  workspace: WorkspaceMeta
  skippedItems: number
}

/**
 * يستعيد لوحة نسخة احتياطية كمساحة جديدة (لا يكتب فوق شيء). معرّفات الصور تبقى كما هي:
 * الصور محفوظة في IndexedDB تحت معرّفاتها، وتنظيف الصور لا يعمل أصلاً حين تتعذّر قراءة أي لوحة.
 */
export async function restoreCanvasBackup(raw: unknown, deps: CommitDeps): Promise<CanvasRestoreResult> {
  const canvas = salvageCanvas(raw, deps.now?.() ?? Date.now())
  if (!canvas) throw new TransferError('nothing', 'Nothing in this backup could be recovered.')
  const workspace = await commitWorkspace(deps, RECOVERED_WORKSPACE_INPUT, canvas, () => Promise.resolve())
  return { workspace, skippedItems: canvas.discardedCount }
}

export interface ListRestoreDeps {
  adopt: (workspaces: WorkspaceMeta[]) => Promise<boolean>
  existingIds: ReadonlySet<string>
  now?: () => number
}

/** يعيد المساحات غير الموجودة حالياً من نسخة القائمة؛ الموجودة تبقى كما هي (لا تعديل ولا تكرار). */
export async function restoreWorkspaceList(raw: unknown, deps: ListRestoreDeps): Promise<WorkspaceMeta[]> {
  const missing = salvageWorkspaces(raw, deps.now?.() ?? Date.now()).filter((workspace) => !deps.existingIds.has(workspace.id))
  if (missing.length === 0) throw new TransferError('nothing', 'There is nothing new to restore from this backup.')
  if (!(await deps.adopt(missing))) {
    throw new TransferError('storage', "The workspaces couldn't be restored. Browser storage may be full or blocked.")
  }
  return missing
}
