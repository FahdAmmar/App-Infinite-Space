import { useEffect } from 'react'
import { isClipboardMarker } from '../utils/clipboard'
import { isTypingTarget } from '../utils/dom'
import type { CanvasCommands } from './useCanvasCommands'

/**
 * اللصق على اللوحة: صورة من الحافظة (لقطة شاشة مثلاً)، أو بطاقات نُسخت داخل التطبيق (تُعرف بجملتها التعريفية)،
 * أو نص عادي (رابط أو فقرات) يصير بطاقات.
 * لا نتدخل إن كان المستخدم يكتب في حقل (اللصق هناك نص عادي)، ولا إن لم تحوِ الحافظة شيئاً يخصنا.
 */
export function useImagePaste(commands: CanvasCommands): void {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      if (document.querySelector('dialog[open]')) return
      const images = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'))
      if (images.length === 0) {
        const text = event.clipboardData?.getData('text/plain') ?? ''
        // الجملة التعريفية تعني بطاقات نُسخت هنا: لا تتحول إلى بطاقة نص حتى لو كانت الحافظة الداخلية فارغة (تبويب آخر)
        if (isClipboardMarker(text)) {
          if (commands.pasteClipboard()) event.preventDefault()
        } else if (text.trim() !== '' && commands.pasteText(text)) {
          event.preventDefault()
        }
        return
      }
      event.preventDefault()
      void commands.addImages(images)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [commands])
}
