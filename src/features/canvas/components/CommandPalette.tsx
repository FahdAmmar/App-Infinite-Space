import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { selectSelectedIds } from '@/stores/canvas-selectors'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useUiStore } from '@/stores/ui-store'
import { exportViewerToFile } from '@/features/workspaces/actions/transfer-actions'
import { usePersistence } from '../persistence/persistence-context'
import { useSnippetStore } from '@/stores/snippet-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { createId } from '@/lib/id'
import type { CanvasEdge } from '../types/edges'
import { layoutColumnsByStatus, layoutTree } from '../utils/arrange'
import { setHeldClipboard } from '../utils/clipboard'
import { createSnippet, snippetToClipboard, type Snippet } from '../utils/snippets'
import { useCanvasCommands } from '../hooks/useCanvasCommands'
import type { CanvasNode } from '../types/nodes'
import { collectTags } from '../utils/tag-filter'
import { CommandPaletteView, type PaletteItem } from './CommandPaletteView'

const EMPTY_NODES: readonly CanvasNode[] = []

/**
 * لوحة الأوامر (Ctrl/⌘+K): كل ما يمكن فعله من الأزرار والاختصارات في مكان واحد قابل للبحث، وقفز إلى مساحة أخرى.
 * لا منطق جديداً هنا: كل أمر يستدعي الدالة نفسها التي يستدعيها زره أو اختصاره، فلا يختلف سلوكه.
 * تُركّب داخل ReactFlowProvider و CanvasStoreProvider لأن الأوامر تحتاج كليهما.
 */
const REASONS = {
  'nothing-selected': 'Select some cards first.',
  'only-images': 'Image cards can’t be saved in a snippet. Select some notes, text or links too.',
  'too-large': 'That selection is too large for a snippet.',
} as const

function saveSnippet(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): void {
  const toast = useUiStore.getState().pushToast
  const result = createSnippet(nodes, edges, createId(), Date.now())
  if (!result.ok) return toast('error', REASONS[result.reason])
  if (!useSnippetStore.getState().addSnippet(result.snippet)) return toast('error', 'You have reached the snippet limit. Delete one from the command palette first.')
  const skipped = result.skippedImages > 0 ? ` ${result.skippedImages} image ${result.skippedImages === 1 ? 'card was' : 'cards were'} left out.` : ''
  toast('success', `Saved snippet “${result.snippet.name}”. Find it in the command palette.${skipped}`)
}

/** يضع المقتطف في الحافظة الداخلية ثم يلصقه: يحصل على المعرّفات الجديدة والإزاحة نفسها كأي لصق، ويمكن لصقه ثانية بـ Ctrl/⌘+V. */
function insertSnippet(snippet: Snippet, paste: () => boolean): void {
  const clip = snippetToClipboard(snippet, Date.now())
  if (clip === null) return useUiStore.getState().pushToast('error', 'That snippet is empty or damaged.')
  setHeldClipboard(clip)
  paste()
}

