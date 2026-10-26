import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react'
import { createStore, type StoreApi } from 'zustand'
import type { CanvasEdge, CanvasEdgeData } from '@/features/canvas/types/edges'
import type { SaveStatus } from '@/features/canvas/types/persistence'
import type {
  CanvasNode,
  CanvasNodeType,
  CanvasTool,
  GroupData,
  ImageCardData,
  LinkCardData,
  StickyNoteData,
  TextCardData,
} from '@/features/canvas/types/nodes'
import { CANVAS_LIMITS, getResizeLimits } from '@/features/canvas/utils/constants'
import { checkConnection, createEdge, edgeFromConnection, pickHandleSides } from '@/features/canvas/utils/edge-utils'
import {
  reconcileAllMembership,
  reconcileMembership,
  releaseChildren,
  sortGroupsFirst,
} from '@/features/canvas/utils/group-utils'
import { duplicateNodes } from '@/features/canvas/utils/node-factory'
import {
  CanvasHistory,
  classifyChange,
  deselectSnapshot,
  snapshotsEqual,
  type CanvasSnapshot,
} from './canvas-history'

/** الحقول التي يجوز تعديلها لكل نوع عقدة (الباقي — التواريخ — تديره المخزن). */
export interface NodePatchMap {
  sticky: Partial<Pick<StickyNoteData, 'title' | 'content' | 'color' | 'textColor' | 'tags'>>
  text: Partial<Pick<TextCardData, 'title' | 'content' | 'tags'>>
  image: Partial<Pick<ImageCardData, 'title' | 'description' | 'tags' | 'imageId' | 'fileName' | 'naturalWidth' | 'naturalHeight'>>
  link: Partial<Pick<LinkCardData, 'url' | 'title' | 'description' | 'tags'>>
  group: Partial<Pick<GroupData, 'label' | 'color' | 'tags'>>
}

/** رسالة موحّدة عند بلوغ حد اللوحة */
export const LIMIT_REACHED = `This workspace has reached its limit of ${CANVAS_LIMITS.maxNodes.toLocaleString('en-US')} items. Delete some to add more.`

export type ConnectResult = { ok: true; edgeId: string } | { ok: false; reason: string }

/** نتيجة نقرة بأداة الوصل: التقاط المصدر، أو إلغاؤه، أو إتمام الوصل، أو الرفض بسبب مقروء. */
export type ClickConnectResult =
  | { status: 'picked' }
  | { status: 'cleared' }
  | { status: 'connected'; edgeId: string }
  | { status: 'rejected'; reason: string }

export interface CanvasState {
  // ── المحتوى ──
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  // ── حالة المحرر (واجهة فقط، لا تُحفظ مع المساحة) ──
  tool: CanvasTool
  /** العقدة التي يجري تحرير نصها الآن (واحدة كحد أقصى) */
  editingNodeId: string | null
  /** مصدر الوصل المنتظر الهدف عند استخدام أداة الوصل بالنقر */
  connectSource: string | null
  /** بطاقة الصورة المفتوحة في المعاينة الكبيرة */
  previewNodeId: string | null
  minimapVisible: boolean
  panelCollapsed: boolean
  shortcutsOpen: boolean
  // ── عرض اللوحة والحفظ والتاريخ ──
  /** آخر عرض (إزاحة وتكبير) للوحة؛ يُحفظ مع المحتوى ويُستعاد عند الفتح. تغييره لا يدخل سجل التراجع. */
  viewport: Viewport
  saveStatus: SaveStatus
  canUndo: boolean
  canRedo: boolean

  /** يطبّق تغييرات React Flow (سحب، تحديد، تغيير حجم، حذف) على العقد. */
  applyNodeChanges: (changes: NodeChange<CanvasNode>[]) => void
  applyEdgeChanges: (changes: EdgeChange<CanvasEdge>[]) => void
  /** هل يتسع حد اللوحة لإضافة هذا العدد من العقد (ومعها هذا العدد من الوصلات)؟ */
  canAdd: (nodeCount: number, edgeCount?: number) => boolean
  /** يضيف عقدة ويحدّدها وحدها. */
  addNode: (node: CanvasNode) => void
  /** يضيف عدة عقد دفعة واحدة ويحدّدها كلها. */
  addNodes: (nodes: CanvasNode[]) => void
  updateNodeData: <K extends CanvasNodeType>(id: string, type: K, patch: NodePatchMap[K]) => void
  updateStickyNote: (id: string, patch: NodePatchMap['sticky']) => void
  updateTextCard: (id: string, patch: NodePatchMap['text']) => void
  /** يغيّر الحجم ضمن حدود النوع. الصور: العرض فقط (الارتفاع يتبع النسبة). */
  resizeNode: (id: string, size: { width?: number; height?: number }) => void
  removeNodes: (ids: readonly string[]) => void
  removeEdges: (ids: readonly string[]) => void
  /** يحذف كل ما هو محدد: عقداً ووصلات. */
  removeSelection: () => void
  /** يكرّر العقد المحددة (ومعها أعضاء المجموعات والوصلات الداخلية) ويحدّد النسخ؛ يعيد معرّفاتها. */
  duplicateSelected: () => string[]
  selectAll: () => void
  clearSelection: () => void
  selectEdge: (id: string) => void

