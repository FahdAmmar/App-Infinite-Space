/**
 * روابط البطاقات: `/w/<مساحة>?card=<بطاقة>`. تعمل داخل المتصفح نفسه فقط (البيانات محلية)،
 * وغايتها الانتقال السريع بين المساحات واللوحات الكبيرة، لا المشاركة مع الآخرين.
 */

/** معرّفات التطبيق UUID أو 32 خانة سداسية؛ نقبل شكلاً عاماً ونرفض كل ما عداه قبل لمسه الواجهة. */
const CARD_ID_PATTERN = /^[0-9a-zA-Z-]{8,64}$/

export const CARD_PARAM = 'card'

export function buildCardLink(origin: string, workspaceId: string, cardId: string): string {
  return `${origin}/w/${encodeURIComponent(workspaceId)}?${CARD_PARAM}=${encodeURIComponent(cardId)}`
}

/** قيمة المعامل إن كانت معرّفاً مقبولاً، وإلا null (نص عشوائي من رابط معدَّل يدوياً لا يؤثر في شيء). */
export function parseCardParam(value: string | null): string | null {
  if (value === null) return null
  return CARD_ID_PATTERN.test(value) ? value : null
}
