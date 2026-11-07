/**
 * ينفّذ العمل غير الحرج عند خمول المتصفح (requestIdleCallback) كي لا ينافس أول رسم للصفحة،
 * مع بديل setTimeout حيث لا تتوفر (Safari). يعيد دالة تلغي التنفيذ قبل أن يبدأ.
 */
export function whenIdle(callback: () => void, timeoutMs = 2000): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, { timeout: timeoutMs })
    return () => window.cancelIdleCallback(handle)
  }
  const handle = window.setTimeout(callback, 200)
  return () => window.clearTimeout(handle)
}
