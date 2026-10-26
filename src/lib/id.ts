/**
 * يولّد معرّفاً فريداً.
 * crypto.randomUUID متاح فقط في السياقات الآمنة (HTTPS أو localhost)،
 * لذلك نستخدم getRandomValues كبديل عند فتح التطبيق عبر http على الشبكة المحلية.
 */
export function createId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
