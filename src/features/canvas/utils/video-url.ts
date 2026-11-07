import { URL_MAX_LENGTH } from './constants'

/**
 * روابط YouTube لبطاقة الفيديو. نقبل صيغاً معروفة فقط ونستخرج منها معرّف الفيديو (11 حرفاً من [A-Za-z0-9_-])،
 * ثم نبني الرابط القياسي والمضمَّن من المعرّف نفسه، فلا يصل إلى src في iframe نص كتبه المستخدم أبداً.
 * المضيف يُطابَق بالتساوي التام (لا endsWith)، فلا يمرّ youtube.com.evil.com ولا evil.com/youtube.com/watch.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS: ReadonlySet<string> = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const SHORT_HOST = 'youtu.be'
const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v'] as const

export interface YouTubeVideo {
  videoId: string
  /** الرابط القياسي للمشاهدة على YouTube */
  url: string
}

export function parseYouTubeUrl(input: string): YouTubeVideo | null {
  const trimmed = input.trim()
  if (trimmed === '' || trimmed.length > URL_MAX_LENGTH || /\s/.test(trimmed)) return null
  // بلا بروتوكول (youtu.be/xyz أو youtube.com/watch?v=...) نضيف https؛ أي بروتوكول آخر يُرفض في الفحص التالي
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed) ? null : /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  if (candidate === null) return null

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username !== '' || url.password !== '' || url.port !== '') return null

  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter((segment) => segment !== '')
  let id: string | undefined
  if (host === SHORT_HOST) {
    id = segments[0]
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === 'watch') id = url.searchParams.get('v') ?? undefined
    else if ((PATH_PREFIXES as readonly string[]).includes(segments[0] ?? '')) id = segments[1]
  } else {
    return null
  }
  if (id === undefined || !VIDEO_ID.test(id)) return null
  return { videoId: id, url: `https://www.youtube.com/watch?v=${id}` }
}

/**
 * عنوان المشغّل المضمَّن: نطاق youtube-nocookie (لا يضع ملفات تعريف الارتباط قبل التشغيل).
 * يُستدعى فقط بعد نقر المستخدم على التشغيل؛ ويتحقق من المعرّف مرة ثانية ولا يثق بمن استدعاه.
 */
export function youtubeEmbedUrl(videoId: string): string | null {
  if (!VIDEO_ID.test(videoId)) return null
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`
}
