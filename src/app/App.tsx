import { useEffect } from 'react'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from '@/components/ui/Toaster'
import { useImageGarbageCollection } from '@/features/canvas/persistence/useImageGarbageCollection'
import { useUiStore } from '@/stores/ui-store'
import { router } from './router'

export function App() {
  const theme = useUiStore((state) => state.theme)
  useImageGarbageCollection()

  // مصدر الحقيقة للسمة هو ui-store؛ نعكسها على <html> ليعمل CSS بـ [data-theme]
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}
