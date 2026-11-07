import { normalizeUrl } from './link-url'

/**
 * ماركداون خفيف لبطاقات النص: عناوين، قوائم نقطية ورقمية ومهام، اقتباس، وفي السطر الواحد:
 * **غامق** و*مائل* و`كود` و[نص](رابط).
 *
 * قرارات الأمان والتوافق:
 *  - الخرج شجرة بيانات (AST) تُرسَم بعناصر React؛ لا HTML خام ولا dangerouslySetInnerHTML، فوسم مثل <script> يبقى نصاً.
 *  - الروابط http/https الصريحة فقط (وتمرّ على normalizeUrl الذي يرفض javascript: وبيانات الدخول)؛ غير ذلك يبقى نصاً.
 *  - النص العادي بلا رموز ماركداون يعود فقرة واحدة تحفظ أسطرها الجديدة، فلا يتغير شكل البطاقات القديمة.
 *  - الحجم محدود أصلاً (CONTENT_MAX_LENGTH) وعمق التداخل محدود، فلا انفجار في الأداء من مدخل عدائي.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; children: Inline[] }
  | { kind: 'italic'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; children: Inline[] }

export interface ListItem {
  inline: Inline[]
  /** null = عنصر عادي، 'open' و'done' = مهمة غير منجزة/منجزة (- [ ] و- [x]) */
  task: 'open' | 'done' | null
}

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; inline: Inline[] }
  | { kind: 'paragraph'; inline: Inline[] }
  | { kind: 'quote'; inline: Inline[] }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }

const MAX_INLINE_DEPTH = 3

const isWordChar = (char: string | undefined): boolean => char !== undefined && /[\p{L}\p{N}]/u.test(char)
const isSpace = (char: string | undefined): boolean => char === undefined || /\s/.test(char)

export function parseInline(source: string, depth = 0): Inline[] {
  const out: Inline[] = []
  let buffer = ''
  const flush = (): void => {
    if (buffer !== '') {
      out.push({ kind: 'text', text: buffer })
      buffer = ''
    }
  }

  let i = 0
  while (i < source.length) {
    const char = source[i] as string

    if (char === '`') {
      const end = source.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ kind: 'code', text: source.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    if (depth < MAX_INLINE_DEPTH) {
      if (source.startsWith('**', i)) {
        const end = source.indexOf('**', i + 2)
        if (end > i + 2 && !isSpace(source[i + 2]) && !isSpace(source[end - 1])) {
          flush()
          out.push({ kind: 'bold', children: parseInline(source.slice(i + 2, end), depth + 1) })
          i = end + 2
          continue
        }
      }

      if (char === '*' || char === '_') {
        const end = source.indexOf(char, i + 1)
        // «_» داخل كلمة (snake_case) ليس مائلاً؛ و«*» يحتاج محتوى لا يبدأ ولا ينتهي بمسافة
        const wordSafe = char === '*' || (!isWordChar(source[i - 1]) && !isWordChar(source[end + 1]))
        if (end > i + 1 && !isSpace(source[i + 1]) && !isSpace(source[end - 1]) && wordSafe) {
          flush()
          out.push({ kind: 'italic', children: parseInline(source.slice(i + 1, end), depth + 1) })
          i = end + 1
          continue
        }
      }

      if (char === '[') {
        const middle = source.indexOf('](', i + 1)
        const end = middle > i ? source.indexOf(')', middle + 2) : -1
        if (middle > i + 1 && end > middle + 2) {
          const target = source.slice(middle + 2, end)
          const href = /^https?:\/\//i.test(target) ? normalizeUrl(target) : null
          if (href !== null) {
            flush()
            out.push({ kind: 'link', href, children: parseInline(source.slice(i + 1, middle), depth + 1) })
            i = end + 1
            continue
          }
        }
      }
    }

    buffer += char
    i += 1
  }
  flush()
  return out
}

const HEADING = /^(#{1,3})\s+(.*)$/
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const ORDERED = /^\s*\d{1,3}[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: ListItem[] } | null = null
  let quote: string[] = []

  const flushParagraph = (): void => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', inline: parseInline(paragraph.join('\n')) })
    paragraph = []
  }
  const flushList = (): void => {
    if (list) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items })
    list = null
  }
  const flushQuote = (): void => {
    if (quote.length > 0) blocks.push({ kind: 'quote', inline: parseInline(quote.join('\n')) })
    quote = []
  }
  const flushAll = (): void => {
    flushParagraph()
    flushList()
    flushQuote()
  }
  const addItem = (ordered: boolean, item: ListItem): void => {
    if (list && list.ordered !== ordered) flushList()
    list ??= { ordered, items: [] }
    list.items.push(item)
  }

  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() === '') {
      flushAll()
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      flushAll()
      blocks.push({ kind: 'heading', level: (heading[1] as string).length as 1 | 2 | 3, inline: parseInline(heading[2] as string) })
      continue
    }
    const task = TASK.exec(line)
    if (task) {
      flushParagraph()
      flushQuote()
      addItem(false, { inline: parseInline(task[2] as string), task: task[1] === ' ' ? 'open' : 'done' })
      continue
    }
    const bullet = BULLET.exec(line)
    if (bullet) {
      flushParagraph()
      flushQuote()
      addItem(false, { inline: parseInline(bullet[1] as string), task: null })
      continue
    }
    const ordered = ORDERED.exec(line)
    if (ordered) {
      flushParagraph()
      flushQuote()
      addItem(true, { inline: parseInline(ordered[1] as string), task: null })
      continue
    }
    const quoted = QUOTE.exec(line)
    if (quoted) {
      flushParagraph()
      flushList()
      quote.push(quoted[1] as string)
      continue
    }
    flushList()
    flushQuote()
    paragraph.push(line)
  }
  flushAll()
  return blocks
}
