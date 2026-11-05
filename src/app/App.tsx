import { useEffect } from 'react'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from '@/components/ui/Toaster'
import { useImageGarbageCollection } from '@/features/canvas/persistence/useImageGarbageCollection'
import { useUiStore } from '@/stores/ui-store'
import { router } from './router'

export function App() {
  const theme = useUiStore((state) => state.theme)
  const themeMode = useUiStore((state) => state.themeMode)
  const highContrast = useUiStore((state) => state.highContrast)
  useImageGarbageCollection()

  // مصدر الحقيقة للسمة هو ui-store؛ نعكسها على <html> ليعمل CSS بـ [data-theme] و[data-contrast]
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    if (highContrast) document.documentElement.dataset.contrast = 'high'
    else delete document.documentElement.dataset.contrast
  }, [highContrast])

  // الوضع التلقائي: يتبع تفضيل النظام الآن وكلما تغيّر (مثلاً جدولة الوضع الليلي)
  useEffect(() => {
    if (themeMode !== 'system' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => useUiStore.getState().syncSystemTheme(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [themeMode])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}
