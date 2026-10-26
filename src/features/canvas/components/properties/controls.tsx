import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { MAX_TAGS, TAG_MAX_LENGTH } from '../../utils/constants'
import { addTag, removeTag } from '../../utils/tags'

const FIELD =
  'w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent aria-[invalid=true]:border-danger'

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2.5 border-t border-line px-4 py-3.5 first:border-t-0">
      <h3 className="text-[0.68rem] font-semibold tracking-wider text-muted uppercase">{title}</h3>
      {children}
    </section>
  )
}

export type ParseResult = { ok: true; value: string } | { ok: false; error: string }

interface CommitFieldProps {
  label: string
  value: string
  onCommit: (value: string) => void
  maxLength?: number
  multiline?: boolean
  placeholder?: string
  dir?: 'ltr' | 'rtl' | 'auto'
  /** يحوّل ما كتبه المستخدم إلى قيمة نهائية أو يرفضه بخطأ يُعرض تحت الحقل */
  parse?: (draft: string) => ParseResult
}

/**
 * حقل نصي يحتفظ بما يكتبه المستخدم محلياً ويُرسله للمخزن عند الانتهاء فقط (Enter أو مغادرة الحقل).
 * هكذا لا يُسجَّل كل حرف كتعديل (لا إعادة رسم للوحة، ولا خطوات تراجع كثيرة في المرحلة 4).
 * Esc يتراجع عن المسودة. وعند تغيّر القيمة من الخارج (تحديد عقدة أخرى، تحرير مضمّن) تُستبدل المسودة بها.
 * Ctrl/⌘+Enter ينهي الحقول متعددة الأسطر؛ Enter وحده يضيف سطراً فيها.
 */
export function CommitField({ label, value, onCommit, maxLength, multiline = false, placeholder, dir = 'auto', parse }: CommitFieldProps) {
  const id = useId()
  const errorId = useId()
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  const [error, setError] = useState<string | null>(null)

  // مزامنة المسودة مع القيمة الخارجية أثناء الرسم (النمط الموصى به بدل useEffect + setState)
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
    setError(null)
  }

  const commit = (): boolean => {
    if (draft === value) {
      setError(null)
      return true
    }
    if (parse) {
      const result = parse(draft)
      if (!result.ok) {
        setError(result.error)
        return false
      }
      setError(null)
      if (result.value !== value) onCommit(result.value)
      setDraft(result.value)
      return true
    }
    onCommit(draft)
    return true
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      setDraft(value)
      setError(null)
    } else if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit()
    }
  }

  const common = {
    id,
    value: draft,
    maxLength,
    placeholder,
    dir,
    'aria-invalid': error !== null,
    'aria-describedby': error ? errorId : undefined,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onBlur: () => void commit(),
    onKeyDown: handleKeyDown,
  } as const

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-muted">
        {label}
      </label>
      {multiline ? (
        <textarea {...common} rows={4} className={cn(FIELD, 'resize-y leading-relaxed')} />
      ) : (
        <input {...common} autoComplete="off" className={FIELD} />
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
  disabled?: boolean
}

/** حقل رقمي بنفس مبدأ الإرسال عند الانتهاء؛ القيمة غير الصالحة تعود للقيمة الحالية، والحدود تُفرض في المخزن. */
export function NumberField({ label, value, min, max, onCommit, disabled }: NumberFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState(String(Math.round(value)))
  const [seen, setSeen] = useState(value)

  if (value !== seen) {
    setSeen(value)
    setDraft(String(Math.round(value)))
  }

  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || draft.trim() === '') {
      setDraft(String(Math.round(value)))
      return
    }
    const clamped = Math.min(max, Math.max(min, Math.round(parsed)))
    setDraft(String(clamped))
    if (clamped !== Math.round(value)) onCommit(clamped)
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.stopPropagation()
            setDraft(String(Math.round(value)))
          }
        }}
        dir="ltr"
        className={cn(FIELD, 'font-mono disabled:opacity-50')}
      />
    </div>
  )
}

export function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-muted">{label}</span>
      <p dir="ltr" className="rounded-lg border border-line bg-bg/60 px-2.5 py-1.5 font-mono text-sm text-ink/80">
        {value}
      </p>
    </div>
  )
}

interface SwatchOption<T extends string> {
  id: T
  label: string
  /** قيمة خلفية الدائرة (متغير CSS أو لون) */
  background: string
  border?: string
}

export function ColorSwatches<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<SwatchOption<T>>
  value: T | null
  onChange: (id: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-label={option.label}
          aria-pressed={value === option.id}
          data-compact
          title={option.label}
          onClick={() => onChange(option.id)}
          style={{ background: option.background, borderColor: option.border ?? 'transparent' }}
          className={cn(
            'size-7 rounded-full border-2 transition-transform hover:scale-110',
            value === option.id && 'ring-2 ring-ink ring-offset-2 ring-offset-raised',
          )}
        />
      ))}
    </div>
  )
}

interface SegmentedOption<T extends string> {
  id: T
  label: string
  icon?: LucideIcon
}

/** مجموعة أزرار اختيار واحد (أسلوب أزرار الراديو لكن مضغوطة). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl border border-line bg-bg p-1">
      {options.map((option) => {
        const Icon = option.icon
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs transition-colors',
              active ? 'bg-primary text-primary-ink' : 'text-muted hover:bg-raised hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden="true" />}
            <span className={Icon ? 'sr-only' : undefined}>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** محرر الوسوم: Enter أو فاصلة يضيف، والزر × يحذف. القواعد في utils/tags.ts. */
export function TagEditor({ tags, onChange }: { tags: readonly string[]; onChange: (tags: string[]) => void }) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const full = tags.length >= MAX_TAGS

  const submit = () => {
    if (draft.trim() === '') return
    onChange(addTag(tags, draft))
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs text-muted">
        Tags ({tags.length}/{MAX_TAGS})
      </label>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center gap-1 rounded-full bg-raised py-0.5 pr-1 pl-2.5 text-xs text-ink">
              <span dir="auto" className="max-w-32 truncate">
                #{tag}
              </span>
              <button
                type="button"
                data-compact
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(removeTag(tags, tag))}
                className="grid size-5 place-items-center rounded-full text-muted transition-colors hover:bg-bg hover:text-ink"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        disabled={full}
        maxLength={TAG_MAX_LENGTH}
        placeholder={full ? 'Tag limit reached' : 'Add a tag, then press Enter'}
        dir="auto"
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            submit()
          } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
            const last = tags[tags.length - 1]
            if (last !== undefined) onChange(removeTag(tags, last))
          }
        }}
        className={cn(FIELD, 'disabled:opacity-50')}
      />
    </div>
  )
}
