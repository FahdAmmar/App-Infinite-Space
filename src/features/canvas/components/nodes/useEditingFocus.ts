import { useEffect, type FocusEvent, type RefObject } from 'react'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'

/**
 * للبطاقات التي حقولها حيّة دائماً (قائمة المهام، الفيديو) بخلاف بطاقات النص التي لها وضع تحرير منفصل.
 *
 * حالة «التحرير» في المخزن (editingNodeId) تُضبط عند إنشاء بطاقة جديدة وعند F2 وقائمة السياق، وطالما هي مضبوطة تتعطل
 * اختصارات لوحة المفاتيح وتختفي لوحة الخصائص. هنا تعني «ضع التركيز على الحقل الأول»، وتُحرَّر عندما يغادر التركيز البطاقة،
 * أو فوراً إن لم يكن هناك حقل يُركَّز عليه. بدون هذا تبقى الاختصارات معطلة بعد إنشاء البطاقة بلا أي إشارة للمستخدم.
 */
export function useEditingFocus(id: string, primary: RefObject<HTMLElement | null>, canFocus = true) {
  const api = useCanvasStoreApi()
  const isEditing = useCanvasStore((state) => state.editingNodeId === id)

  useEffect(() => {
    if (!isEditing) return
    const target = primary.current
    if (canFocus && target) target.focus({ preventScroll: true })
    else api.getState().stopEditing(id)
  }, [api, canFocus, id, isEditing, primary])

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (isEditing && !event.currentTarget.contains(event.relatedTarget as Node | null)) api.getState().stopEditing(id)
  }
  return { isEditing, onBlur }
}
