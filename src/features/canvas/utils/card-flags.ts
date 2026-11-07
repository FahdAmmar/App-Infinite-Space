import type { CanvasNode, CardStatus } from '../types/nodes'

/** نسخة من data بلا مفتاح واحد (لإزالة القيمة الافتراضية بدل تخزينها) */
function omit<T extends object>(data: T, key: string): T {
  return Object.fromEntries(Object.entries(data).filter(([name]) => name !== key)) as T
}

/** ترتيب الدورة عند النقر على الدائرة: لا شيء ← قيد العمل ← تم ← لا شيء */
const NEXT_STATUS: Record<CardStatus, CardStatus> = { none: 'doing', doing: 'done', done: 'none' }

export function nextStatus(status: CardStatus): CardStatus {
  return NEXT_STATUS[status]
}

export function getStatus(node: CanvasNode): CardStatus {
  return node.data.status ?? 'none'
}

export function isLocked(node: CanvasNode): boolean {
  return node.data.locked === true
}

/** يضبط الحالة دون تخزين القيمة الافتراضية. المجموعات لا حالة لها فتُعاد كما هي. */
export function withStatus<T extends CanvasNode>(node: T, status: CardStatus, now: number): T {
  if (node.type === 'group' || getStatus(node) === status) return node
  return { ...node, data: { ...omit(node.data, 'status'), ...(status === 'none' ? {} : { status }), updatedAt: now } } as T
}

/**
 * القفل يعيش في مكانين لا يفترقان: data.locked (المحفوظ) وعلما React Flow draggable/deletable (السلوك).
 * syncLockFlags تشتق العلمين من data.locked (عند القراءة من التخزين)، وwithLocked تغيّر الاثنين معاً (عند فعل المستخدم)،
 * فلا تصير بطاقة «مقفلة في الملف» وهي قابلة للسحب على الشاشة.
 */
export function syncLockFlags<T extends CanvasNode>(node: T): T {
  const next = { ...node } as T
  if (isLocked(node)) {
    next.draggable = false
    next.deletable = false
  } else {
    delete next.draggable
    delete next.deletable
  }
  return next
}

export function withLocked<T extends CanvasNode>(node: T, locked: boolean, now: number): T {
  if (isLocked(node) === locked) return node
  return syncLockFlags({ ...node, data: { ...omit(node.data, 'locked'), ...(locked ? { locked: true } : {}), updatedAt: now } } as T)
}
