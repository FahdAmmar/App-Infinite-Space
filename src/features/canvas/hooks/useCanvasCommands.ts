import { useMemo } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import { LIMIT_REACHED } from '@/stores/canvas-store'
import { useUiStore } from '@/stores/ui-store'
import type { CanvasEdge, HandleSide } from '../types/edges'
import type { CanvasNode, CreatableNodeKind } from '../types/nodes'
import { addImageFiles, intakeImageFile } from '../uploads/add-image-files'
import { IMAGE_ACCEPT_ATTRIBUTE } from '../uploads/image-validation'
import { pickFiles } from '../uploads/pick-files'
import {
  buildClipboard,
  clipboardMarker,
  getHeldClipboard,
  preparePaste,
  setHeldClipboard,
} from '../utils/clipboard'
import { planConnectedCard } from '../utils/connected-card'
import { orderSlides } from '../utils/presentation'
import { MAX_PASTE_CARDS, planTextPaste } from '../utils/text-paste'
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
  pickAndAddImages: (placement?: 'pointer' | 'center' | ScreenPoint) => Promise<void>
  /** يستبدل صورة بطاقة قائمة بملف يختاره المستخدم (يبقى الموضع والحجم والعنوان) */
  replaceImage: (nodeId: string) => Promise<void>
  /**
   * ينشئ ورقة جديدة عند نقطة الشاشة موصولة بالبطاقة المعطاة من جهة المقبض الذي بدأ منه السحب، في خطوة تراجع واحدة،
   * ثم يفتحها للكتابة. يُستعمل حين يُفلت سحب مقبض على لوحة فارغة.
   */
  addConnectedNode: (fromNodeId: string, side: HandleSide, screenPoint: ScreenPoint) => void
  /**
   * يبدأ العرض التقديمي: كل مجموعة شريحة بترتيب القراءة، ويبدأ من المجموعة المحددة إن وُجدت.
   * بلا مجموعات يشرح للمستخدم ما ينقصه بدل أن يفعل شيئاً غامضاً.
   */
  startPresentation: () => void
  /** يبدأ الوصل من عقدة محددة: تُفعَّل أداة الوصل وتُلتقط العقدة مصدراً */
  startConnectFrom: (nodeId: string) => void
  duplicateSelection: () => void
  /** ينسخ المحدد (مع أعضاء المجموعات والوصلات بينها)؛ false إن لم يكن هناك محدد */
  copySelection: () => boolean
  cutSelection: () => void
  /** يلصق الحافظة الداخلية عند المؤشر (أو عند نقطة محددة، مثل مكان القائمة)؛ false إن كانت فارغة (فيترك المتصفح اللصق لشأنه) */
  pasteClipboard: (screenPoint?: ScreenPoint) => boolean
  /**
   * يحوّل نصاً ملصوقاً إلى بطاقات عند المؤشر (رابط صريح بطاقة رابط، وكل فقرة بطاقة) ويحددها؛ false إن لم يكن فيه ما يُنشأ.
   * لا يتعامل مع الجملة التعريفية لبطاقات التطبيق: ذلك مسار pasteClipboard.
   */
  pasteText: (text: string) => boolean
  deleteSelection: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  fitAll: () => void
  centerOnSelection: () => void
  /** يحدد البطاقة وحدها ويحرّك العرض إليها (للبحث على اللوحة) */
  focusNode: (nodeId: string) => void
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

    const copySelection = (): boolean => {
      const { nodes, edges } = canvasStore.getState()
      const clip = buildClipboard(nodes, edges)
      if (!clip) return false
      setHeldClipboard(clip)
      // جملة تعريفية في حافظة النظام: بدونها قد تتقدم صورة قديمة نُسخت من خارج التطبيق على البطاقات عند اللصق.
      // الكتابة قد تُرفض (سياق غير آمن): نتجاهل الفشل، والبطاقات تبقى في الحافظة الداخلية.
      void navigator.clipboard?.writeText(clipboardMarker(clip.nodes.length)).catch(() => undefined)
      return true
    }

    const pasteClipboard = (screenPoint?: ScreenPoint): boolean => {
      const clip = getHeldClipboard()
      if (!clip) return false
      if (!hasRoom(clip.nodes.length)) return true
      const target = flow.screenToFlowPosition(resolveScreenPoint(screenPoint))
      const ids = canvasStore.getState().pasteItems(preparePaste(clip, target, Date.now()))
      // الوصلات قد تتجاوز حدها حتى لو اتسعت البطاقات
      if (ids.length === 0) useUiStore.getState().pushToast('error', LIMIT_REACHED)
      return true
    }

    return {
      addNodeAtPointer: (kind) => addNodeAtPoint(kind),
      addNodeAtPoint: (kind, screenPoint) => addNodeAtPoint(kind, screenPoint),
      addImages,
      pickAndAddImages: async (placement = 'pointer') => {
        const files = await pickFiles({ accept: IMAGE_ACCEPT_ATTRIBUTE, multiple: true })
        await addImages(files, placement === 'center' ? canvasCenter() : placement === 'pointer' ? undefined : placement)
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
      addConnectedNode: (fromNodeId, side, screenPoint) => {
        const from = canvasStore.getState().nodes.find((node) => node.id === fromNodeId)
        if (!from || from.type === 'group') return // المجموعات لا تُوصل
        if (!hasRoom(1)) return
        const plan = planConnectedCard(from, side, flow.screenToFlowPosition(screenPoint), Date.now())
        // بطاقة ووصلتها معاً: خطوة تراجع واحدة، والبطاقة تُحدَّد ثم تُفتح للكتابة فوراً
        if (canvasStore.getState().pasteItems({ nodes: [plan.node], edges: [plan.edge] }).length === 0) {
          useUiStore.getState().pushToast('error', LIMIT_REACHED)
          return
        }
        canvasStore.getState().startEditing(plan.node.id)
      },
      startPresentation: () => {
        const state = canvasStore.getState()
        const slides = orderSlides(state.nodes)
        if (slides.length === 0) {
          useUiStore.getState().pushToast('info', 'Add a group first: each group becomes one slide.')
          return
        }
        state.startPresentation(
          slides.map((slide) => slide.id),
          Math.max(0, slides.findIndex((slide) => slide.selected)),
        )
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
      copySelection,
      cutSelection: () => {
        if (copySelection()) canvasStore.getState().removeSelection()
      },
      pasteClipboard,
      pasteText: (text) => {
        const plan = planTextPaste(text, flow.screenToFlowPosition(resolveScreenPoint()), Date.now())
        if (plan.nodes.length === 0) return false
        if (!hasRoom(plan.nodes.length)) return true
        canvasStore.getState().pasteItems({ nodes: plan.nodes, edges: [] })
        if (plan.skippedParagraphs > 0) {
          useUiStore.getState().pushToast('info', `Pasted the first ${MAX_PASTE_CARDS} paragraphs; the rest were left out.`)
        } else if (plan.truncatedCards > 0) {
          useUiStore.getState().pushToast('info', 'A very long paragraph was cut to fit one card.')
        }
        return true
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
      focusNode: (nodeId) => {
        canvasStore.getState().selectNodes([nodeId])
        void flow.fitView({ nodes: [{ id: nodeId }], padding: 0.6, maxZoom: 1.25, duration: ANIMATION_MS })
      },
    }
  }, [flow, flowStore, canvasStore])
}
