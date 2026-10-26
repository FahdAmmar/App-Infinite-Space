import { URL_MAX_LENGTH } from './constants'

/**
 * يتحقق من عنوان كتبه المستخدم ويعيده بصيغة قياسية، أو null إن لم يكن صالحاً.
 *
 * لماذا نتشدد؟ العنوان سيصبح href لرابط قابل للنقر. لو قبلنا javascript: أو data: لصار أي ملف مستورد
 * أو مساحة مشاركة وسيلة لتنفيذ شيفرة. لذلك نسمح بـ http/https فقط، ونرفض العناوين التي تحمل
 * اسم مستخدم/كلمة مرور (أسلوب شائع في التصيّد: https://bank.com@evil.com).
 * إن لم يكتب المستخدم بروتوكولاً نضيف https:// (مثل: example.com أو localhost:3000).
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === '' || trimmed.length > URL_MAX_LENGTH || /\s/.test(trimmed)) return null

  let candidate: string
  if (/^https?:\/\//i.test(trimmed)) {
    candidate = trimmed
  } else if (/^[a-z][a-z0-9+.-]*:(?!\d+(\/|$))/i.test(trimmed)) {
    // يبدأ ببروتوكول آخر (javascript:, data:, mailto:, ftp://...) وليس "مضيف:منفذ"
    return null
  } else {
    candidate = `https://${trimmed}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.hostname === '' || url.username !== '' || url.password !== '') return null
  return url.href
}

/** النص المختصر المعروض للمستخدم: المضيف بلا www. */
export function getDisplayHost(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, '')
  } catch {
    return href
  }
}
