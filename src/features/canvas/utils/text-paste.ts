import type { XYPosition } from '@xyflow/react'
import type { CanvasNode } from '../types/nodes'
import { CONTENT_MAX_LENGTH, NODE_SIZES } from './constants'
import { normalizeUrl } from './link-url'
import { createLinkCard, createStickyNote, createTextCard } from './node-factory'

/** أقصى عدد بطاقات يُنشئها لصق واحد؛ ما زاد يُهمل مع إخبار المستخدم بدل إغراق اللوحة. */
export const MAX_PASTE_CARDS = 20

/** فقرة أطول من هذا تصير بطاقة نص (أوسع) بدل ورقة لاصقة. */
const STICKY_MAX_CHARS = 280

/** نقرأ من النص الملصوق ما يكفي لملء الحد الأقصى فقط: لصق ملف بحجم ميغابايتات لا يجب أن يجمّد الصفحة بتقطيعه كله. */
const MAX_PASTE_CHARS = MAX_PASTE_CARDS * (CONTENT_MAX_LENGTH + 2)

const GAP = 24

/**
 * لا نعامل كل كلمة كرابط: `normalizeUrl` يضيف https:// لأي نص بلا مسافات، فكلمة «hello» تصير https://hello.
 * هنا نطلب بروتوكولاً صريحاً أو بادئة www. فقط، ثم نترك التحقق الصارم (رفض javascript: وبيانات الدخول) لـ normalizeUrl.
 */
const LOOKS_LIKE_URL = /^(https?:\/\/|www\.)\S+$/i

export interface TextPastePlan {
  nodes: CanvasNode[]
  /** فقرات لم تُنشأ لها بطاقات لتجاوز الحد */
  skippedParagraphs: number
  /** بطاقات قُصّ نصها عند أقصى طول للمحتوى */
  truncatedCards: number
}

/** يقسم النص إلى فقرات بسطر فارغ؛ سطور متتالية بلا سطر فارغ تبقى فقرة واحدة (قائمة أو عنوان وتفاصيله). */
function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
}

function cardFor(paragraph: string, center: XYPosition, now: number): { node: CanvasNode; truncated: boolean } {
  if (!paragraph.includes('\n') && LOOKS_LIKE_URL.test(paragraph)) {
    const href = normalizeUrl(paragraph)
    if (href) {
      const link = createLinkCard(center, now)
      return { node: { ...link, data: { ...link.data, url: href } }, truncated: false }
    }
  }
  const truncated = paragraph.length > CONTENT_MAX_LENGTH
  const content = truncated ? paragraph.slice(0, CONTENT_MAX_LENGTH) : paragraph
  if (content.length <= STICKY_MAX_CHARS) {
    const sticky = createStickyNote(center, now)
    return { node: { ...sticky, data: { ...sticky.data, content } }, truncated }
  }
  const card = createTextCard(center, now)
  return { node: { ...card, data: { ...card.data, content } }, truncated }
}

/**
 * يحوّل نصاً ملصوقاً إلى بطاقات: رابط صريح في سطر وحده يصير بطاقة رابط، وكل فقرة غيره بطاقة (ورقة قصيرة أو نص طويل).
 * البطاقات تُرتَّب شبكة متمركزة حول نقطة اللصق بخلايا موحّدة كي لا تتداخل. دالة نقية: لا لمس للمخزن ولا لـ DOM.
 */
export function planTextPaste(text: string, center: XYPosition, now: number): TextPastePlan {
  const paragraphs = splitParagraphs(text.length > MAX_PASTE_CHARS ? text.slice(0, MAX_PASTE_CHARS) : text)
  const used = paragraphs.slice(0, MAX_PASTE_CARDS)
  const count = used.length
  if (count === 0) return { nodes: [], skippedParagraphs: 0, truncatedCards: 0 }

  const columns = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / columns)
  const cellWidth = Math.max(NODE_SIZES.sticky.width, NODE_SIZES.text.width, NODE_SIZES.link.width) + GAP
  const cellHeight = Math.max(NODE_SIZES.sticky.height, NODE_SIZES.text.height, NODE_SIZES.link.height) + GAP

  let truncatedCards = 0
  const nodes = used.map((paragraph, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const cardCenter = {
      x: center.x + (column - (columns - 1) / 2) * cellWidth,
      y: center.y + (row - (rows - 1) / 2) * cellHeight,
    }
    const { node, truncated } = cardFor(paragraph, cardCenter, now)
    if (truncated) truncatedCards += 1
    return node
  })
  return { nodes, skippedParagraphs: paragraphs.length - used.length, truncatedCards }
}