  connectNodes: (connection: Connection) => ConnectResult
  clickConnect: (nodeId: string) => ClickConnectResult
  setConnectSource: (id: string | null) => void
  updateEdge: (id: string, patch: Partial<CanvasEdgeData>) => void

  /** إعادة تقييم عضوية المجموعات للعقد المعطاة (بعد السحب) أو لكلها (بعد تغيير حجم مجموعة). */
  reconcileMembership: (ids: readonly string[]) => void
  reconcileAllMembership: () => void

  setTool: (tool: CanvasTool) => void
  startEditing: (id: string) => void
  stopEditing: (id?: string) => void
  setPreviewNode: (id: string | null) => void
  toggleMinimap: () => void
  togglePanel: () => void
  setShortcutsOpen: (open: boolean) => void

  setViewport: (viewport: Viewport) => void
  setSaveStatus: (status: SaveStatus) => void
  /** يتراجع عن آخر عملية. يعيد false إن لم يكن هناك ما يُتراجع عنه. */
  undo: () => boolean
  redo: () => boolean
  /**
   * يجمع كل ما يحدث بين begin و end في خطوة تراجع واحدة (سحب عقدة، تغيير حجم): التغييرات الوسيطة
   * (كل حركة مؤشر) لا تُسجَّل، وعند end تُسجَّل خطوة واحدة إن تغيّر شيء فعلاً.
   */
  beginTransaction: () => void
  endTransaction: () => void
}

export type CanvasStoreApi = StoreApi<CanvasState>

interface CanvasStoreOptions {
  initialNodes?: CanvasNode[]
  initialEdges?: CanvasEdge[]
  initialViewport?: Viewport
  /** حدود الحجم (تُخفَّض في الاختبارات فقط) */
  limits?: { maxNodes: number; maxEdges: number }
  minimapVisible?: boolean
  panelCollapsed?: boolean
}

