import { useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import {
  WORKSPACE_COLOR_IDS,
  WORKSPACE_ICON_IDS,
  type WorkspaceColorId,
  type WorkspaceIconId,
  type WorkspaceInput,
  type WorkspaceMeta,
} from '../types/workspace'
import {
  DEFAULT_COLOR,
  DEFAULT_ICON,
  DESCRIPTION_MAX_LENGTH,
  WORKSPACE_COLORS,
  WORKSPACE_ICON_LABELS,
} from '../utils/constants'
import { validateWorkspaceText, type WorkspaceTextErrors } from '../utils/validation'
import { WorkspaceIcon } from './WorkspaceIcon'

interface WorkspaceFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  /** مطلوب في وضع التعديل لملء الحقول الحالية */
  workspace?: WorkspaceMeta
  onClose: () => void
  onSubmit: (input: WorkspaceInput) => void
}

export function WorkspaceFormDialog({ open, mode, workspace, onClose, onSubmit }: WorkspaceFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Create workspace' : 'Rename & customize'}
      description={
        mode === 'create'
          ? 'Name it, pick a color and an icon. You can change all of this later.'
          : 'Changes apply right away.'
      }
    >
      <WorkspaceForm mode={mode} workspace={workspace} onCancel={onClose} onSubmit={onSubmit} />
    </Dialog>
  )
}

interface WorkspaceFormProps {
  mode: 'create' | 'edit'
  workspace?: WorkspaceMeta
  onCancel: () => void
  onSubmit: (input: WorkspaceInput) => void
}

function WorkspaceForm({ mode, workspace, onCancel, onSubmit }: WorkspaceFormProps) {
  const [name, setName] = useState(workspace?.name ?? '')
  const [description, setDescription] = useState(workspace?.description ?? '')
  const [color, setColor] = useState<WorkspaceColorId>(workspace?.color ?? DEFAULT_COLOR)
  const [icon, setIcon] = useState<WorkspaceIconId>(workspace?.icon ?? DEFAULT_ICON)
  const [errors, setErrors] = useState<WorkspaceTextErrors>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = validateWorkspaceText(name, description)
    if (!result.ok) {
      setErrors(result.errors)
      // ننقل التركيز لأول حقل خاطئ ليعرف المستخدم (وقارئ الشاشة) أين المشكلة
      ;(result.errors.name ? nameRef : descriptionRef).current?.focus()
      return
    }
    onSubmit({ ...result.value, color, icon })
  }

  const previewStyle = { '--ws': WORKSPACE_COLORS[color].hex } as CSSProperties

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div style={previewStyle} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
        <span className="ws-chip grid size-10 shrink-0 place-items-center rounded-[11px]">
          <WorkspaceIcon id={icon} className="size-5" />
        </span>
        <span dir="auto" className={cn('truncate font-display text-lg font-semibold', !name.trim() && 'text-muted')}>
          {name.trim() || 'Untitled workspace'}
        </span>
      </div>

      <div>
        <label htmlFor="workspace-name" className="mb-1.5 block text-sm font-medium">
          Name
        </label>
        <input
          ref={nameRef}
          id="workspace-name"
          data-autofocus
          dir="auto"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (errors.name) setErrors((current) => ({ ...current, name: undefined }))
          }}
          placeholder="Learning Roadmap"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'workspace-name-error' : undefined}
          className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[0.95rem] aria-invalid:border-danger"
        />
        {errors.name && (
          <p id="workspace-name-error" className="mt-1.5 text-sm text-danger">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor="workspace-description" className="text-sm font-medium">
            Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <span className="font-mono text-xs text-muted" aria-hidden="true">
            {description.length}/{DESCRIPTION_MAX_LENGTH}
          </span>
        </div>
        <textarea
          ref={descriptionRef}
          id="workspace-description"
          dir="auto"
          rows={3}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
            if (errors.description) setErrors((current) => ({ ...current, description: undefined }))
          }}
          placeholder="What will you think through here?"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? 'workspace-description-error' : undefined}
          className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[0.95rem] leading-relaxed aria-invalid:border-danger"
        />
        {errors.description && (
          <p id="workspace-description-error" className="mt-1.5 text-sm text-danger">
            {errors.description}
          </p>
        )}
      </div>

      {/* مجموعات الاختيار تستخدم radio أصلية: تنقل بالأسهم وإعلان الحالة مجاناً من المتصفح */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-3">
          {WORKSPACE_COLOR_IDS.map((id) => (
            <label key={id} className="relative cursor-pointer">
              <input
                type="radio"
                name="workspace-color"
                value={id}
                checked={color === id}
                onChange={() => setColor(id)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                style={{ backgroundColor: WORKSPACE_COLORS[id].hex }}
                className="block size-8 rounded-full ring-offset-2 ring-offset-raised transition-shadow hover:ring-2 hover:ring-line peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent"
              />
              <span className="sr-only">{WORKSPACE_COLORS[id].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Icon</legend>
        <div className="grid grid-cols-6 gap-2">
          {WORKSPACE_ICON_IDS.map((id) => (
            <label key={id} title={WORKSPACE_ICON_LABELS[id]} className="relative cursor-pointer">
              <input
                type="radio"
                name="workspace-icon"
                value={id}
                checked={icon === id}
                onChange={() => setIcon(id)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="grid h-11 place-items-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-raised hover:text-ink peer-checked:border-accent peer-checked:bg-accent/15 peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
              >
                <WorkspaceIcon id={id} className="size-5" />
              </span>
              <span className="sr-only">{WORKSPACE_ICON_LABELS[id]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {mode === 'create' ? 'Create workspace' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

