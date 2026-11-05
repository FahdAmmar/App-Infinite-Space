/**
 * تحويل أي خطأ إلى رسالة مفهومة للمستخدم. الفصل عن المكوّن يجعل القاعدة قابلة للاختبار دون DOM.
 */

export type ErrorKind = 'chunk' | 'unknown'

export interface ErrorSummary {
  kind: ErrorKind
  title: string
  message: string
  /** نص تقني مقتضب للعرض عند الطلب (بدون stack: لا نكشف مسارات داخلية) */
  detail: string
}

const DETAIL_MAX_LENGTH = 300

/** رسائل المتصفحات المختلفة عند فشل تحميل جزء كسول (انقطاع الشبكة أو نشر إصدار جديد أثناء فتح التبويب). */
const CHUNK_FAILURE_PATTERNS: readonly RegExp[] = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite
  /Loading chunk [\w-]+ failed/i,
]

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

export function describeError(error: unknown): ErrorSummary {
  const raw = readMessage(error).trim()
  const detail = (raw === '' ? 'Unknown error' : raw).slice(0, DETAIL_MAX_LENGTH)

  if (CHUNK_FAILURE_PATTERNS.some((pattern) => pattern.test(raw))) {
    return {
      kind: 'chunk',
      title: "This page couldn't load",
      message:
        "A part of the app failed to download. This usually happens when you're offline, or when the app was updated while this tab was open. Reload to try again. Your saved workspaces aren't affected.",
      detail,
    }
  }

  return {
    kind: 'unknown',
    title: 'Something went wrong',
    message:
      'The app hit an unexpected problem. Reloading usually fixes it. Changes saved before the problem are kept in this browser, but your most recent edit may not have been saved.',
    detail,
  }
}
