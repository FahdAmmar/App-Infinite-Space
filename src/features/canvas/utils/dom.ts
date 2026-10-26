/** هل يكتب المستخدم الآن في حقل نصي؟ عندها لا نلتقط الاختصارات (حرف «n» يجب أن يُكتب لا أن ينشئ عقدة). */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]') !== null
}
