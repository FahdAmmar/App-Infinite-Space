import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ReactFlowProvider } from '@xyflow/react'
import { ArrowLeft } from 'lucide-react'
import { buttonStyles } from '@/components/ui/button-styles'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { CanvasStoreProvider } from '@/stores/CanvasStoreProvider'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { CanvasPersistenceProvider } from '../persistence/CanvasPersistenceProvider'
import { useEditorEntrance } from '../hooks/useEditorEntrance'
import { useLoadedCanvas } from '../persistence/useLoadedCanvas'
import { CanvasEditor } from '../components/CanvasEditor'
import { EditorTopBar } from '../components/EditorTopBar'
import { ShortcutsDialog } from '../components/ShortcutsDialog'

/** حالات لا يوجد فيها محرر: التحميل أو مساحة غير موجودة. */
function EditorFallback({ state, onRetry }: { state: 'loading' | 'missing' | 'error'; onRetry?: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between p-3 sm:p-4">
        <Link to="/" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Workspaces
        </Link>
        <ThemeToggle />
      </header>
      <main className="grid flex-1 place-items-center px-6 py-16">
        {state === 'loading' ? (
          <p role="status" className="text-muted">
            Loading workspace…
          </p>
        ) : state === 'error' ? (
          <div role="alert" className="max-w-md text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight">Couldn&apos;t open this workspace</h1>
            <p className="mt-3 leading-relaxed text-muted">
              The saved content could not be read from this browser&apos;s storage. Nothing was changed. Opening an empty
              canvas now could overwrite your saved work, so it is not offered. Try again, or go back.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={onRetry} className={buttonStyles({ variant: 'primary' })}>
                Try again
              </button>
              <Link to="/" className={buttonStyles({ variant: 'secondary' })}>
                Back to workspaces
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-md text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight">Workspace not found</h1>
            <p className="mt-3 leading-relaxed text-muted">
              It may have been deleted, or it was created in a different browser. Workspaces are stored locally and
              don&apos;t sync between devices.
            </p>
            <Link to="/" className={buttonStyles({ variant: 'primary', className: 'mt-6' })}>
              Back to workspaces
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

/**
 * يحمّل لوحة المساحة (مع التحقق) ثم يبني المحرر. المخزن والمزوّد يُنشآن بعد اكتمال القراءة فقط،
 * فلا يظهر محرر فارغ ثم يتبدّل محتواه، ولا يبدأ الحفظ التلقائي قبل أن نعرف ما هو محفوظ.
 */
function LoadedEditor({ workspace }: { workspace: WorkspaceMeta }) {
  const [attempt, setAttempt] = useState(0)
  const loaded = useLoadedCanvas(workspace.id, attempt)
  const ready = loaded.status === 'ready' ? loaded : null
  const rootRef = useRef<HTMLDivElement>(null)
  useEditorEntrance(rootRef, ready !== null)

  // إشعارات عن حالة ما قُرئ (مرة واحدة عند اكتمال التحميل)
  useEffect(() => {
    if (!ready) return
    const { pushToast } = useUiStore.getState()
    if (ready.unreadable) {
      pushToast(
        'error',
        ready.backedUp
          ? "This workspace's saved content couldn't be read, so it opens empty. A backup copy was kept in this browser."
          : "This workspace's saved content couldn't be read, so it opens empty.",
      )
    } else if (ready.discardedCount > 0) {
      pushToast('info', `${ready.discardedCount} damaged item${ready.discardedCount === 1 ? ' was' : 's were'} skipped while opening this workspace.`)
    }
  }, [ready])

  if (loaded.status === 'loading') return <EditorFallback state="loading" />
  if (loaded.status === 'error') return <EditorFallback state="error" onRetry={() => setAttempt((n) => n + 1)} />

  return (
    // key: عند الانتقال من مساحة لأخرى يُبنى مخزن اللوحة والمزوّد من جديد (لا تسرّب بين المساحات)
    <CanvasStoreProvider key={workspace.id} initial={{ nodes: loaded.nodes, edges: loaded.edges, viewport: loaded.viewport }}>
      <ReactFlowProvider>
        <CanvasPersistenceProvider workspaceId={workspace.id}>
          <div ref={rootRef} className="relative h-dvh overflow-hidden bg-bg">
            <a
              href="#canvas-main"
              onClick={(event) => {
                event.preventDefault() // لا نلوّث الرابط بـ #hash؛ ننقل التركيز فقط
                document.getElementById('canvas-main')?.focus()
              }}
              className="skip-link"
            >
              Skip to canvas
            </a>
            {/* الشريط قبل اللوحة في DOM ليصل إليه مستخدم لوحة المفاتيح أولاً، ويظهر فوقها بالتموضع المطلق */}
            <EditorTopBar workspace={workspace} />
            <main id="canvas-main" tabIndex={-1} className="absolute inset-0 outline-none" aria-label="Canvas">
              {/* الاسم الظاهر بصرياً داخل حبّة تفاعلية؛ هذا العنوان المخفي يمنح الصفحة بنية دلالية لقارئات الشاشة */}
              <h1 className="sr-only">
                <bdi>{workspace.name}</bdi>
              </h1>
              <CanvasEditor />
            </main>
          </div>
          <ShortcutsDialog />
        </CanvasPersistenceProvider>
      </ReactFlowProvider>
    </CanvasStoreProvider>
  )
}

/** صفحة المحرر: تتحقق من وجود المساحة ثم تسلّم تحميل لوحتها لـ LoadedEditor. */
export function WorkspaceEditorPage() {
  const { workspaceId = '' } = useParams()
  const status = useWorkspaceStore((state) => state.status)
  const workspace = useWorkspaceStore((state) => state.workspaces.find((w) => w.id === workspaceId))
  const markOpened = useWorkspaceStore((state) => state.markOpened)
  const exists = workspace !== undefined

  useDocumentTitle(workspace ? `${workspace.name} · InfiniteSpace` : 'Workspace · InfiniteSpace')

  // نسجّل الفتح مرة واحدة لكل مساحة؛ الاعتماد على exists وليس الكائن نفسه يمنع حلقة تحديث
  // لأن markOpened نفسها تغيّر كائن المساحة.
  useEffect(() => {
    if (exists) markOpened(workspaceId)
  }, [exists, workspaceId, markOpened])

  if (status === 'loading') return <EditorFallback state="loading" />
  if (!workspace) return <EditorFallback state="missing" />
  return <LoadedEditor key={workspace.id} workspace={workspace} />
}
