import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useUiStore } from '@/stores/ui-store'
import type { BackgroundScene, SceneColors } from './createBackgroundScene'
import { useEffectsAllowed } from './useEffectsAllowed'

/** ألوان المشهد من رموز التصميم الحالية (نفس تدرج الوصلات) وبحسب السمة. */
function readColors(): SceneColors {
  const style = getComputedStyle(document.documentElement)
  return {
    primary: style.getPropertyValue('--edge-from').trim() || '#a78bfa',
    secondary: style.getPropertyValue('--edge-to').trim() || '#f472b6',
    additive: document.documentElement.dataset.theme !== 'light',
  }
}

/**
 * حاوية المؤثر الزخرفي في لوحة التحكم. لا يُحمَّل Three.js إلا عند الحاجة الفعلية (مفعّل ومسموح)،
 * ولا يُركَّب أبداً في المحرر. أي فشل (WebGL غير متاح، فقدان السياق) يُسكت المؤثر فقط.
 * الحاوية aria-hidden وبلا استقبال للمؤشر، فلا تؤثر على التفاعل ولا قارئات الشاشة.
 */
export function BackgroundEffect({ className }: { className?: string }) {
  const enabled = useUiStore((state) => state.backgroundEffect)
  const allowed = useEffectsAllowed()
  const [failed, setFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const active = enabled && allowed && !failed

  useEffect(() => {
    const container = containerRef.current
    if (!container || !active) return
    let disposed = false
    let scene: BackgroundScene | null = null
    let observer: MutationObserver | null = null

    void import('./createBackgroundScene')
      .then(({ createBackgroundScene }) => {
        if (disposed) return
        scene = createBackgroundScene(container, readColors(), {
          followPointer: window.matchMedia('(pointer: fine)').matches,
          onContextLost: () => setFailed(true),
        })
        container.dataset.effect = 'running'
        // تبديل السمة يغيّر attribute على <html>: نعيد قراءة الألوان عندها
        observer = new MutationObserver(() => scene?.setColors(readColors()))
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      })
      .catch(() => {
        if (!disposed) setFailed(true) // WebGL غير متاح أو فشل تحميل الوحدة: نتجاهل المؤثر بصمت
      })

    return () => {
      disposed = true
      observer?.disconnect()
      scene?.dispose()
      delete container.dataset.effect
    }
  }, [active])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn('pointer-events-none select-none', className)}
      style={{
        // تلاشي الأطراف كي لا يظهر حدّ مستطيل
        maskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(closest-side, #000 55%, transparent 100%)',
      }}
    />
  )
}
