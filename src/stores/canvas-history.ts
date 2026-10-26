import type { CanvasEdge } from '@/features/canvas/types/edges'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import { canvasContentEqual, edgesContentEqual, nodesContentEqual } from '@/features/canvas/utils/canvas-equality'

/**
 * سجل التراجع/الإعادة بنمط «اللقطات» (snapshots). اخترناه على نمط الأوامر لأن حالة اللوحة كلها
 * بنى ثابتة (immutable): كل تعديل ينتج كائنات جديدة للعقد المتغيرة فقط، فاللقطة مصفوفتا مراجع
 * تشترك مع الحالة الحالية في كل ما لم يتغير. تكلفتها صغيرة، ولا نحتاج كتابة أمر عكسي لكل عملية
 * (وهو مصدر أخطاء شائع: أي عملية جديدة بلا عكس صحيح تكسر التراجع).
 */
export interface CanvasSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

/** أقصى عدد خطوات تراجع محفوظة. كل خطوة مصفوفتا مراجع، فالمئة خطوة رخيصة حتى للوحات كبيرة. */
export const HISTORY_LIMIT = 100

/** حركات متتالية خلال هذه المهلة (مثل ضغطات الأسهم المتكررة) تُدمج في خطوة تراجع واحدة. */
export const MOVE_COALESCE_MS = 500

/**
 * نصنّف التغيير لنقرر هل يُدمج مع الخطوة السابقة:
 *  - 'move': تغيّرت المواضع فقط (حركات الأسهم المتتالية تُدمج).
 *  - 'create': أُضيفت عقدة واحدة فقط.
 *  - 'content': تغيّرت بيانات عقدة واحدة فقط (نص مثلاً). تُدمج مع 'create' للعقدة نفسها إن جاءت بعدها
 *    مباشرة: إنشاء ورقة بالنقر المزدوج ثم الكتابة فيها خطوة واحدة، لا خطوتان (تراجع يمحو الورقة كلها).
 *  - 'edit': أي شيء آخر (حذف، حجم، وصلة، عضوية مجموعة...).
 */
export type ChangeKind = 'move' | 'create' | 'content' | 'edit'

export interface ChangeInfo {
  kind: ChangeKind
  /** العقدة المعنية في 'create' و'content' */
  nodeId: string | null
}

/** المدة القصوى بين إنشاء عقدة وأول تعديل لمحتواها كي يُعدّا خطوة واحدة */
export const CREATE_MERGE_MS = 120_000

export function snapshotsEqual(a: CanvasSnapshot, b: CanvasSnapshot): boolean {
  return canvasContentEqual(a, b)
}

export function classifyChange(before: CanvasSnapshot, after: CanvasSnapshot): ChangeInfo {
  const edit: ChangeInfo = { kind: 'edit', nodeId: null }
  if (!edgesContentEqual(before.edges, after.edges)) return edit

  // إضافة عقدة واحدة: كل العقد السابقة موجودة في اللاحقة بمحتوى مطابق.
  // نستعمل Set وMap (خطي) لا بحثاً متداخلاً (تربيعي): هذا المسار يُنفَّذ عند كل إضافة عقدة في لوحة قد تضم آلاف العقد.
  if (after.nodes.length === before.nodes.length + 1) {
    const beforeIds = new Set(before.nodes.map((node) => node.id))
    const afterById = new Map(after.nodes.map((node) => [node.id, node]))
    const added = after.nodes.filter((node) => !beforeIds.has(node.id))
    const untouched = before.nodes.every((b) => {
      const a = afterById.get(b.id)
      return a !== undefined && (a === b || nodesContentEqual([b], [a]))
    })
    const [only] = added
    return added.length === 1 && only !== undefined && untouched ? { kind: 'create', nodeId: only.id } : edit
  }

  if (before.nodes.length !== after.nodes.length) return edit
  let dataChangedId: string | null = null
  let dataChanges = 0
  let moved = false
  for (let i = 0; i < before.nodes.length; i += 1) {
    const a = before.nodes[i]
    const b = after.nodes[i]
    if (a === undefined || b === undefined || a.id !== b.id) return edit
    if (a.width !== b.width || a.height !== b.height || a.parentId !== b.parentId) return edit
    if (a.data !== b.data) {
      dataChanges += 1
      dataChangedId = a.id
    }
    if (a.position.x !== b.position.x || a.position.y !== b.position.y) moved = true
  }
  if (dataChanges === 0) return { kind: 'move', nodeId: null }
  if (dataChanges === 1 && !moved) return { kind: 'content', nodeId: dataChangedId }
  return edit
}

/** لقطة بلا تحديد: بعد التراجع لا نُعيد تحديد ما كان محدداً وقت التسجيل (سلوك متوقع وثابت). */
export function deselectSnapshot(snapshot: CanvasSnapshot): CanvasSnapshot {
  return {
    nodes: snapshot.nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
    edges: snapshot.edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
  }
}

interface Entry {
  snapshot: CanvasSnapshot
  kind: ChangeKind
  nodeId: string | null
  at: number
}

export class CanvasHistory {
  private past: Entry[] = []
  private future: Entry[] = []

  constructor(private readonly limit: number = HISTORY_LIMIT) {}

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  get undoDepth(): number {
    return this.past.length
  }

  /** يسجّل أن الحالة «قبل» تغيّرت. أي تغيير جديد يُبطل الإعادة (فرع تاريخ جديد). */
  record(before: CanvasSnapshot, change: ChangeInfo | ChangeKind, now: number): void {
    const { kind, nodeId } = typeof change === 'string' ? { kind: change, nodeId: null } : change
    this.future = []
    const last = this.past[this.past.length - 1]
    if (kind === 'move' && last?.kind === 'move' && now - last.at < MOVE_COALESCE_MS) {
      last.at = now // ندمج: نبقي أقدم لقطة (قبل أول حركة في السلسلة)
      return
    }
    if (kind === 'content' && last?.kind === 'create' && last.nodeId === nodeId && nodeId !== null && now - last.at < CREATE_MERGE_MS) {
      // الورقة وأول نص كُتب فيها: خطوة واحدة (تبقى لقطة ما قبل الإنشاء). تصبح 'edit' كي لا تمتص
      // التعديلات اللاحقة على الورقة نفسها: كل منها خطوة مستقلة
      last.kind = 'edit'
      last.at = now
      return
    }
    this.past.push({ snapshot: before, kind, nodeId, at: now })
    if (this.past.length > this.limit) this.past.shift()
  }

  undo(current: CanvasSnapshot, now: number): CanvasSnapshot | null {
    const entry = this.past.pop()
    if (!entry) return null
    this.future.push({ snapshot: current, kind: entry.kind, nodeId: entry.nodeId, at: now })
    return entry.snapshot
  }

  redo(current: CanvasSnapshot, now: number): CanvasSnapshot | null {
    const entry = this.future.pop()
    if (!entry) return null
    this.past.push({ snapshot: current, kind: entry.kind, nodeId: entry.nodeId, at: now })
    return entry.snapshot
  }

  clear(): void {
    this.past = []
    this.future = []
  }
}
