import { useEffect } from 'react'
import { selectSelectedIds } from '@/stores/canvas-selectors'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import { isTypingTarget } from '../utils/dom'
import type { CanvasCommands } from './useCanvasCommands'

/**
 * اختصارات لوحة المفاتيح على مستوى النافذة.
 * تُعطَّل أثناء الكتابة، وأثناء تحرير نص عقدة، وعند فتح أي نافذة حوار.
 * (التحرك بالأسهم والتحديد بالمسافة يتولاهما React Flow نفسه؛ أما الحذف فمن هنا.)
 */
export function useCanvasShortcuts(commands: CanvasCommands): void {
  const store = useCanvasStoreApi()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      if (isTypingTarget(event.target)) return
      if (document.querySelector('dialog[open]')) return

      const state = store.getState()
      if (state.editingNodeId !== null) return

      const modifier = event.metaKey || event.ctrlKey

      if (modifier) {
        if (event.altKey) return
        const key = event.key.toLowerCase()
        if (key === 'd') {
          event.preventDefault() // يمنع "إضافة للمفضلة" في المتصفح
          commands.duplicateSelection()
        } else if (key === 'a') {
          event.preventDefault()
          state.selectAll()
        } else if (key === 'z') {
          // Ctrl/⌘+Z تراجع، وبإضافة Shift إعادة. (داخل الحقول النصية يتولاها المتصفح لأننا نتجاهل تلك الأحداث)
          event.preventDefault()
          if (event.shiftKey) state.redo()
          else state.undo()
        } else if (key === 'y') {
          event.preventDefault()
          state.redo()
        }
        return
      }
      if (event.altKey) return

      // الأرقام عبر event.code لأن Shift+1 يعطي "!" في بعض التخطيطات
      if (event.shiftKey && event.code === 'Digit1') {
        event.preventDefault()
        commands.fitAll()
        return
      }
      if (event.shiftKey && event.code === 'Digit2') {
        event.preventDefault()
        commands.centerOnSelection()
        return
      }

      switch (event.key) {
        case 'v':
        case 'V':
          state.setTool('select')
          break
        case 'h':
        case 'H':
          state.setTool('hand')
          break
        case 'n':
        case 'N':
          event.preventDefault()
          commands.addNodeAtPointer('sticky')
          break
        case 't':
        case 'T':
          event.preventDefault()
          commands.addNodeAtPointer('text')
          break
        case 'l':
        case 'L':
          event.preventDefault()
          commands.addNodeAtPointer('link')
          break
        case 'g':
        case 'G':
          event.preventDefault()
          commands.addNodeAtPointer('group')
          break
        case 'i':
        case 'I':
          event.preventDefault()
          void commands.pickAndAddImages()
          break
        case 'c':
        case 'C':
          state.setTool('connect')
          break
        case 'Delete':
        case 'Backspace':
          // الحذف بأنفسنا (لا بمفتاح React Flow) كي نطبّق قواعد المجموعات وحذف الوصلات المحددة بالتساوي
          event.preventDefault()
          commands.deleteSelection()
          break
        case 'F2': {
          const ids = selectSelectedIds(state)
          const only = ids.length === 1 ? state.nodes.find((node) => node.id === ids[0]) : undefined
          // الصور لا تحرير نصياً مضمّناً لها (عنوانها ووصفها من لوحة الخصائص)
          if (only && only.type !== 'image') {
            event.preventDefault()
            state.startEditing(only.id)
          }
          break
        }
        case '+':
        case '=':
          commands.zoomIn()
          break
        case '-':
        case '_':
          commands.zoomOut()
          break
        case '?':
          state.setShortcutsOpen(true)
          break
        case 'Escape':
          if (state.tool !== 'select') state.setTool('select')
          else state.clearSelection()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [store, commands])
}
