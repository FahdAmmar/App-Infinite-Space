import { MAX_TAGS, TAG_MAX_LENGTH } from './constants'

/**
 * يحوّل ما كتبه المستخدم إلى وسم نظيف: بلا # أو فواصل أو محارف تحكم، والمسافات تصبح شرطة،
 * ويُقصّ إلى الحد الأقصى. يعمل مع الحروف العربية لأننا لا نقيّد الأبجدية.
 */
export function normalizeTag(raw: string): string {
  return (
    raw
      // eslint-disable-next-line no-control-regex -- نزيل محارف التحكم عمداً (قد تأتي من اللصق)
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[#,،]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, TAG_MAX_LENGTH)
  )
}

/** يضيف وسماً إن كان صالحاً وغير مكرر (بغض النظر عن حالة الأحرف) ولم يُتجاوز الحد؛ وإلا يعيد القائمة كما هي. */
export function addTag(tags: readonly string[], raw: string): string[] {
  const tag = normalizeTag(raw)
  if (tag === '' || tags.length >= MAX_TAGS) return [...tags]
  const exists = tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())
  return exists ? [...tags] : [...tags, tag]
}

export function removeTag(tags: readonly string[], tag: string): string[] {
  return tags.filter((existing) => existing !== tag)
}
