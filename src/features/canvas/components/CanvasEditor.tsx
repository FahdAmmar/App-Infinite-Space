import { useCallback, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  type Connection,
  type FinalConnectionState,
  type OnConnectEnd,
  type OnConnectStart,
  useStore,
  type OnNodeDrag,
  type ReactFlowProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import '../styles/canvas.css'
import { useUiStore } from '@/stores/ui-store'
import { selectSelectedCount } from '@/stores/canvas-selectors'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useCanvasCommands } from '../hooks/useCanvasCommands'
import { useCardLink } from '../hooks/useCardLink'
import { useLongPress } from '../hooks/useLongPress'
import { useCanvasShortcuts } from '../hooks/useCanvasShortcuts'
import { useImagePaste } from '../hooks/useImagePaste'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { STICKY_COLORS, ZOOM_LIMITS } from '../utils/constants'
import { isIntentionalDrag } from '../utils/connected-card'
import { resolveFocus, viewDimming } from '../utils/focus-branch'
import { dimEdgesWhere, dimNodesWhere } from '../utils/tag-filter'
import { checkConnection, isHandleSide, rejectedDropReason } from '../utils/edge-utils'
import { eventClientPoint } from '../utils/event-point'
import { setLastPointer } from '../utils/pointer-tracker'
import { labelScale } from '../utils/semantic-zoom'
import type { MenuTarget } from '../utils/context-menu'
import { CanvasContextMenu, type OpenMenu } from './CanvasContextMenu'
import { CreationDock } from './CreationDock'
import { EmptyCanvasHint } from './EmptyCanvasHint'
import { FirstRunChecklist } from './FirstRunChecklist'
import { FocusPill } from './FocusPill'
import { FindBar } from './FindBar'
import { ImagePreviewDialog } from './ImagePreviewDialog'
import { OutlinePanel } from './OutlinePanel'
import { PlacementHint } from './PlacementHint'
import { PresentationMode } from './PresentationMode'
import { TagFilterPill } from './TagFilterPill'
import { PropertiesPanel } from './PropertiesPanel'
import { SelectionToolbar } from './SelectionToolbar'
import { ToolPalette } from './ToolPalette'
import { ZoomControls } from './ZoomControls'
import { edgeTypes } from './edges/edge-types'
import { nodeTypes } from './nodes/node-types'

const minimapNodeColor = (node: CanvasNode): string => {
  if (node.type === 'sticky') return STICKY_COLORS[node.data.color].bg
  if (node.type === 'group') return STICKY_COLORS[node.data.color].border
  return 'var(--c-line)'
}

/** هل في الحدث ملفات؟ (السحب من نظام الملفات؛ لا نعترض سحب نص أو عناصر الصفحة) */
function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/**
 * نصوص مساعدة قارئ الشاشة للوحة (React Flow يقرأها عند التركيز على عنصر بلوحة المفاتيح).
 * نصف ما يفعله تطبيقنا فعلاً: الأسهم تحرّك، Enter/Space تحدد، Delete تحذف، والوصل بأداة C أو من المقابض.
 */
const ARIA_LABELS = {
  'node.a11yDescription.default':
    'Press Enter or Space to select this card. With a card selected, use the arrow keys to move it, Delete to remove it, F2 to edit its text, and C to connect it to another card.',
  'node.a11yDescription.keyboardDisabled': 'Press Enter or Space to select this card.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }: { direction: string; x: number; y: number }) =>
    `Card moved ${direction}. New position: ${Math.round(x)}, ${Math.round(y)}.`,
  'edge.a11yDescription.default': 'Press Enter or Space to select this connection. Press Delete to remove it.',
  'controls.ariaLabel': 'Canvas controls',
  'minimap.ariaLabel': 'Canvas minimap',
} as const

const SNAP_GRID: [number, number] = [20, 20]

const PLACEMENT_TOOLS = ['sticky', 'text', 'link', 'group'] as const

function isPlacementTool(tool: string): tool is (typeof PLACEMENT_TOOLS)[number] {
  return PLACEMENT_TOOLS.some((candidate) => candidate === tool)
}

