import { useUiStore, type ToastKind, type ToastOptions } from '@/stores/ui-store'

type PushToast = (kind: ToastKind, message: string, options?: ToastOptions) => void

/**
 * يعرض «إصدار جديد جاهز» مع زر إعادة التحميل. الإصدار الجديد ينتظر في الخلفية حتى يوافق المستخدم، فالكود لا يتبدل
 * تحت يده وهو يحرر. الضغط يطلب من العامل المنتظر التفعيل، وتعيد الصفحة تحميل نفسها عند تبدّل المتحكم.
 * إعادة التحميل تمر بتأكيد المتصفح إن كانت هناك تعديلات لم تُحفظ بعد (beforeunload).
 */
export function offerUpdate(
  worker: Pick<ServiceWorker, 'postMessage'>,
  push: PushToast,
  container: Pick<ServiceWorkerContainer, 'addEventListener'>,
  reload: () => void,
): void {
  push('info', 'A new version of InfiniteSpace is ready.', {
    id: 'sw-update',
    sticky: true,
    action: {
      label: 'Reload',
      run: () => {
        container.addEventListener('controllerchange', reload, { once: true })
        worker.postMessage({ type: 'SKIP_WAITING' })
      },
    },
  })
}

const UPDATE_CHECK_MS = 60 * 60 * 1000

/** يسجّل خدمة العمل في الإنتاج فقط. أي فشل في التسجيل لا يعطّل التطبيق (يعمل كموقع عادي). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const push: PushToast = (kind, message, options) => useUiStore.getState().pushToast(kind, message, options)
  const container = navigator.serviceWorker
  const reload = () => window.location.reload()

  window.addEventListener('load', () => {
    container
      .register('/sw.js')
      .then((registration) => {
        // العرض فقط إن كان هناك متحكم حالي: أول تثبيت ليس «تحديثاً»
        const watch = (worker: ServiceWorker | null) =>
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && container.controller) offerUpdate(worker, push, container, reload)
          })
        if (registration.waiting && container.controller) offerUpdate(registration.waiting, push, container, reload)
        registration.addEventListener('updatefound', () => watch(registration.installing))
        window.setInterval(() => void registration.update().catch(() => undefined), UPDATE_CHECK_MS)
      })
      .catch(() => undefined)
  })
}
