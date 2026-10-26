import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, SearchX } from 'lucide-react'
import { DotGridBackground } from '@/components/layout/DotGridBackground'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNow } from '@/hooks/useNow'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { DeleteWorkspaceDialog } from '../components/DeleteWorkspaceDialog'
import { EmptyState } from '../components/EmptyState'
import { RecentList } from '../components/RecentList'
import { SearchField } from '../components/SearchField'
import { SortSelect } from '../components/SortSelect'
import { WorkspaceCard } from '../components/WorkspaceCard'
import { WorkspaceFormDialog } from '../components/WorkspaceFormDialog'
import { BackgroundEffect } from '../effects/BackgroundEffect'
import { EffectsToggle } from '../effects/EffectsToggle'
import { useDashboardEntrance } from '../hooks/useDashboardEntrance'
import { useNewCardEnter } from '../hooks/useNewCardEnter'
import type { WorkspaceInput, WorkspaceMeta } from '../types/workspace'
import { filterWorkspaces, selectRecentWorkspaces, sortWorkspaces } from '../utils/query'

type FormState = { mode: 'create' } | { mode: 'edit'; id: string } | null

export function DashboardPage() {
  useDocumentTitle('InfiniteSpace')
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const now = useNow()

  const status = useWorkspaceStore((state) => state.status)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace)
  const updateWorkspace = useWorkspaceStore((state) => state.updateWorkspace)
  const duplicateWorkspace = useWorkspaceStore((state) => state.duplicateWorkspace)
  const deleteWorkspace = useWorkspaceStore((state) => state.deleteWorkspace)

  const sort = useUiStore((state) => state.workspaceSort)
  const setSort = useUiStore((state) => state.setWorkspaceSort)
  const pushToast = useUiStore((state) => state.pushToast)

  const [query, setQuery] = useState('')
  const [formState, setFormState] = useState<FormState>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useDashboardEntrance(rootRef, status === 'ready')

  // الاشتقاقات تُحسب بـ useMemo (وليس داخل selector) لأن selector يعيد مصفوفة جديدة
  // في كل مرة يسبب إعادة رسم لا نهائية مع Zustand 5
  const visible = useMemo(() => sortWorkspaces(filterWorkspaces(workspaces, query), sort), [workspaces, query, sort])
  const recent = useMemo(() => selectRecentWorkspaces(workspaces), [workspaces])

  const visibleIds = useMemo(() => visible.map((w) => w.id), [visible])
  useNewCardEnter(listRef, visibleIds, status === 'ready')

  const editing = formState?.mode === 'edit' ? workspaces.find((w) => w.id === formState.id) : undefined
  const deleting = workspaces.find((w) => w.id === deletingId) ?? null
  const formOpen = formState?.mode === 'create' || editing !== undefined
  const isSearching = query.trim().length > 0
  // الحالة الفارغة تحمل زر إنشاء خاصاً بها، والبحث بلا معنى دون مساحات؛ نخفيهما من الشريط حينها
  const hasWorkspaces = status === 'ready' && workspaces.length > 0

  const handleSubmit = (input: WorkspaceInput) => {
    if (formState?.mode === 'edit') {
      updateWorkspace(formState.id, input)
      setFormState(null)
      return
    }
    const created = createWorkspace(input)
    setFormState(null)
    pushToast('success', `Created “${created.name}”.`)
    navigate(`/w/${created.id}`)
  }

  const handleDuplicate = async (workspace: WorkspaceMeta) => {
    const copy = await duplicateWorkspace(workspace.id)
    if (copy) pushToast('success', `Duplicated as “${copy.name}”.`)
  }

  const handleDelete = async (workspace: WorkspaceMeta) => {
    setDeletingId(null)
    await deleteWorkspace(workspace.id)
    pushToast('success', `Deleted “${workspace.name}”.`)
  }

  return (
    <div ref={rootRef} className="relative min-h-dvh">
      <DotGridBackground />

      {/* شريط عائم ثابت (مرجع 1 و4): شعار، بحث بشكل حبّة، السمة، وزر إنشاء أبيض بارز */}
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[28px] border border-line bg-surface/80 p-2 pl-4 shadow-pop backdrop-blur-xl">
          <Link to="/" aria-label="InfiniteSpace home" className="rounded-lg">
            <Logo />
          </Link>
          {hasWorkspaces && (
            <SearchField
              value={query}
              onChange={setQuery}
              className="order-last w-full md:order-none md:mx-auto md:w-auto md:max-w-md md:flex-1"
            />
          )}
          <div className="ml-auto flex items-center gap-2">
            <EffectsToggle className="hidden md:inline-flex" />
            <ThemeToggle />
            {hasWorkspaces && (
              <Button variant="primary" size="sm" onClick={() => setFormState({ mode: 'create' })} className="h-10">
                <Plus className="size-4" aria-hidden="true" />
                Create workspace
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-9 px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
        {/* مؤثر زخرفي اختياري خلف العنوان: يُخفى على الشاشات الصغيرة (بطارية وأداء) ولا يستقبل المؤشر */}
        <BackgroundEffect className="absolute top-0 right-0 -z-10 hidden h-[360px] w-[min(46vw,520px)] opacity-80 md:block" />
        <section aria-labelledby="page-heading" data-reveal="hero" className="max-w-2xl">
          <h1
            id="page-heading"
            className="font-display text-[clamp(2rem,4.6vw,3.1rem)] leading-[1.04] font-bold tracking-[-0.03em]"
          >
            Your workspaces
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-muted">
            Each workspace is an unlimited canvas for notes, images, links, and the connections between them.
          </p>
        </section>

        {status === 'loading' ? (
          <div role="status" aria-busy="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <span className="sr-only">Loading your workspaces…</span>
            {[0, 1, 2].map((key) => (
              <div key={key} aria-hidden="true" className="h-72 animate-pulse rounded-[22px] border border-line bg-surface" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div data-reveal="card">
            <EmptyState onCreate={() => setFormState({ mode: 'create' })} />
          </div>
        ) : (
          <>
            {!isSearching && <RecentList workspaces={recent} now={now} />}

            <section aria-labelledby="all-heading" className="space-y-5">
              <div data-reveal="hero" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <h2 id="all-heading" className="font-display text-xl font-semibold tracking-tight">
                  {isSearching ? 'Search results' : 'All workspaces'}
                  <span className="ml-2.5 font-mono text-sm font-normal text-muted">
                    {isSearching ? `${visible.length} of ${workspaces.length}` : workspaces.length}
                  </span>
                </h2>
                <SortSelect value={sort} onChange={setSort} />
              </div>

              {visible.length === 0 ? (
                <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-[24px] border border-dashed border-line px-6 py-14 text-center">
                  <SearchX className="size-8 text-muted" aria-hidden="true" />
                  <p className="font-medium">No workspaces match “{query.trim()}”</p>
                  <p className="text-sm text-muted">Check the spelling, or search for a word from the description.</p>
                  <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                </div>
              ) : (
                <ul ref={listRef} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((workspace) => (
                    <li key={workspace.id} data-reveal="card" data-workspace-id={workspace.id}>
                      <WorkspaceCard
                        workspace={workspace}
                        now={now}
                        onEdit={(w) => setFormState({ mode: 'edit', id: w.id })}
                        onDuplicate={(w) => void handleDuplicate(w)}
                        onDelete={(w) => setDeletingId(w.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <WorkspaceFormDialog
        open={formOpen}
        mode={formState?.mode ?? 'create'}
        workspace={editing}
        onClose={() => setFormState(null)}
        onSubmit={handleSubmit}
      />
      <DeleteWorkspaceDialog
        workspace={deleting}
        onCancel={() => setDeletingId(null)}
        onConfirm={(workspace) => void handleDelete(workspace)}
      />
    </div>
  )
}