/**
 * اللوحة اللانهائية: React Flow مضبوط وفق تفاعلات المواصفات.
 * - السحب على الخلفية يحرّك اللوحة؛ Shift+سحب يحدد مجموعة؛ المسافة+سحب تحرّك مؤقتاً.
 * - أداة اليد تعطّل تحريك العقد وتحديدها (تنقّل فقط)؛ أداة الوصل تعطّل التحديد لأن النقر فيها يختار طرفي الوصلة.
 * - المقابض (النقاط على جوانب البطاقة) تُسحب لإنشاء وصلة؛ وضع الوصل «loose» يسمح بالوصل من أي مقبض إلى أي مقبض.
 * - النقر المزدوج على الخلفية أو على جسم مجموعة ينشئ ورقة (لذلك عُطّل تكبير النقر المزدوج الافتراضي).
 * - الحذف عبر أوامرنا (deleteKeyCode معطّل) كي تُطبَّق قواعد المجموعات والوصلات في مكان واحد.
 */
export function CanvasEditor() {
  const api = useCanvasStoreApi()
  const commands = useCanvasCommands()
  useCanvasShortcuts(commands)
  useImagePaste(commands)
  useCardLink(commands)

  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const tagFilter = useCanvasStore((state) => state.tagFilter)
  const focusId = useCanvasStore((state) => state.focusId)
  // أثناء العرض التقديمي: الواجهة المحيطة مخفية والتحرير معطّل (انظر PresentationMode)
  const presenting = useCanvasStore((state) => state.presentation !== null)
  // أثناء تصفية وسم أو التركيز على فرع نمرّر إلى React Flow نسخاً مخفّتة؛ المخزن والبيانات المحفوظة لا تتغير، وبدون أيٍّ منهما لا كلفة إضافية.
  // الفرع يُحسب فقط حين يكون التركيز فعّالاً (وبطاقته موجودة)
  const dimming = useMemo(() => viewDimming(tagFilter, resolveFocus(nodes, edges, focusId)), [nodes, edges, tagFilter, focusId])
  const shownNodes = useMemo(() => (dimming === null ? nodes : dimNodesWhere(nodes, dimming)), [nodes, dimming])
  const shownEdges = useMemo(() => (dimming === null ? edges : dimEdgesWhere(edges, nodes, dimming)), [edges, nodes, dimming])
  const tool = useCanvasStore((state) => state.tool)
  const minimapVisible = useCanvasStore((state) => state.minimapVisible)
  // تحديد متعدد: نخفي مقابض الحجم والوصل عن البطاقات المحددة (ازدحام بصري، والإجراء المقصود هو التحريك الجماعي)
  const multiSelected = useCanvasStore((state) => selectSelectedCount(state) > 1)
  const applyNodeChanges = useCanvasStore((state) => state.applyNodeChanges)
  const applyEdgeChanges = useCanvasStore((state) => state.applyEdgeChanges)
  const theme = useUiStore((state) => state.theme)
  const snapToGrid = useUiStore((state) => state.snapToGrid)
  // عند التصغير الشديد تكبر عناوين المجموعات كي تبقى مقروءة (انظر semantic-zoom.ts)
  const groupLabelScale = useStore((state) => labelScale(state.transform[2]))
  const [connecting, setConnecting] = useState(false)
  const [fileDragOver, setFileDragOver] = useState(false)
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  // العرض المحفوظ يُقرأ مرة واحدة عند الفتح؛ بعدها React Flow هو صاحب العرض ونحفظ ما ينتهي إليه
  const [initialViewport] = useState(() => api.getState().viewport)

  const handlePaneClick = useCallback(
    (event: MouseEvent) => {
      const state = api.getState()
      if (isPlacementTool(state.tool)) {
        commands.addNodeAtPoint(state.tool, { x: event.clientX, y: event.clientY })
      } else if (state.tool === 'connect') {
        state.setConnectSource(null)
      }
    },
    [api, commands],
  )

  const handleNodeClick = useCallback(
    (event: MouseEvent, node: CanvasNode) => {
      const state = api.getState()
      if (state.tool === 'connect') {
        const result = state.clickConnect(node.id)
        if (result.status === 'rejected') useUiStore.getState().pushToast('error', result.reason)
        return
      }
      // المجموعة تغطي مساحة كبيرة: النقر عليها بأداة إنشاء يجب أن يضع العنصر داخلها لا أن يُبتلع
      if (isPlacementTool(state.tool) && node.type === 'group') {
        commands.addNodeAtPoint(state.tool, { x: event.clientX, y: event.clientY })
      }
    },
    [api, commands],
  )

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (api.getState().tool === 'hand') return
      // المقصود الخلفية الفارغة أو جسم المجموعة؛ العقد واللوحات العائمة تتجاهل (وشريط عنوان المجموعة يوقف الحدث بنفسه)
      if (!(event.target instanceof Element)) return
      if (!event.target.classList.contains('react-flow__pane') && !event.target.classList.contains('group-body')) return
      commands.addNodeAtPoint('sticky', { x: event.clientX, y: event.clientY })
    },
    [api, commands],
  )

  // الوصلة التي يُسحب طرفها الآن: تُستثنى من فحص «المكررة» كي يمكن نقل طرفها إلى مقبض آخر في العقدة نفسها
  const reconnectingRef = useRef<string | null>(null)

  const handleReconnect = useCallback(
    (oldEdge: CanvasEdge, connection: Connection) => {
      const result = api.getState().reconnectEdge(oldEdge.id, connection)
      if (!result.ok) useUiStore.getState().pushToast('error', result.reason)
    },
    [api],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      const result = api.getState().connectNodes(connection)
      if (!result.ok) useUiStore.getState().pushToast('error', result.reason)
    },
    [api],
  )

  const isValidConnection = useCallback(
    (connection: Connection | CanvasEdge) => {
      const state = api.getState()
      const others = state.edges.filter((edge) => edge.id !== reconnectingRef.current)
      return checkConnection(state.nodes, others, connection.source, connection.target).ok
    },
    [api],
  )

  // React Flow يرفض الإفلات غير الصالح على بطاقة بصمت (isValidConnection)، فنشرح السبب هنا بعد انتهاء السحب
  const explainRejectedDrop = useCallback(
    (state: FinalConnectionState, fixedNodeId: string, draggedEnd: 'source' | 'target', ignoreEdgeId: string | null) => {
      if (state.isValid !== false || !state.toNode) return
      const { nodes: allNodes, edges: allEdges } = api.getState()
      const others = allEdges.filter((edge) => edge.id !== ignoreEdgeId)
      const reason = rejectedDropReason(allNodes, others, fixedNodeId, state.toNode.id, draggedEnd)
      if (reason) useUiStore.getState().pushToast('error', reason)
    },
    [api],
  )

  // أين بدأ سحب المقبض (بكسل الشاشة): نقرة بسيطة على المقبض لا يجب أن تُنشئ بطاقة
  const connectStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleConnectStart = useCallback<OnConnectStart>((event) => {
    setConnecting(true)
    connectStartRef.current = eventClientPoint(event)
  }, [])

  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, state) => {
      setConnecting(false)
      const start = connectStartRef.current
      connectStartRef.current = null
      if (!state.fromNode) return
      if (state.toNode) {
        // السحب بدأ من مقبض مصدر: البطاقة الهدف تصبح target، وإلا فالعكس
        explainRejectedDrop(state, state.fromNode.id, state.fromHandle?.type === 'target' ? 'source' : 'target', null)
        return
      }
      // إفلات على لوحة فارغة: بطاقة جديدة موصولة (إن كان سحباً مقصوداً من مقبض معروف)
      const end = eventClientPoint(event)
      const side = state.fromHandle?.id
      if (start && end && isHandleSide(side) && isIntentionalDrag(start, end)) {
        commands.addConnectedNode(state.fromNode.id, side, end)
      }
    },
    [commands, explainRejectedDrop],
  )

  const handleReconnectEnd = useCallback<NonNullable<ReactFlowProps<CanvasNode, CanvasEdge>['onReconnectEnd']>>(
    (_event, edge, handleType, state) => {
      reconnectingRef.current = null
      // الطرف المسحوب هو handleType؛ الطرف الآخر ثابت
      explainRejectedDrop(state, handleType === 'source' ? edge.target : edge.source, handleType, edge.id)
    },
    [explainRejectedDrop],
  )

  // بعد السحب نعيد تقييم عضوية المجموعات للعقد التي حُرِّكت
  // السحب كله (وما يتبعه من تغيير العضوية) خطوة تراجع واحدة لا مئات الخطوات
  const handleNodeDragStart = useCallback<OnNodeDrag<CanvasNode>>(() => {
    api.getState().beginTransaction()
  }, [api])

  const handleNodeDragStop = useCallback<OnNodeDrag<CanvasNode>>(
    (_event, _node, dragged) => {
      api.getState().reconcileMembership(dragged.map((node) => node.id))
      api.getState().endTransaction()
    },
    [api],
  )

  const handleSelectionDragStart = useCallback(() => {
    api.getState().beginTransaction()
  }, [api])

  const handleSelectionDragStop = useCallback(
    (_event: unknown, dragged: CanvasNode[]) => {
      api.getState().reconcileMembership(dragged.map((node) => node.id))
      api.getState().endTransaction()
    },
    [api],
  )

  // قائمة النقر الأيمن: تُحدَّد البطاقة المنقورة أولاً إن لم تكن ضمن التحديد، فتنطبق الأوامر على ما يراه المستخدم محدداً
  const openMenu = useCallback(
    (target: MenuTarget, point: { x: number; y: number }) => {
      const state = api.getState()
      if (state.presentation !== null) return
      if (target.kind === 'node' && !state.nodes.some((node) => node.id === target.id && node.selected)) state.selectNodes([target.id])
      if (target.kind === 'edge') state.selectEdge(target.id)
      setMenu({ target, point })
    },
    [api],
  )
  const closeMenu = useCallback(() => setMenu(null), [])

  const handleContextMenu = useCallback(
    (event: Pick<globalThis.MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>, target: MenuTarget) => {
      event.preventDefault() // بدل قائمة المتصفح
      openMenu(target, { x: event.clientX, y: event.clientY })
    },
    [openMenu],
  )

  // اللمس: الضغط المطوّل على بطاقة أو على الخلفية يفتح القائمة نفسها
  const longPress = useLongPress(
    useCallback(
      (point: { x: number; y: number }, element: Element) => {
        const nodeElement = element.closest('.react-flow__node')
        const nodeId = nodeElement?.getAttribute('data-id')
        if (nodeId) openMenu({ kind: 'node', id: nodeId }, point)
        else if (element.classList.contains('react-flow__pane')) openMenu({ kind: 'pane' }, point)
      },
      [openMenu],
    ),
  )

  const handlePointerMove = useCallback((event: PointerEvent) => {
    setLastPointer({ x: event.clientX, y: event.clientY })
  }, [])

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault() // بدونه يرفض المتصفح الإفلات
    event.dataTransfer.dropEffect = 'copy'
    setFileDragOver(true)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    setFileDragOver(false)
    void commands.addImages(Array.from(event.dataTransfer.files), { x: event.clientX, y: event.clientY })
  }

  return (
    <div
      className="canvas-root relative h-full w-full"
      data-tool={tool}
      data-presenting={presenting ? '' : undefined}
      data-connecting={connecting}
      data-multi-select={multiSelected}
      data-file-drag={fileDragOver}
      style={{ '--label-scale': groupLabelScale } as CSSProperties}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={(event) => {
        handlePointerMove(event)
        longPress.onPointerMove(event)
      }}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onPointerLeave={() => setLastPointer(null)}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        // نتجاهل مغادرة العناصر الداخلية؛ المقصود الخروج من اللوحة كلها
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setFileDragOver(false)
      }}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={shownNodes}
        edges={shownEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={applyNodeChanges}
        onEdgesChange={applyEdgeChanges}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: 'var(--edge-to)', strokeWidth: 2.5, strokeLinecap: 'round' }}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={(event) => handleContextMenu(event, { kind: 'pane' })}
        onNodeContextMenu={(event, node) => handleContextMenu(event, { kind: 'node', id: node.id })}
        onEdgeContextMenu={(event, edge) => handleContextMenu(event, { kind: 'edge', id: edge.id })}
        onSelectionContextMenu={(event, selected) => {
          const first = selected[0]
          if (first) handleContextMenu(event, { kind: 'node', id: first.id })
        }}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onSelectionDragStart={handleSelectionDragStart}
        onSelectionDragStop={handleSelectionDragStop}
        onMoveEnd={(_event, viewport) => api.getState().setViewport(viewport)}
        colorMode={theme}
        minZoom={ZOOM_LIMITS.min}
        maxZoom={ZOOM_LIMITS.max}
        defaultViewport={initialViewport}
        zoomOnDoubleClick={false}
        nodesDraggable={!presenting && tool !== 'hand' && tool !== 'connect'}
        nodesConnectable={!presenting && tool !== 'hand'}
        elementsSelectable={!presenting && tool !== 'hand' && tool !== 'connect'}
        // سحب طرف وصلة لنقلها يعمل بأداة التحديد فقط (اليد والوصل لهما معنى آخر للسحب)
        edgesReconnectable={!presenting && tool === 'select'}
        onReconnectStart={(_event, edge) => {
          reconnectingRef.current = edge.id
        }}
        onReconnect={handleReconnect}
        onReconnectEnd={handleReconnectEnd}
        // نتسامح مع اهتزاز بسيط أثناء النقر كي لا يتحول النقر إلى سحب بالخطأ
        nodeDragThreshold={3}
        // الشبكة بحجم نقاط الخلفية (gap=20) كي يتطابق ما يُرى بما يُلتقط
        snapToGrid={snapToGrid}
        snapGrid={SNAP_GRID}
        paneClickDistance={3}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
        deleteKeyCode={null}
        // لا نرسم إلا العناصر الظاهرة: يبقي اللوحات الكبيرة سلسة
        onlyRenderVisibleElements
        ariaLabelConfig={ARIA_LABELS}
        proOptions={{ hideAttribution: false }}
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.3} />
        {minimapVisible && !presenting && (
          <MiniMap<CanvasNode>
            pannable
            zoomable
            nodeColor={minimapNodeColor}
            nodeBorderRadius={3}
            ariaLabel="Canvas minimap"
            // فوق مجموعة التحكم السفلية (وأعلى منها تحت 1100px حيث ترتفع المجموعة فوق الـ dock كي لا يتقاطعا).
            // على الهاتف تبقى المجموعة في صف واحد (انظر ZoomControls)، فلا نحتاج ارتفاعاً إضافياً
            className="mb-[68px]! max-[1100px]:mb-[152px]!"
          />
        )}
        {!presenting && (
          <>
            <ToolPalette />
            <CreationDock commands={commands} />
            <ZoomControls commands={commands} />
            <PlacementHint />
            <TagFilterPill />
            <FocusPill />
            <FirstRunChecklist />
            <SelectionToolbar commands={commands} />
          </>
        )}
        <PresentationMode />
      </ReactFlow>
      {!presenting && (
        <>
          <PropertiesPanel commands={commands} />
          <FindBar commands={commands} />
          <OutlinePanel commands={commands} />
          <EmptyCanvasHint commands={commands} />
        </>
      )}
      <ImagePreviewDialog />
      {menu !== null && <CanvasContextMenu menu={menu} commands={commands} onClose={closeMenu} />}
      {fileDragOver && (
        <div aria-hidden="true" className="drop-overlay">
          Drop images to add them
        </div>
      )}
    </div>
  )
}
