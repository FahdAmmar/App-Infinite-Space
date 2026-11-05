import type { ScreenPoint } from './pointer-tracker'

/** نقطة الشاشة لحدث فأرة أو لمس (عند نهاية اللمس تكون الإحداثيات في changedTouches لا touches). */
export function eventClientPoint(event: MouseEvent | TouchEvent): ScreenPoint | null {
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  return { x: event.clientX, y: event.clientY }
}