/** وصلات سليمة فقط: لا تبقى وصلة طرفها عقدة محذوفة. تعيد المصفوفة نفسها إن لم يتغير شيء. */
function dropDanglingEdges(edges: CanvasEdge[], nodes: readonly CanvasNode[]): CanvasEdge[] {
  const ids = new Set(nodes.map((node) => node.id))
  const kept = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  return kept.length === edges.length ? edges : kept
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * مخزن اللوحة: نسخة مستقلة لكل محرر مفتوح (انظر CanvasStoreProvider).
 * سبب النسخة لكل محرر بدل مخزن عام: فتح مساحة ثانية يبدأ من حالة نظيفة بدل تسرّب عقد المساحة السابقة،
 * ويسهل اختبار المخزن بمعزل. كل تعديل للعقد والوصلات يمر عبر الأفعال أدناه فقط، فيمكن في المرحلة 4
 * تغليفها بسجل التراجع/الإعادة دون لمس المكوّنات.
 */
export function createCanvasStore(options: CanvasStoreOptions = {}): CanvasStoreApi {
  const history = new CanvasHistory()
  const limits = options.limits ?? CANVAS_LIMITS
  // لقطة «قبل» لأول تغيير في الدفعة الحالية (تُسجَّل في نهاية الدفعة)، ولقطة المعاملة الجارية
  let pendingBefore: CanvasSnapshot | null = null
  let transactionBefore: CanvasSnapshot | null = null
  let applyingHistory = false
  let readState: () => CanvasState = () => {
    throw new Error('canvas store is not initialized')
  }

  const currentSnapshot = (): CanvasSnapshot => {
    const { nodes, edges } = readState()
    return { nodes, edges }
  }

  const record = (before: CanvasSnapshot): void => {
    const after = currentSnapshot()
    if (snapshotsEqual(before, after)) return
    history.record(before, classifyChange(before, after), Date.now())
  }

  /**
   * كل تعديلات المخزن المتزامنة (دفعة واحدة، مثل حذف عقد ووصلاتها بخطوتين) تصبح خطوة تراجع واحدة:
   * نلتقط الحالة قبل أول تغيير ونسجّلها عند نهاية الدفعة. ننهيها يدوياً قبل أي تراجع/إعادة
   * كي لا يفوت الأمر تغييراً لم تنتهِ دفعته بعد.
   */
  const flushPending = (): void => {
    const before = pendingBefore
    pendingBefore = null
    if (before) record(before)
  }

  const store = createStore<CanvasState>()((set, get) => {
    readState = get
    const syncHistoryFlags = (): void => {
      const { canUndo, canRedo } = get()
      if (canUndo !== history.canUndo || canRedo !== history.canRedo) {
        set({ canUndo: history.canUndo, canRedo: history.canRedo })
      }
    }

    const applySnapshot = (snapshot: CanvasSnapshot): void => {
      const restored = deselectSnapshot(snapshot)
      const ids = new Set(restored.nodes.map((node) => node.id))
      applyingHistory = true
      try {
        set((state) => ({
          nodes: restored.nodes,
          edges: restored.edges,
          editingNodeId: null,
          connectSource: null,
          previewNodeId: state.previewNodeId && ids.has(state.previewNodeId) ? state.previewNodeId : null,
          canUndo: history.canUndo,
          canRedo: history.canRedo,
        }))
      } finally {
        applyingHistory = false
      }
    }

    return {
    nodes: options.initialNodes ?? [],
    edges: options.initialEdges ?? [],
    tool: 'select',
    editingNodeId: null,
    connectSource: null,
    previewNodeId: null,
    minimapVisible: options.minimapVisible ?? true,
    panelCollapsed: options.panelCollapsed ?? false,
    shortcutsOpen: false,
    viewport: options.initialViewport ?? { x: 0, y: 0, zoom: 1 },
    saveStatus: { kind: 'saved', at: null },
    canUndo: false,
    canRedo: false,

    applyNodeChanges: (changes) =>
      set((state) => {
        // حذف مجموعة عبر React Flow يجب ألا يجرف أعضاءها: نطلقهم أولاً (قاعدة 4 في group-utils)
        const removed = new Set(changes.flatMap((change) => (change.type === 'remove' ? [change.id] : [])))
        const removedGroups = new Set(
          state.nodes.filter((node) => node.type === 'group' && removed.has(node.id)).map((node) => node.id),
        )
        const base = releaseChildren(state.nodes, removedGroups, removed)
        const nodes = applyNodeChanges(changes, base)
        const ids = new Set(nodes.map((node) => node.id))
        return {
          nodes,
          edges: removed.size > 0 ? dropDanglingEdges(state.edges, nodes) : state.edges,
          // إن حُذفت العقدة قيد التحرير ننهي التحرير كي لا يبقى المؤشر يشير إلى عقدة غير موجودة
          editingNodeId: state.editingNodeId && ids.has(state.editingNodeId) ? state.editingNodeId : null,
          connectSource: state.connectSource && ids.has(state.connectSource) ? state.connectSource : null,
          previewNodeId: state.previewNodeId && ids.has(state.previewNodeId) ? state.previewNodeId : null,
        }
      }),

    applyEdgeChanges: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

    canAdd: (nodeCount, edgeCount = 0) =>
      get().nodes.length + nodeCount <= limits.maxNodes && get().edges.length + edgeCount <= limits.maxEdges,

    addNode: (node) => get().addNodes([node]),

    addNodes: (added) =>
      set((state) => {
        if (added.length === 0) return state
        // حد حجم اللوحة (انظر CANVAS_LIMITS): لا نضيف شيئاً إن كان سيتجاوزه. المستدعي يُبلغ المستخدم عبر canAddNodes.
        if (state.nodes.length + added.length > limits.maxNodes) return state
        // نُنشئ كائنات جديدة فقط للعناصر التي كانت محددة؛ الباقي يحتفظ بمراجعه فلا يُعاد رسمه
        const deselectedNodes = state.nodes.map((existing) => (existing.selected ? { ...existing, selected: false } : existing))
        const deselectedEdges = state.edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge))
        const combined = sortGroupsFirst([...deselectedNodes, ...added.map((node) => ({ ...node, selected: true }))])
        // عقدة تُنشأ فوق مجموعة تنضم إليها فوراً (قاعدة العضوية بالمركز)
        const nodes = reconcileMembership(combined, new Set(added.map((node) => node.id)))
        return { nodes, edges: deselectedEdges }
      }),

    updateNodeData: (id, type, patch) =>
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id && node.type === type
            ? // التعديل يبقى ضمن حقول النوع نفسه (يضمنه NodePatchMap)، لكن TypeScript لا يتتبع الارتباط بين
              // type و data عبر التوزيع على الاتحاد، فنؤكد النوع هنا في موضع واحد بدل تكراره في كل فعل.
              ({ ...node, data: { ...node.data, ...patch, updatedAt: Date.now() } } as CanvasNode)
            : node,
        ),
      })),

    updateStickyNote: (id, patch) => get().updateNodeData(id, 'sticky', patch),
    updateTextCard: (id, patch) => get().updateNodeData(id, 'text', patch),

    resizeNode: (id, size) =>
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== id) return node
          const limits = getResizeLimits(node.type)
          const width = size.width === undefined ? node.width : clamp(Math.round(size.width), limits.minWidth, limits.maxWidth)
          if (node.type === 'image') return { ...node, width }
          const height =
            size.height === undefined ? node.height : clamp(Math.round(size.height), limits.minHeight, limits.maxHeight)
          return { ...node, width, height }
        }),
      })),

    removeNodes: (ids) =>
      set((state) => {
        const doomed = new Set(ids)
        const doomedGroups = new Set(
          state.nodes.filter((node) => node.type === 'group' && doomed.has(node.id)).map((node) => node.id),
        )
        const released = releaseChildren(state.nodes, doomedGroups, doomed)
        const nodes = released.filter((node) => !doomed.has(node.id))
        return {
          nodes,
          edges: dropDanglingEdges(state.edges, nodes),
          editingNodeId: state.editingNodeId && doomed.has(state.editingNodeId) ? null : state.editingNodeId,
          connectSource: state.connectSource && doomed.has(state.connectSource) ? null : state.connectSource,
          previewNodeId: state.previewNodeId && doomed.has(state.previewNodeId) ? null : state.previewNodeId,
        }
      }),

    removeEdges: (ids) =>
      set((state) => {
        const doomed = new Set(ids)
        return { edges: state.edges.filter((edge) => !doomed.has(edge.id)) }
      }),

    removeSelection: () => {
      const { nodes, edges } = get()
      const nodeIds = nodes.filter((node) => node.selected).map((node) => node.id)
      const edgeIds = edges.filter((edge) => edge.selected).map((edge) => edge.id)
      if (nodeIds.length > 0) get().removeNodes(nodeIds)
      if (edgeIds.length > 0) get().removeEdges(edgeIds)
    },

    duplicateSelected: () => {
      const { nodes, edges } = get()
      const selected = nodes.filter((node) => node.selected)
      if (selected.length === 0) return []
      const copy = duplicateNodes(selected, nodes, edges, Date.now())
      if (!get().canAdd(copy.nodes.length, copy.edges.length)) return []
      set((state) => ({
        nodes: sortGroupsFirst([
          ...state.nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
          ...copy.nodes,
        ]),
        edges: [...state.edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)), ...copy.edges],
      }))
      return copy.nodes.map((node) => node.id)
    },

    selectAll: () =>
      set((state) => ({ nodes: state.nodes.map((node) => (node.selected ? node : { ...node, selected: true })) })),

    clearSelection: () =>
      set((state) => ({
        nodes: state.nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
        edges: state.edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
      })),

    selectEdge: (id) =>
      set((state) => ({
        nodes: state.nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
        edges: state.edges.map((edge) => (edge.selected === (edge.id === id) ? edge : { ...edge, selected: edge.id === id })),
      })),

    connectNodes: (connection) => {
      const { nodes, edges } = get()
      const check = checkConnection(nodes, edges, connection.source, connection.target)
      if (!check.ok) return check
      if (!get().canAdd(0, 1)) return { ok: false, reason: LIMIT_REACHED }
      const edge = edgeFromConnection(connection)
      set((state) => ({
        edges: [...state.edges.map((e) => (e.selected ? { ...e, selected: false } : e)), { ...edge, selected: true }],
        nodes: state.nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
      }))
      return { ok: true, edgeId: edge.id }
    },

    clickConnect: (nodeId) => {
      const { nodes, edges, connectSource } = get()
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return { status: 'rejected', reason: 'That item no longer exists.' }
      if (node.type === 'group') {
        return { status: 'rejected', reason: 'Groups organize items and cannot be connected. Pick an item inside it.' }
      }
      if (connectSource === null) {
        set({ connectSource: nodeId })
        return { status: 'picked' }
      }
      if (connectSource === nodeId) {
        set({ connectSource: null })
        return { status: 'cleared' }
      }
      const check = checkConnection(nodes, edges, connectSource, nodeId)
      if (!check.ok) return { status: 'rejected', reason: check.reason }
      if (!get().canAdd(0, 1)) return { status: 'rejected', reason: LIMIT_REACHED }
      const source = nodes.find((n) => n.id === connectSource)
      if (!source) return { status: 'rejected', reason: 'The first item no longer exists.' }
      const sides = pickHandleSides(source, node, new Map(nodes.map((n) => [n.id, n])))
      const edge = createEdge(source.id, node.id, sides.sourceHandle, sides.targetHandle)
      set((state) => ({
        edges: [...state.edges.map((e) => (e.selected ? { ...e, selected: false } : e)), { ...edge, selected: true }],
        nodes: state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        connectSource: null,
        tool: 'select',
      }))
      return { status: 'connected', edgeId: edge.id }
    },

    setConnectSource: (connectSource) => set({ connectSource }),

    updateEdge: (id, patch) =>
      set((state) => ({
        edges: state.edges.map((edge) =>
          edge.id === id && edge.data ? { ...edge, data: { ...edge.data, ...patch } } : edge,
        ),
      })),

    reconcileMembership: (ids) => set((state) => ({ nodes: reconcileMembership(state.nodes, new Set(ids)) })),
    reconcileAllMembership: () => set((state) => ({ nodes: reconcileAllMembership(state.nodes) })),

    // مغادرة أداة الوصل تُسقط المصدر المعلّق كي لا يبقى مميّزاً بلا سبب
    setTool: (tool) => set((state) => ({ tool, connectSource: tool === 'connect' ? state.connectSource : null })),
    startEditing: (id) => set({ editingNodeId: id, tool: 'select', connectSource: null }),
    // stopEditing(id) لا يفعل شيئاً إن كان التحرير انتقل لعقدة أخرى (يمنع سباق blur/focus بين عقدتين)
    stopEditing: (id) => set((state) => (id === undefined || state.editingNodeId === id ? { editingNodeId: null } : state)),
    setPreviewNode: (previewNodeId) => set({ previewNodeId }),
    toggleMinimap: () => set((state) => ({ minimapVisible: !state.minimapVisible })),
    togglePanel: () => set((state) => ({ panelCollapsed: !state.panelCollapsed })),
    setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

    setViewport: (viewport) => set({ viewport }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),

    undo: () => {
      flushPending()
      const target = history.undo(currentSnapshot(), Date.now())
      if (!target) return false
      applySnapshot(target)
      return true
    },
    redo: () => {
      flushPending()
      const target = history.redo(currentSnapshot(), Date.now())
      if (!target) return false
      applySnapshot(target)
      return true
    },
    beginTransaction: () => {
      flushPending()
      // معاملة قائمة (لم تُغلق لسبب ما) تُمدَّد بدل أن نفقد لقطة بدايتها
      transactionBefore ??= currentSnapshot()
    },
    endTransaction: () => {
      const before = transactionBefore
      transactionBefore = null
      if (before) {
        record(before)
        syncHistoryFlags()
      }
    },
    }
  })

  // تسجيل التاريخ: نراقب تغيّر العقد/الوصلات (المحتوى فقط) ونجمع الدفعة المتزامنة في خطوة واحدة
  store.subscribe((state, previous) => {
    if (applyingHistory) return
    if (state.nodes === previous.nodes && state.edges === previous.edges) return
    const before: CanvasSnapshot = { nodes: previous.nodes, edges: previous.edges }
    if (snapshotsEqual(before, { nodes: state.nodes, edges: state.edges })) return // تحديد/قياس فقط
    if (transactionBefore) return // داخل معاملة: تُسجَّل عند endTransaction
    if (pendingBefore === null) {
      pendingBefore = before
      queueMicrotask(() => {
        flushPending()
        const { canUndo, canRedo } = store.getState()
        if (canUndo !== history.canUndo || canRedo !== history.canRedo) {
          store.setState({ canUndo: history.canUndo, canRedo: history.canRedo })
        }
      })
    }
  })

  return store
}
