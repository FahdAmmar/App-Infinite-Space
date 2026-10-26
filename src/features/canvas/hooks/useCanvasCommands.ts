import { useMemo } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import { LIMIT_REACHED } from '@/stores/canvas-store'
import { useUiStore } from '@/stores/ui-store'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode, CreatableNodeKind } from '../types/nodes'
import { addImageFiles, intakeImageFile } from '../uploads/add-image-files'
import { IMAGE_ACCEPT_ATTRIBUTE } from '../uploads/image-validation'
import { pickFiles } from '../uploads/pick-files'
import { createNode } from '../utils/node-factory'
import { getLastPointer, type ScreenPoint } from '../utils/pointer-tracker'

export interface CanvasCommands {
  /** عقدة جديدة عند مؤشر الفأرة (أو وسط اللوحة إن لم يكن المؤشر فوقها) */
  addNodeAtPointer: (kind: CreatableNodeKind) => void
  /** عقدة جديدة عند نقطة محددة بإحداثيات الشاشة */
  addNodeAtPoint: (kind: CreatableNodeKind, screenPoint: ScreenPoint) => void
  /** يضيف ملفات صور (من الاختيار أو السحب أو اللصق) عند نقطة أو عند المؤشر */
  addImages: (files: readonly File[], screenPoint?: ScreenPoint) => Promise<void>
  /**
   * يفتح نافذة اختيار الصور ثم يضيفها. 'pointer' (الاختصار I) تضعها عند المؤشر،
   * و'center' (زر الـ dock) تضعها في وسط اللوحة لأن المؤشر وقتها فوق الـ dock نفسه، أسفل الشاشة.
   */
  pickAndAddImages: (placement?: 'pointer' | 'center') => Promise<void>
  /** يستبدل صورة بطاقة قائمة بملف يختاره المستخدم (يبقى الموضع والحجم والعنوان) */
  replaceImage: (nodeId: string) => Promise<void>
  /** يبدأ الوصل من عقدة محددة: تُفعَّل أداة الوصل وتُلتقط العقدة مصدراً */
  startConnectFrom: (nodeId: string) => void
  duplicateSelection: () => void
  deleteSelection: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  fitAll: () => void
  centerOnSelection: () => void
}

const ANIMATION_MS = 300

function reportErrors(errors: readonly string[]): void {
  if (errors.length === 0) return
  const shown = errors.slice(0, 3).join(' ')
  const more = errors.length > 3 ? ` (+${errors.length - 3} more)` : ''
  useUiStore.getState().pushToast('error', `${shown}${more}`)
}

/**
 * أوامر اللوحة في مكان واحد: الأزرار والاختصارات وزر الحالة الفارغة كلها تستدعي نفس الدوال،
 * فلا يتكرر المنطق ولا يختلف سلوك الزر عن سلوك الاختصار.
 * يجب استدعاؤه داخل <ReactFlowProvider> و <CanvasStoreProvider>.
 */
