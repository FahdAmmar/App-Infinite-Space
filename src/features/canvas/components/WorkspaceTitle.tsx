import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { NAME_MAX_LENGTH } from '@/features/workspaces/utils/constants'
import { validateWorkspaceText } from '@/features/workspaces/utils/validation'

/** اسم المساحة في الشريط العلوي: يظهر كنص، وبالنقر يتحول لحقل تعديل (Enter يحفظ، Esc يلغي). */
export function WorkspaceTitle({ workspace }: { workspace: WorkspaceMeta }) {
  const updateWorkspace = useWorkspaceStore((state) => state.updateWorkspace)
  const [editing, setEditing] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const finish = (nextName: string | null, restoreFocus: boolean) => {
    if (nextName !== null) updateWorkspace(workspace.id, { name: nextName })
    setEditing(false)
    // بعد Enter/Esc يعود التركيز للزر كي لا يضيع موضع مستخدم لوحة المفاتيح
    if (restoreFocus) requestAnimationFrame(() => buttonRef.current?.focus())
  }

  if (editing) {
    return <TitleForm initialValue={workspace.name} onSubmit={(name) => finish(name, true)} onCancel={(refocus) => finish(null, refocus)} />
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setEditing(true)}
      title="Rename workspace"
      className="group flex h-11 min-w-0 items-center gap-2 rounded-full border border-line bg-raised px-4 text-left shadow-pop transition-colors hover:border-muted/50"
    >
      <span className="truncate text-sm font-semibold">
        <bdi>{workspace.name}</bdi>
      </span>
      <Pencil className="size-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
      <span className="sr-only">Rename workspace</span>
    </button>
  )
}

interface TitleFormProps {
  initialValue: string
  onSubmit: (name: string) => void
  onCancel: (restoreFocus: boolean) => void
}

function TitleForm({ initialValue, onSubmit, onCancel }: TitleFormProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateWorkspaceText(value, '')
    if (!result.ok) {
      setError(result.errors.name ?? 'Enter a valid name.')
      return
    }
    onSubmit(result.value.name)
  }

  return (
    <form onSubmit={handleSubmit} className="relative min-w-0">
      <label htmlFor="workspace-title-input" className="sr-only">
        Workspace name
      </label>
      <input
        ref={inputRef}
        id="workspace-title-input"
        value={value}
        dir="auto"
        autoComplete="off"
        maxLength={NAME_MAX_LENGTH + 20}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'workspace-title-error' : undefined}
        onChange={(event) => {
          setValue(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel(true)
          }
        }}
        // الخروج بالتركيز: نحفظ إن كان الاسم صالحاً وإلا نتراجع بصمت (دون سرقة التركيز من مكان المستخدم الجديد)
        onBlur={() => {
          const result = validateWorkspaceText(value, '')
          if (result.ok) onSubmit(result.value.name)
          else onCancel(false)
        }}
        className="h-11 w-48 max-w-full rounded-full border border-accent bg-raised px-4 text-sm font-semibold shadow-pop aria-invalid:border-danger sm:w-72"
      />
      {error && (
        <p id="workspace-title-error" role="alert" className="absolute top-full left-0 z-20 mt-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-danger shadow-pop">
          {error}
        </p>
      )}
    </form>
  )
}
