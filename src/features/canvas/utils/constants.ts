import type { CanvasEdgeData, EdgeColorId } from '../types/edges'
import type { CreatableNodeKind, StickyColorId } from '../types/nodes'

/**
 * ألوان الأوراق اللاصقة تتبع السمة (انظر متغيرات --sticky-* في styles/index.css):
 *  - الداكن: بطاقات ملوّنة معتمة بحد فاتح ونص أبيض (مراجع Scrintal/Lattics).
 *  - الفاتح: أوراق ساطعة بظل ورقي ونص داكن (مرجع Miro).
 * نخزّن هنا أسماء المتغيرات فقط، فيعمل التبديل بين السمتين دون إعادة رسم أو منطق إضافي،
 * ويصلح نفس النص للخريطة المصغّرة (fill: var(...)) ولأزرار الألوان.
 */
export const STICKY_COLORS: Record<StickyColorId, { label: string; bg: string; border: string; ink: string }> = {
  yellow: { label: 'Yellow', bg: 'var(--sticky-yellow-bg)', border: 'var(--sticky-yellow-border)', ink: 'var(--sticky-yellow-ink)' },
  blue: { label: 'Blue', bg: 'var(--sticky-blue-bg)', border: 'var(--sticky-blue-border)', ink: 'var(--sticky-blue-ink)' },
  green: { label: 'Green', bg: 'var(--sticky-green-bg)', border: 'var(--sticky-green-border)', ink: 'var(--sticky-green-ink)' },
  pink: { label: 'Pink', bg: 'var(--sticky-pink-bg)', border: 'var(--sticky-pink-border)', ink: 'var(--sticky-pink-ink)' },
  purple: { label: 'Purple', bg: 'var(--sticky-purple-bg)', border: 'var(--sticky-purple-border)', ink: 'var(--sticky-purple-ink)' },
  neutral: { label: 'Neutral', bg: 'var(--sticky-neutral-bg)', border: 'var(--sticky-neutral-border)', ink: 'var(--sticky-neutral-ink)' },
}

export const DEFAULT_STICKY_COLOR: StickyColorId = 'yellow'

/** الأبعاد الافتراضية والدنيا بوحدات اللوحة (قبل التكبير) */
export const NODE_SIZES: Record<
  CreatableNodeKind,
  { width: number; height: number; minWidth: number; minHeight: number }
> = {
  sticky: { width: 232, height: 208, minWidth: 160, minHeight: 140 },
  text: { width: 360, height: 240, minWidth: 240, minHeight: 150 },
  link: { width: 300, height: 176, minWidth: 220, minHeight: 130 },
  group: { width: 520, height: 360, minWidth: 240, minHeight: 180 },
}

/**
 * الصور: العرض فقط يتغير بسحب المقابض، والارتفاع يُشتق من نسبة الأبعاد الأصلية (CSS aspect-ratio)،
 * فلا يمكن تشويه الصورة أبداً دون كود إضافي لحساب النسبة.
 */
export const IMAGE_LIMITS = {
  acceptedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
  /** حد حجم الملف: يحمي الذاكرة والتخزين المحلي */
  maxBytes: 10 * 1024 * 1024,
  /** حد عدد البكسلات بعد فك الترميز (صورة ضخمة بحجم ملف صغير قد تجمّد المتصفح) */
  maxPixels: 40_000_000,
  defaultWidth: 280,
  /** أقصى ارتفاع ابتدائي: الصور الطويلة جداً تُصغَّر عرضاً كي لا تغطي اللوحة */
  maxInitialHeight: 420,
  minWidth: 140,
  maxWidth: 1200,
} as const

/**
 * أقصى حجم للوحة. يُفرض عند الإنشاء (إضافة، نسخ، وصل) وعند القراءة معاً: لو فُرض عند القراءة فقط لأمكن
 * إنشاء عناصر أكثر منه ثم فقدان الزيادة بصمت عند فتح اللوحة وحفظها من جديد.
 * القيمة هي أكبر حجم اختُبر فعلاً مع أداء مقبول (اختبار الحمل في e2e/phase6_stress.py): عند 10,000 عنصر
 * ثبت أن الفتح والتحريك يصيران بطيئين بوضوح، فلم نرفع الحد إليها.
 */
