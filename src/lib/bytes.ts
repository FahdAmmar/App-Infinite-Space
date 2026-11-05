const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * حجم مقروء للإنسان (أساس 1024، منزلة عشرية واحدة من الكيلوبايت فصاعداً).
 * قيمة غير صالحة (سالبة أو NaN) تُعامل كصفر كي لا تظهر «NaN MB» في الواجهة.
 */
export function formatBytes(bytes: number): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
  let unit = 0
  let size = value
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024
    unit += 1
  }
  const text = unit === 0 ? String(Math.round(size)) : size.toFixed(1).replace(/\.0$/, '')
  return `${text} ${UNITS[unit]}`
}
