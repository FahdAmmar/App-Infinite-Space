import { createContext, useContext } from 'react'

export interface PersistenceActions {
  /** إعادة محاولة الحفظ بعد فشل */
  retry: () => void
  /** true حين حفظ تبويب آخر تغييراً في هذه المساحة بعد أن حمّلناها (الحفظ هنا موقوف حتى يقرر المستخدم) */
  externalChange: boolean
  /** الإبقاء على نسخة هذا التبويب: يستأنف الحفظ وستحل نسخته محل تعديلات التبويب الآخر */
  keepMine: () => void
  /** تحميل أحدث نسخة من التخزين وتجاهل ما لم يُحفظ في هذا التبويب */
  reloadLatest: () => void
  /** يكتب ما لم يُحفظ بعد فوراً (قبل التصدير مثلاً، كي يشمل آخر تعديل) */
  flush: () => Promise<void>
}

export const PersistenceContext = createContext<PersistenceActions | null>(null)

export function usePersistence(): PersistenceActions {
  const value = useContext(PersistenceContext)
  if (!value) throw new Error('usePersistence must be used inside <CanvasPersistenceProvider>')
  return value
}
