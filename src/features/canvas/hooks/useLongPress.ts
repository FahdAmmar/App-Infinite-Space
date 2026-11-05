import { useCallback, useMemo, useRef, type PointerEvent } from 'react'

/** المسافة (بكسل) التي إن تحرك الإصبع أكثر منها فهو سحب أو تمرير لا ضغط مطوّل */
const MOVE_TOLERANCE = 10
const DEFAULT_DELAY_MS = 550

export interface LongPressHandlers {
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: () => void
  onPointerCancel: () => void
}

/**
 * ضغط مطوّل باللمس: قائمة النقر الأيمن لا وجود لها على الهاتف واللوح، فنقدّم بديلها.
 * يُلغى إن تحرك الإصبع، أو رُفع قبل الموعد، أو لمس إصبع ثانٍ (قرص التكبير).
 * الفأرة والقلم لا يدخلان هنا: لهما زر أيمن حقيقي.
 */
export function useLongPress(onLongPress: (point: { x: number; y: number }, target: Element) => void, delayMs = DEFAULT_DELAY_MS): LongPressHandlers {
  const timer = useRef<number | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    origin.current = null
  }, [])

  return useMemo<LongPressHandlers>(
    () => ({
      onPointerDown: (event) => {
        cancel()
        if (event.pointerType !== 'touch' || !event.isPrimary || !(event.target instanceof Element)) return
        const point = { x: event.clientX, y: event.clientY }
        const target = event.target
        origin.current = point
        timer.current = window.setTimeout(() => {
          timer.current = null
          origin.current = null
          onLongPress(point, target)
        }, delayMs)
      },
      onPointerMove: (event) => {
        const start = origin.current
        if (start === null) return
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
    }),
    [cancel, delayMs, onLongPress],
  )
}
