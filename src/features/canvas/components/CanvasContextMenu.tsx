import { useMemo } from 'react'
import { useParams } from 'react-router'
import { selectSelectedIds } from '@/stores/canvas-selectors'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useUiStore } from '@/stores/ui-store'
import type { CanvasCommands } from '../hooks/useCanvasCommands'
import { buildCardLink } from '../utils/card-link'
import { getHeldClipboard } from '../utils/clipboard'
import { buildContextMenu, type MenuActionId, type MenuTarget } from '../utils/context-menu'
import { ContextMenuView } from './ContextMenuView'

export interface OpenMenu {
  target: MenuTarget
  point: { x: number; y: number }
}

/**
 * يربط قائمة النقر الأيمن بأوامر اللوحة نفسها التي تستدعيها الأزرار والاختصارات (لا منطق مكرر هنا).
 * عند النقر على بطاقة خارج التحديد يكون المحرر قد حدّدها قبل فتح القائمة، فتنطبق الأوامر على ما يراه المستخدم محدداً.
 */
export function CanvasContextMenu({ menu, commands, onClose }: { menu: OpenMenu; commands: CanvasCommands; onClose: () => void }) {
  const api = useCanvasStoreApi()
  const { workspaceId } = useParams()

  // تُحسب مرة لكل فتح: القائمة مؤقتة، وما يتغير تحتها لا يعنيها
  const entries = useMemo(() => {
    const state = api.getState()
    return buildContextMenu(menu.target, {
      nodes: state.nodes,
      selectedIds: selectSelectedIds(state),
      hasClipboard: getHeldClipboard() !== null,
      focusId: state.focusId,
    })
  }, [api, menu])

  const run = (id: MenuActionId) => {
    const state = api.getState()
    const { point, target } = menu
    const targetId = target.kind === 'pane' ? null : target.id
    switch (id) {
      case 'add-sticky':
        return commands.addNodeAtPoint('sticky', point)
      case 'add-text':
        return commands.addNodeAtPoint('text', point)
      case 'add-link':
        return commands.addNodeAtPoint('link', point)
      case 'add-group':
        return commands.addNodeAtPoint('group', point)
      case 'add-image':
        return void commands.pickAndAddImages(point)
      case 'paste':
        return void commands.pasteClipboard(point)
      case 'select-all':
        return state.selectAll()
      case 'fit':
        return commands.fitAll()
      case 'edit':
        return targetId === null ? undefined : state.startEditing(targetId)
      case 'duplicate':
        return commands.duplicateSelection()
      case 'copy':
        return void commands.copySelection()
      case 'cut':
        return commands.cutSelection()
      case 'connect':
        return targetId === null ? undefined : commands.startConnectFrom(targetId)
      case 'focus':
        return targetId === null ? undefined : state.setFocusId(targetId)
      case 'focus-clear':
        return state.setFocusId(null)
      case 'front':
        return state.reorderLayers(selectSelectedIds(state), 'front')
      case 'back':
        return state.reorderLayers(selectSelectedIds(state), 'back')
      case 'copy-link': {
        if (targetId === null || workspaceId === undefined) return
        const link = buildCardLink(window.location.origin, workspaceId, targetId)
        const write = navigator.clipboard?.writeText(link)
        if (!write) return useUiStore.getState().pushToast('error', 'The browser did not allow copying the link.')
        return void write.then(
          () => useUiStore.getState().pushToast('success', 'Link copied. It opens this card in this browser.'),
          () => useUiStore.getState().pushToast('error', 'The browser did not allow copying the link.'),
        )
      }
      case 'delete':
        return commands.deleteSelection()
      case 'edit-edge':
        return targetId === null ? undefined : state.selectEdge(targetId)
      case 'delete-edge':
        return targetId === null ? undefined : state.removeEdges([targetId])
    }
  }

  return (
    <ContextMenuView
      entries={entries}
      point={menu.point}
      onClose={onClose}
      onSelect={(id) => {
        onClose()
        // بعد إغلاق القائمة بدورة واحدة: يعيد المتصفح التركيز للعنصر السابق عند الإزالة، وأوامر تفتح حقلاً (التحرير) تحتاج أن تأتي بعده
        window.setTimeout(() => run(id), 0)
      }}
    />
  )
}