export function CommandPalette({ workspaceId }: { workspaceId: string }) {
  const api = useCanvasStoreApi()
  const navigate = useNavigate()
  const commands = useCanvasCommands()
  const open = useCanvasStore((state) => state.paletteOpen)
  const hasSelection = useCanvasStore((state) => selectSelectedIds(state).length > 0)
  const minimapVisible = useCanvasStore((state) => state.minimapVisible)
  const tagFilter = useCanvasStore((state) => state.tagFilter)
  const focusId = useCanvasStore((state) => state.focusId)
  // أمر التركيز يخص بطاقة واحدة غير مجموعة محددة
  const focusTargetId = useCanvasStore((state) => {
    const ids = selectSelectedIds(state)
    const only = ids.length === 1 ? state.nodes.find((node) => node.id === ids[0]) : undefined
    return only && only.type !== 'group' ? only.id : null
  })
  // الوسوم لا تُحسب إلا والحوار مفتوح: القائمة تُبنى عند كل تغيّر في اللوحة، ومسح كل البطاقات مكلف على لوحة كبيرة
  const nodesWhileOpen = useCanvasStore((state) => (state.paletteOpen ? state.nodes : EMPTY_NODES))
  const tags = useMemo(() => collectTags(nodesWhileOpen), [nodesWhileOpen])
  const theme = useUiStore((state) => state.theme)
  const themeMode = useUiStore((state) => state.themeMode)
  const highContrast = useUiStore((state) => state.highContrast)
  const snapToGrid = useUiStore((state) => state.snapToGrid)
  const compressImages = useUiStore((state) => state.compressImages)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const { flush } = usePersistence()
  const snippets = useSnippetStore((state) => state.snippets)

  const items = useMemo<PaletteItem[]>(() => {
    const state = () => api.getState()
    const ui = () => useUiStore.getState()
    const arrangeSelection = (mode: 'tree' | 'columns') => {
      const { nodes, edges, moveNodes } = state()
      const selected = nodes.filter((node) => node.selected)
      const placements = mode === 'tree' ? layoutTree(selected, nodes, edges) : layoutColumnsByStatus(selected, nodes)
      if (placements.length > 0) moveNodes(placements)
      else ui().pushToast('info', selected.filter((node) => node.type !== 'group').length < 2 ? 'Select at least two cards to arrange.' : 'The cards are already arranged.')
    }
    const selectedIds = () => state().nodes.filter((node) => node.selected).map((node) => node.id)
    const list: PaletteItem[] = [
      { id: 'add-sticky', title: 'Add sticky note', group: 'Create', hint: 'N', keywords: ['card', 'new'], run: () => commands.addNodeAtPointer('sticky') },
      { id: 'add-text', title: 'Add text card', group: 'Create', hint: 'T', keywords: ['card', 'new', 'writing'], run: () => commands.addNodeAtPointer('text') },
      { id: 'add-link', title: 'Add link card', group: 'Create', hint: 'L', keywords: ['url', 'web', 'address'], run: () => commands.addNodeAtPointer('link') },
      { id: 'add-checklist', title: 'Add checklist', group: 'Create', hint: 'K', keywords: ['todo', 'tasks', 'list', 'checkbox'], run: () => commands.addNodeAtPointer('checklist') },
      { id: 'add-video', title: 'Add YouTube video card', group: 'Create', hint: 'Y', keywords: ['youtube', 'movie', 'embed', 'clip'], run: () => commands.addNodeAtPointer('video') },
      { id: 'add-shape', title: 'Add shape', group: 'Create', hint: 'S', keywords: ['rectangle', 'ellipse', 'circle', 'diamond', 'box'], run: () => commands.addNodeAtPointer('shape') },
      { id: 'add-image', title: 'Add image…', group: 'Create', keywords: ['picture', 'photo', 'upload'], run: () => void commands.pickAndAddImages('center') },
      { id: 'add-group', title: 'Add group', group: 'Create', keywords: ['frame', 'container', 'section'], run: () => commands.addNodeAtPointer('group') },
      { id: 'undo', title: 'Undo', group: 'Edit', hint: 'Ctrl/⌘ Z', run: () => state().undo() },
      { id: 'redo', title: 'Redo', group: 'Edit', hint: 'Ctrl/⌘ ⇧ Z', run: () => state().redo() },
      { id: 'select-all', title: 'Select all', group: 'Edit', hint: 'Ctrl/⌘ A', run: () => state().selectAll() },
    ]
    if (hasSelection) {
      list.push(
        { id: 'duplicate', title: 'Duplicate selection', group: 'Edit', hint: 'Ctrl/⌘ D', keywords: ['copy', 'clone'], run: commands.duplicateSelection },
        { id: 'delete', title: 'Delete selection', group: 'Edit', hint: 'Del', keywords: ['remove'], run: commands.deleteSelection },
        { id: 'arrange-tree', title: 'Arrange selection as a tree', group: 'Edit', keywords: ['mind map', 'layout', 'hierarchy', 'connections'], run: () => arrangeSelection('tree') },
        { id: 'arrange-columns', title: 'Arrange selection in columns by status', group: 'Edit', keywords: ['kanban', 'board', 'layout', 'done', 'todo'], run: () => arrangeSelection('columns') },
        { id: 'status-done', title: 'Mark selection as done', group: 'Edit', keywords: ['complete', 'finished', 'check', 'status'], run: () => state().setNodesStatus(selectedIds(), 'done') },
        { id: 'status-doing', title: 'Mark selection as in progress', group: 'Edit', keywords: ['working', 'status', 'doing'], run: () => state().setNodesStatus(selectedIds(), 'doing') },
        { id: 'status-none', title: 'Clear status of selection', group: 'Edit', keywords: ['reset', 'status'], run: () => state().setNodesStatus(selectedIds(), 'none') },
        { id: 'lock', title: 'Lock selection', group: 'Edit', keywords: ['freeze', 'pin', 'protect'], run: () => state().setNodesLocked(selectedIds(), true) },
        { id: 'unlock', title: 'Unlock selection', group: 'Edit', keywords: ['unfreeze', 'unpin'], run: () => state().setNodesLocked(selectedIds(), false) },
        { id: 'zoom-selection', title: 'Zoom to selection', group: 'View', hint: '⇧ 2', keywords: ['focus', 'center'], run: commands.centerOnSelection },
      )
    }
    if (focusTargetId !== null && focusId !== focusTargetId) {
      list.push({ id: 'focus-branch', title: 'Focus on this card’s branch', group: 'Filter', hint: 'F', keywords: ['connected', 'upstream', 'downstream', 'isolate', 'path'], run: () => state().setFocusId(focusTargetId) })
    }
    if (focusId !== null) {
      list.push({ id: 'focus-clear', title: 'Clear focus (show all cards)', group: 'Filter', hint: 'Esc', keywords: ['branch', 'reset'], run: () => state().setFocusId(null) })
    }
    if (tagFilter !== null) {
      list.push({ id: 'tag-clear', title: 'Show all cards (clear the tag filter)', group: 'Filter', hint: 'Esc', keywords: ['tag', 'reset'], run: () => state().setTagFilter(null) })
    }
    for (const { tag, count } of tags) {
      list.push({
        id: `tag-${tag.toLowerCase()}`,
        title: `Show only #${tag} (${count} ${count === 1 ? 'card' : 'cards'})`,
        group: 'Filter',
        keywords: ['tag', 'filter', 'label'],
        run: () => state().setTagFilter(tag),
      })
    }
    list.push(
      { id: 'present', title: 'Start presentation (each group is a slide)', group: 'View', hint: 'P', keywords: ['slides', 'present', 'show', 'talk', 'deck'], run: commands.startPresentation },
      {
        id: 'export-viewer',
        title: 'Save a read-only copy as an HTML page',
        group: 'File',
        keywords: ['export', 'share', 'download', 'html', 'archive', 'viewer'],
        run: () => {
          const current = workspaces.find((workspace) => workspace.id === workspaceId)
          if (!current) return
          // نكتب آخر تعديل أولاً: التصدير يقرأ من التخزين لا من الذاكرة
          void flush().then(() => exportViewerToFile(current))
        },
      },
      { id: 'outline', title: 'Show outline (list of groups and cards)', group: 'View', hint: 'O', keywords: ['navigator', 'list', 'jump', 'tree', 'screen reader', 'accessible'], run: () => state().setOutlineOpen(!state().outlineOpen) },
      { id: 'find', title: 'Find on canvas', group: 'Search', hint: 'Ctrl/⌘ F', keywords: ['search', 'tag'], run: () => state().setFindOpen(true) },
      { id: 'fit', title: 'Fit all content', group: 'View', hint: '⇧ 1', keywords: ['overview', 'zoom'], run: commands.fitAll },
      { id: 'zoom-reset', title: 'Reset zoom to 100%', group: 'View', run: commands.resetZoom },
      { id: 'zoom-in', title: 'Zoom in', group: 'View', hint: '+', run: commands.zoomIn },
      { id: 'zoom-out', title: 'Zoom out', group: 'View', hint: '−', run: commands.zoomOut },
      { id: 'minimap', title: minimapVisible ? 'Hide minimap' : 'Show minimap', group: 'View', keywords: ['map', 'overview'], run: () => state().toggleMinimap() },
      { id: 'snap', title: snapToGrid ? 'Turn off snap to grid' : 'Turn on snap to grid', group: 'View', keywords: ['align', 'dots'], run: () => ui().setSnapToGrid(!snapToGrid) },
      { id: 'theme', title: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', group: 'View', keywords: ['mode', 'appearance', 'dark', 'light'], run: () => ui().toggleTheme() },
      { id: 'theme-system', title: themeMode === 'system' ? 'Following the system appearance (switch the theme to stop)' : 'Follow the system appearance', group: 'View', keywords: ['theme', 'auto', 'automatic', 'dark', 'light', 'os'], run: () => ui().setThemeMode('system') },
      { id: 'contrast', title: highContrast ? 'Turn off high contrast' : 'Turn on high contrast', group: 'View', keywords: ['accessibility', 'readable', 'appearance', 'borders'], run: () => ui().setHighContrast(!highContrast) },
      {
        id: 'compress-images',
        title: compressImages ? 'Keep original quality for new images' : 'Compress new images to save space',
        group: 'Settings',
        keywords: ['picture', 'photo', 'webp', 'size', 'storage', 'export'],
        run: () => ui().setCompressImages(!compressImages),
      },
      { id: 'shortcuts', title: 'Show keyboard shortcuts', group: 'Help', hint: '?', keywords: ['keys', 'help'], run: () => state().setShortcutsOpen(true) },
      { id: 'all-workspaces', title: 'Go to all workspaces', group: 'Go', keywords: ['dashboard', 'home', 'back'], run: () => navigate('/') },
    )
    // مقتطفات شخصية: حفظ التحديد، ثم إدراج كل مقتطف أو حذفه (الاسم من أول بطاقة؛ الحذف وإعادة الحفظ بديل إعادة التسمية)
    if (hasSelection) {
      list.push({
        id: 'save-snippet',
        title: 'Save selection as a snippet',
        group: 'Snippets',
        keywords: ['template', 'reuse', 'library', 'save', 'copy'],
        run: () => saveSnippet(api.getState().nodes, api.getState().edges),
      })
    }
    for (const snippet of snippets) {
      list.push({ id: `snippet-insert-${snippet.id}`, title: `Insert snippet: ${snippet.name}`, group: 'Snippets', keywords: ['paste', 'template'], run: () => insertSnippet(snippet, commands.pasteClipboard) })
      list.push({ id: `snippet-delete-${snippet.id}`, title: `Delete snippet: ${snippet.name}`, group: 'Snippets', keywords: ['remove'], run: () => useSnippetStore.getState().removeSnippet(snippet.id) })
    }
    // أحدث المساحات أولاً؛ المساحة الحالية لا تُعرض (أنت فيها)
    for (const workspace of [...workspaces].sort((a, b) => b.updatedAt - a.updatedAt)) {
      if (workspace.id === workspaceId) continue
      list.push({ id: `open-${workspace.id}`, title: `Open workspace: ${workspace.name}`, group: 'Go', run: () => navigate(`/w/${workspace.id}`) })
    }
    return list
  }, [api, commands, compressImages, flush, focusId, snippets, focusTargetId, hasSelection, minimapVisible, navigate, snapToGrid, tagFilter, tags, theme, themeMode, highContrast, workspaceId, workspaces])

  const close = () => api.getState().setPaletteOpen(false)

  return (
    <CommandPaletteView
      open={open}
      items={items}
      onClose={close}
      onRun={(item) => {
        close()
        // بعد إغلاق الحوار بدورة واحدة: يعيد المتصفح التركيز للعنصر السابق عند الإغلاق، وهذا ما يسرق التركيز
        // من أوامر تفتح حقلاً (البحث) إن نُفذت في الدورة نفسها
        window.setTimeout(item.run, 0)
      }}
    />
  )
}
