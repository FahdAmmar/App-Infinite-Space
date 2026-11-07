import { describe, expect, it } from 'vitest'
import { parseYouTubeUrl, youtubeEmbedUrl } from './video-url'

const ID = 'dQw4w9WgXcQ'
const canonical = `https://www.youtube.com/watch?v=${ID}`

describe('parseYouTubeUrl: accepted forms', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&list=PL123&t=42s`,
    `http://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `youtu.be/${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `  https://youtu.be/${ID}  `,
    `https://WWW.YOUTUBE.COM/watch?v=${ID}`,
  ])('reads %s', (input) => {
    expect(parseYouTubeUrl(input)).toEqual({ videoId: ID, url: canonical })
  })

  it('accepts ids that contain dashes and underscores', () => {
    expect(parseYouTubeUrl('https://youtu.be/a-b_c-d_e-f')?.videoId).toBe('a-b_c-d_e-f')
  })
})

describe('parseYouTubeUrl: rejected input', () => {
  it.each([
    ['empty', ''],
    ['spaces only', '   '],
    ['not a url', 'just words'],
    ['javascript scheme', `javascript:alert(1)//youtube.com/watch?v=${ID}`],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['ftp scheme', `ftp://youtube.com/watch?v=${ID}`],
    ['file scheme', 'file:///etc/passwd'],
    ['lookalike subdomain', `https://youtube.com.evil.com/watch?v=${ID}`],
    ['lookalike prefix', `https://evilyoutube.com/watch?v=${ID}`],
    ['youtube only in the path', `https://evil.com/youtube.com/watch?v=${ID}`],
    ['youtube only in the query', `https://evil.com/?u=https://youtu.be/${ID}`],
    ['credentials in the url', `https://youtube.com@evil.com/watch?v=${ID}`],
    ['user and password', `https://user:pw@www.youtube.com/watch?v=${ID}`],
    ['custom port', `https://www.youtube.com:8443/watch?v=${ID}`],
    ['id too short', 'https://youtu.be/abc'],
    ['id too long', `https://youtu.be/${ID}x`],
    ['id with bad characters', 'https://youtu.be/dQw4w9WgXc"'],
    ['id with html', 'https://www.youtube.com/watch?v=<script>aaa'],
    ['missing id', 'https://www.youtube.com/watch'],
    ['channel page', 'https://www.youtube.com/@somechannel'],
    ['playlist page', 'https://www.youtube.com/playlist?list=PL12345678901'],
    ['whitespace inside', `https://youtu.be/${ID} extra`],
    ['absurdly long', `https://www.youtube.com/watch?v=${ID}&x=${'a'.repeat(5000)}`],
  ])('rejects %s', (_name, input) => {
    expect(parseYouTubeUrl(input)).toBeNull()
  })
})

describe('youtubeEmbedUrl', () => {
  it('builds a youtube-nocookie embed URL from a valid id only', () => {
    expect(youtubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&playsinline=1`)
  })

  it('refuses anything that is not an 11-character id, so no text can be injected into the iframe address', () => {
    for (const bad of ['', 'short', `${ID}x`, `${ID}"><script>`, '../../evil', 'dQw4w9WgXc/', 'dQw4w9WgX?a']) expect(youtubeEmbedUrl(bad)).toBeNull()
  })
})
