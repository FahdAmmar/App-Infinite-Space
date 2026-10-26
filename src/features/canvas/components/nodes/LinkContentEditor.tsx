import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { useUiStore } from '@/stores/ui-store'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, URL_MAX_LENGTH } from '../../utils/constants'
import { normalizeUrl } from '../../utils/link-url'

interface LinkValue {
  url: string
  title: string
  description: string
}

interface LinkContentEditorProps {
  initial: LinkValue
  onCommit: (value: LinkValue) => void
  onExit: () => void
}

/**
 * محرر بطاقة الرابط المضمّن: عنوان URL ثم العنوان والوصف.
 * سلوك العنوان غير الصالح (مقصود):
 *  - Enter أو Ctrl/⌘+Enter: نُبقي المحرر مفتوحاً ونعرض الخطأ، فيصحّحه المستخدم.
 *  - الخروج بالنقر خارجاً أو Esc: نحفظ العنوان والوصف ونُبقي العنوان السابق ونُعلم المستخدم بإشعار؛
 *    لا نحبسه في محرر لا يستطيع مغادرته.
 * لا نجلب أي بيانات من العنوان (لا طلبات شبكة): ما يراه المستخدم هو ما كتبه فقط.
 */
export function LinkContentEditor({ initial, onCommit, onExit }: LinkContentEditorProps) {
  const [url, setUrl] = useState(initial.url)
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const field = urlRef.current
    if (!field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [])

  const finish = (mode: 'strict' | 'lenient') => {
    const trimmed = url.trim()
    const normalized = trimmed === '' ? '' : normalizeUrl(trimmed)
    if (normalized === null && mode === 'strict') {
      setError('Enter a valid web address, such as example.com or https://example.com/page.')
      urlRef.current?.focus()
      return
    }
    if (normalized === null) {
      useUiStore.getState().pushToast('info', 'The link address was not valid, so the previous address was kept.')
    }
    const next: LinkValue = {
      url: normalized ?? initial.url,
      title: title.trim(),
      description: description.trimEnd(),
    }
    if (next.url !== initial.url || next.title !== initial.title || next.description !== initial.description) {
      onCommit(next)
    }
    onExit()
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    finish('lenient')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish('lenient')
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      finish('strict')
    }
  }

  const fieldClass = 'w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent'

  return (
    <div onBlur={handleBlur} onKeyDown={handleKeyDown} className="nodrag nopan flex min-h-0 flex-1 flex-col gap-1.5">
      <input
        ref={urlRef}
        value={url}
        onChange={(event) => {
          setUrl(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
            event.preventDefault()
            const trimmed = url.trim()
            if (trimmed !== '' && normalizeUrl(trimmed) === null) finish('strict')
            else titleRef.current?.focus()
          }
        }}
        maxLength={URL_MAX_LENGTH}
        placeholder="Paste a link (https://…)"
        aria-label="Link address"
        aria-invalid={error !== null}
        aria-describedby={error ? 'link-url-error' : undefined}
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        className={fieldClass}
      />
      {error && (
        <p id="link-url-error" role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <input
        ref={titleRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
            event.preventDefault()
            descriptionRef.current?.focus()
          }
        }}
        maxLength={TITLE_MAX_LENGTH}
        placeholder="Title (optional)"
        aria-label="Title"
        dir="auto"
        autoComplete="off"
        className={fieldClass}
      />
      <textarea
        ref={descriptionRef}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={DESCRIPTION_MAX_LENGTH}
        placeholder="Description (optional)"
        aria-label="Description"
        dir="auto"
        className={`nowheel min-h-0 flex-1 resize-none ${fieldClass}`}
      />
    </div>
  )
}
