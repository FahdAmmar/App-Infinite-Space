import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * مساعد اختبار لمكوّنات React دون مكتبة إضافية: يستعمل createRoot و act مباشرة.
 * السبب: قواعد المشروع تمنع إضافة تبعية اختبار دون قرار صريح، وهذا يكفي لاختبار السلوك المرئي.
 */
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export interface Rendered {
  container: HTMLElement
  unmount: () => Promise<void>
}

export async function renderNode(node: ReactNode): Promise<Rendered> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  await act(async () => {
    root.render(node)
  })
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

/** ينقر عنصراً داخل act ليُطبَّق أي تحديث حالة قبل الفحص. */
export async function click(element: Element | null): Promise<void> {
  if (!element) throw new Error('click(): element not found')
  await act(async () => {
    ;(element as HTMLElement).click()
  })
}
