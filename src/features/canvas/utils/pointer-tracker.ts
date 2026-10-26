/**
 * آخر موضع للمؤشر فوق اللوحة (بإحداثيات الشاشة).
 * نخزّنه خارج React وخارج Zustand عمداً: يتغير عشرات المرات في الثانية، ولا يحتاجه إلا
 * أمر "أضف عقدة عند المؤشر" لحظة تنفيذه، فلا داعي لإعادة رسم أي مكوّن بسببه.
 * (محرر واحد نشط في كل وقت، لذا متغير الوحدة كافٍ.)
 */
export interface ScreenPoint {
  x: number
  y: number
}

let lastPointer: ScreenPoint | null = null

export function setLastPointer(point: ScreenPoint | null): void {
  lastPointer = point
}

export function getLastPointer(): ScreenPoint | null {
  return lastPointer
}
