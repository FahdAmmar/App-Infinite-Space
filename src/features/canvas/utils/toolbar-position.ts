/**
 * الإزاحة الأفقية (بالبكسل) التي تُدخل شريطاً عائماً كله إلى الشاشة بهامش `gap` من كل جانب.
 * شريط الإجراءات يتمركز فوق البطاقة المحددة، فعند بطاقة قريبة من حافة الهاتف يخرج جزء منه ولا يمكن الضغط على أزراره.
 * إن كان أعرض من المتاح نحاذيه إلى اليسار (أهم أزراره في بدايته) بدل أن نقصّ الطرفين معاً.
 */
export function clampShiftIntoView(left: number, right: number, viewportWidth: number, gap: number): number {
  const width = right - left
  if (width >= viewportWidth - gap * 2) return gap - left
  if (left < gap) return gap - left
  if (right > viewportWidth - gap) return viewportWidth - gap - right
  return 0
}

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ToolbarSafeArea {
  /** هامش جانبي وسفلي من حافة الشاشة */
  gap: number
  /** أعلى نقطة مسموحة: تحت شريط العنوان العائم */
  top: number
  /** المسافة بين الشريط والتحديد (نفس offset لـ NodeToolbar) */
  offset: number
  /** أدنى نقطة مسموحة للشريط إن كانت أعلى من حافة الشاشة (مثلاً أعلى لوحة خصائص أو أزرار تحكم تقع تحت التحديد) */
  bottom?: number
}

/**
 * إزاحة الشريط العائم (أفقياً ورأسياً) ليبقى مقروءاً ومتاحاً للمس.
 * أفقياً: يدخل الشاشة. رأسياً: إن لم تتسع المساحة فوق التحديد (يغطيها شريط العنوان) ينقلب أسفل التحديد،
 * وإن لم تتسع أسفله أيضاً ينزل إلى أعلى منطقة آمنة فيغطي حافة التحديد العليا بدل أن يختفي.
 * `bar` موضع الشريط الأصلي (فوق التحديد) قبل أي إزاحة، و`selection` حدود المحدد على الشاشة.
 */
export function computeToolbarShift(
  bar: Box,
  selection: Box | null,
  viewport: { width: number; height: number },
  safe: ToolbarSafeArea,
): { x: number; y: number } {
  const x = clampShiftIntoView(bar.left, bar.right, viewport.width, safe.gap)
  if (bar.top >= safe.top) return { x, y: 0 }
  const height = bar.bottom - bar.top
  if (selection) {
    const belowTop = selection.bottom + safe.offset
    const limit = Math.min(viewport.height - safe.gap, safe.bottom ?? Infinity)
    if (belowTop + height <= limit) return { x, y: belowTop - bar.top }
  }
  return { x, y: safe.top - bar.top }
}
