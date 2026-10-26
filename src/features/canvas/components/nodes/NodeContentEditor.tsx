import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { CONTENT_MAX_LENGTH, TITLE_MAX_LENGTH } from '../../utils/constants'

interface NodeContentEditorProps {
  initialTitle: string
  initialContent: string
  /** الحقل الذي ينال التركيز عند بدء التحرير */
  focusField: 'title' | 'content'
  titlePlaceholder: string
  contentPlaceholder: string
  titleClassName?: string
  contentClassName?: string
  onCommit: (value: { title: string; content: string }) => void
  onExit: () => void
}

/**
 * محرر النص المضمّن داخل العقدة (عنوان + محتوى متعدد الأسطر).
 *
 * - النص أثناء الكتابة يعيش في حالة محلية هنا فقط، ويُرسل للمخزن مرة واحدة عند الخروج من التحرير.
 *   بهذا لا يُعاد رسم اللوحة مع كل ضغطة مفتاح، ولن يسجّل سجل التراجع (المرحلة 4) كل حرف كخطوة.
 * - الحاوية تحمل nodrag/nopan فلا يحرّك تحديد النص بالفأرة العقدة ولا اللوحة،
 *   والمحتوى يحمل nowheel فيمرّر النص الطويل بالعجلة بدل تكبير اللوحة.
 * - ينتهي التحرير عند خروج التركيز من الحاوية كلها (وليس عند الانتقال بين العنوان والمحتوى)،
 *   أو بـ Escape، أو Ctrl/⌘+Enter.
 */
export function NodeContentEditor({
  initialTitle,
  initialContent,
  focusField,
  titlePlaceholder,
  contentPlaceholder,
  titleClassName,
  contentClassName,
  onCommit,
  onExit,
}: NodeContentEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const field = focusField === 'title' ? titleRef.current : contentRef.current
    if (!field) return
    field.focus()
    // المؤشر في نهاية النص الحالي بدل بدايته
    field.setSelectionRange(field.value.length, field.value.length)
  }, [focusField])

  const finish = () => {
    const nextTitle = title.trim()
    const nextContent = content.trimEnd()
    if (nextTitle !== initialTitle || nextContent !== initialContent) {
      onCommit({ title: nextTitle, content: nextContent })
    }
    onExit()
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return // الانتقال بين الحقلين لا ينهي التحرير
    finish()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish()
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      finish()
    }
  }

  return (
    <div onBlur={handleBlur} onKeyDown={handleKeyDown} className="nodrag nopan flex h-full min-h-0 flex-col gap-1.5">
      <input
        ref={titleRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          // Enter في العنوان ينقل إلى المحتوى بدل إدخال سطر جديد
          if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
            event.preventDefault()
            contentRef.current?.focus()
          }
        }}
        maxLength={TITLE_MAX_LENGTH}
        placeholder={titlePlaceholder}
        aria-label="Title"
        dir="auto"
        autoComplete="off"
        className={cn('w-full bg-transparent outline-none placeholder:opacity-50', titleClassName)}
      />
      <textarea
        ref={contentRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={CONTENT_MAX_LENGTH}
        placeholder={contentPlaceholder}
        aria-label="Content"
        dir="auto"
        className={cn(
          'nowheel min-h-0 w-full flex-1 resize-none bg-transparent outline-none placeholder:opacity-50',
          contentClassName,
        )}
      />
    </div>
  )
}
