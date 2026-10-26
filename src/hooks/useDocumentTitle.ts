import { useEffect } from 'react'

/** عنوان التبويب يتغير مع الصفحة (مهم للتنقل وقارئات الشاشة). */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
