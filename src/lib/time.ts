const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/**
 * وقت نسبي مثل "3 hours ago".
 * نمرّر `now` كمعامل بدل استدعاء Date.now() هنا ليبقى الدالة نقية وقابلة للاختبار.
 */
export function formatRelativeTime(timestamp: number, now: number, locale = 'en'): string {
  const diffSeconds = Math.round((timestamp - now) / 1000)
  const abs = Math.abs(diffSeconds)
  if (abs < 45) return 'just now'

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, seconds] of UNITS) {
    if (abs >= seconds) return formatter.format(Math.round(diffSeconds / seconds), unit)
  }
  return formatter.format(Math.round(diffSeconds / 60), 'minute')
}

/** تاريخ كامل مقروء يظهر كتلميح (title) عند التمرير فوق الوقت النسبي. */
export function formatFullDate(timestamp: number, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}