export const CANVAS_LIMITS = { maxNodes: 5_000, maxEdges: 10_000 } as const

/** أقصى عدد ملفات تُضاف دفعة واحدة (سحب وإفلات عدة ملفات) */
export const MAX_FILES_PER_DROP = 12

/** حدود الحقول النصية الإضافية */
export const DESCRIPTION_MAX_LENGTH = 500
export const URL_MAX_LENGTH = 2048
export const GROUP_LABEL_MAX_LENGTH = 60
export const EDGE_LABEL_MAX_LENGTH = 60
export const MAX_TAGS = 8
export const TAG_MAX_LENGTH = 24

/**
 * ألوان الوصلات: متغيرات CSS تتبدل مع السمة. 'gradient' يرسم تدرجاً من from إلى to على طول الخط
 * (بنفسجي ← وردي كما في المرجع الأول)، وباقي الألوان لون واحد (from = to).
 */
export const EDGE_COLORS: Record<EdgeColorId, { label: string; from: string; to: string }> = {
  gradient: { label: 'Gradient', from: 'var(--edge-from)', to: 'var(--edge-to)' },
  violet: { label: 'Violet', from: 'var(--edge-violet)', to: 'var(--edge-violet)' },
  pink: { label: 'Pink', from: 'var(--edge-pink)', to: 'var(--edge-pink)' },
  blue: { label: 'Blue', from: 'var(--edge-blue)', to: 'var(--edge-blue)' },
  green: { label: 'Green', from: 'var(--edge-green)', to: 'var(--edge-green)' },
  amber: { label: 'Amber', from: 'var(--edge-amber)', to: 'var(--edge-amber)' },
  neutral: { label: 'Neutral', from: 'var(--edge-neutral)', to: 'var(--edge-neutral)' },
}

export const DEFAULT_EDGE_DATA: CanvasEdgeData = {
  curve: 'curved',
  lineStyle: 'solid',
  arrow: 'end',
  color: 'gradient',
  label: '',
}

/** حدود النصوص داخل العقد (تُطبَّق على حقول الإدخال) */
export const TITLE_MAX_LENGTH = 120
export const CONTENT_MAX_LENGTH = 5000

export const ZOOM_LIMITS = { min: 0.1, max: 3 } as const

/** إزاحة النسخة المكررة عن الأصل بوحدات اللوحة */
export const DUPLICATE_OFFSET = 32

/** حدود تغيير الحجم لكل نوع: يستعملها مقبض السحب ومدخلات لوحة الخصائص بالقيم نفسها فلا يختلفان. */
export interface ResizeLimits {
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
}

const MAX_NODE_SIDE = 4000

export function getResizeLimits(type: keyof typeof NODE_SIZES | 'image'): ResizeLimits {
  if (type === 'image') {
    return { minWidth: IMAGE_LIMITS.minWidth, minHeight: 0, maxWidth: IMAGE_LIMITS.maxWidth, maxHeight: MAX_NODE_SIDE }
  }
  const { minWidth, minHeight } = NODE_SIZES[type]
  return { minWidth, minHeight, maxWidth: MAX_NODE_SIDE, maxHeight: MAX_NODE_SIDE }
}

/** ألوان النص المقترحة للورقة اللاصقة (null = لون الورقة الافتراضي الذي يتبع السمة) */
export const TEXT_COLORS: ReadonlyArray<{ id: string; label: string; value: string | null }> = [
  { id: 'default', label: 'Default', value: null },
  { id: 'white', label: 'White', value: '#ffffff' },
  { id: 'dark', label: 'Dark', value: '#1e1e1e' },
  { id: 'violet', label: 'Violet', value: '#6d4bd8' },
  { id: 'rose', label: 'Rose', value: '#c0264b' },
  { id: 'green', label: 'Green', value: '#17703f' },
]
