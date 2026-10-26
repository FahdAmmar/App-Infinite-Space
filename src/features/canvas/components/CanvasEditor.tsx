import { useCallback, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  type Connection,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import '../styles/canvas.css'
import { useUiStore } from '@/stores/ui-store'
import { selectSelectedCount } from '@/stores/canvas-selectors'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useCanvasCommands } from '../hooks/useCanvasCommands'
import { useCanvasShortcuts } from '../hooks/useCanvasShortcuts'
import { useImagePaste } from '../hooks/useImagePaste'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { STICKY_COLORS, ZOOM_LIMITS } from '../utils/constants'
import { checkConnection } from '../utils/edge-utils'
import { setLastPointer } from '../utils/pointer-tracker'
import { CreationDock } from './CreationDock'
import { EmptyCanvasHint } from './EmptyCanvasHint'
import { ImagePreviewDialog } from './ImagePreviewDialog'
import { PlacementHint } from './PlacementHint'
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

  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const tool = useCanvasStore((state) => state.tool)
  const minimapVisible = useCanvasStore((state) => state.minimapVisible)
  // تحديد متعدد: نخفي مقابض الحجم والوصل عن البطاقات المحددة (ازدحام بصري، والإجراء المقصود هو التحريك الجماعي)
  const multiSelected = useCanvasStore((state) => selectSelectedCount(state) > 1)
  const applyNodeChanges = useCanvasStore((state) => state.applyNodeChanges)
  const applyEdgeChanges = useCanvasStore((state) => state.applyEdgeChanges)
  const theme = useUiStore((state) => state.theme)
  const [connecting, setConnecting] = useState(false)
  const [fileDragOver, setFileDragOver] = useState(false)
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
      return checkConnection(state.nodes, state.edges, connection.source, connection.target).ok
    },
    [api],
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
      data-connecting={connecting}
      data-multi-select={multiSelected}
      data-file-drag={fileDragOver}
      onPointerMove={handlePointerMove}
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
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={applyNodeChanges}
        onEdgesChange={applyEdgeChanges}
        onConnect={handleConnect}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={() => setConnecting(false)}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: 'var(--edge-to)', strokeWidth: 2.5, strokeLinecap: 'round' }}
        onPaneClick={handlePaneClick}
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
        nodesDraggable={tool !== 'hand' && tool !== 'connect'}
        nodesConnectable={tool !== 'hand'}
        elementsSelectable={tool !== 'hand' && tool !== 'connect'}
        edgesReconnectable={false}
        // نتسامح مع اهتزاز بسيط أثناء النقر كي لا يتحول النقر إلى سحب بالخطأ
        nodeDragThreshold={3}
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
        {minimapVisible && (
          <MiniMap<CanvasNode>
            pannable
            zoomable
            nodeColor={minimapNodeColor}
            nodeBorderRadius={3}
            ariaLabel="Canvas minimap"
            // فوق مجموعة التحكم السفلية (وأعلى منها تحت 900px حيث ترتفع المجموعة فوق الـ dock كي لا يتقاطعا)
            className="mb-[68px]! max-[900px]:mb-[152px]!"
          />
        )}
        <ToolPalette />
        <CreationDock commands={commands} />
        <ZoomControls commands={commands} />
        <PlacementHint />
        <SelectionToolbar commands={commands} />
      </ReactFlow>
      <PropertiesPanel commands={commands} />
      <EmptyCanvasHint commands={commands} />
      <ImagePreviewDialog />
      {fileDragOver && (
        <div aria-hidden="true" className="drop-overlay">
          Drop images to add them
        </div>
      )}
    </div>
  )
}
