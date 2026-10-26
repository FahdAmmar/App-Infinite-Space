import { useEffect } from 'react'
import { isTypingTarget } from '../utils/dom'
import type { CanvasCommands } from './useCanvasCommands'

/**
 * لصق صورة من الحافظة (لقطة شاشة مثلاً) على اللوحة. لا نتدخل إن كان المستخدم يكتب في حقل
 * (اللصق هناك نص عادي)، ولا إن كان الحافظة لا تحوي ملفات صور (نترك المتصفح يتصرف كالمعتاد).
 */
export function useImagePaste(commands: CanvasCommands): void {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      if (document.querySelector('dialog[open]')) return
      const images = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'))
      if (images.length === 0) return
      event.preventDefault()
      void commands.addImages(images)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [commands])
}