export function useCanvasCommands(): CanvasCommands {
  const flow = useReactFlow<CanvasNode, CanvasEdge>()
  const flowStore = useStoreApi()
  const canvasStore = useCanvasStoreApi()

  return useMemo<CanvasCommands>(() => {
    /** يحدد أين تُوضع العقدة: النقطة المطلوبة، وإلا المؤشر إن كان فوق اللوحة، وإلا مركزها. */
    const resolveScreenPoint = (requested?: ScreenPoint): ScreenPoint => {
      const rect = flowStore.getState().domNode?.getBoundingClientRect()
      const pointer = requested ?? getLastPointer()
      const isInside =
        pointer !== null &&
        rect !== undefined &&
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      if (isInside) return pointer
      if (rect) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    }

    const canvasCenter = (): ScreenPoint => {
      const rect = flowStore.getState().domNode?.getBoundingClientRect()
      return rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    }

    /** يتحقق من اتساع الحد قبل إضافة عناصر؛ إن لم يتسع يُبلغ المستخدم ويعيد false. */
    const hasRoom = (count: number): boolean => {
      if (canvasStore.getState().canAdd(count)) return true
      useUiStore.getState().pushToast('error', LIMIT_REACHED)
      return false
    }

    const addNodeAtPoint = (kind: CreatableNodeKind, screenPoint?: ScreenPoint) => {
      if (!hasRoom(1)) return
      const center = flow.screenToFlowPosition(resolveScreenPoint(screenPoint))
      const node = createNode(kind, center, Date.now())
      const state = canvasStore.getState()
      state.addNode(node)
      state.startEditing(node.id) // العقدة الجديدة تُفتح للكتابة فوراً
    }

    const addImages = async (files: readonly File[], screenPoint?: ScreenPoint) => {
      if (files.length === 0 || !hasRoom(1)) return
      // نحسب موضع الإسقاط قبل أي انتظار: المؤشر قد يتحرك أثناء فك الترميز والحفظ
      const center = flow.screenToFlowPosition(resolveScreenPoint(screenPoint))
      const { nodes, errors } = await addImageFiles(files, center, Date.now())
      // أُنشئت العقد بعد انتظار طويل: نتحقق ثانية من اتساع الحد (قد تغيّرت اللوحة) فلا نخسر الصور بصمت
      if (nodes.length > 0) {
        if (canvasStore.getState().canAdd(nodes.length)) canvasStore.getState().addNodes(nodes)
        else errors.push(LIMIT_REACHED)
      }
      reportErrors(errors)
    }

    return {
      addNodeAtPointer: (kind) => addNodeAtPoint(kind),
      addNodeAtPoint: (kind, screenPoint) => addNodeAtPoint(kind, screenPoint),
      addImages,
      pickAndAddImages: async (placement = 'pointer') => {
        const files = await pickFiles({ accept: IMAGE_ACCEPT_ATTRIBUTE, multiple: true })
        await addImages(files, placement === 'center' ? canvasCenter() : undefined)
      },
      replaceImage: async (nodeId) => {
        const [file] = await pickFiles({ accept: IMAGE_ACCEPT_ATTRIBUTE, multiple: false })
        if (!file) return
        try {
          const intake = await intakeImageFile(file)
          // الصورة القديمة تبقى في التخزين عمداً: ستحتاجها المرحلة 4 للتراجع، ثم تنظّفها عند الحفظ
          canvasStore.getState().updateNodeData(nodeId, 'image', {
            imageId: intake.imageId,
            fileName: intake.fileName,
            naturalWidth: intake.naturalWidth,
            naturalHeight: intake.naturalHeight,
          })
        } catch (error) {
          reportErrors([error instanceof Error ? error.message : 'The image could not be replaced.'])
        }
      },
      startConnectFrom: (nodeId) => {
        const state = canvasStore.getState()
        state.setTool('connect')
        state.setConnectSource(nodeId)
      },
      duplicateSelection: () => {
        const copies = canvasStore.getState().duplicateSelected()
        // لا نسخ إلا إن اتسع الحد؛ وإلا يبقى كل شيء كما هو ونُبلغ المستخدم
        if (copies.length === 0 && canvasStore.getState().nodes.some((node) => node.selected)) {
          useUiStore.getState().pushToast('error', LIMIT_REACHED)
        }
      },
      deleteSelection: () => canvasStore.getState().removeSelection(),
      zoomIn: () => void flow.zoomIn({ duration: 200 }),
      zoomOut: () => void flow.zoomOut({ duration: 200 }),
      resetZoom: () => void flow.zoomTo(1, { duration: 200 }),
      fitAll: () => void flow.fitView({ padding: 0.25, maxZoom: 1, duration: ANIMATION_MS }),
      centerOnSelection: () => {
        const ids = canvasStore
          .getState()
          .nodes.filter((node) => node.selected)
          .map((node) => ({ id: node.id }))
        if (ids.length === 0) return
        void flow.fitView({ nodes: ids, padding: 0.5, maxZoom: 1.25, duration: ANIMATION_MS })
      },
    }
  }, [flow, flowStore, canvasStore])
}
