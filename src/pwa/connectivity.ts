import type { ToastKind, ToastOptions } from '@/stores/ui-store'

type PushToast = (kind: ToastKind, message: string, options?: ToastOptions) => void

export const OFFLINE_TOAST_ID = 'offline'

/**
 * يتابع الاتصال ويعرض رسالة دائمة «غير متصل» ما دام الاتصال مفقوداً. البيانات محلية دائماً، فالرسالة
 * تطمئن المستخدم بأن عمله محفوظ على الجهاز، وتختفي عند العودة (مع تأكيد قصير).
 * تعيد دالة إيقاف المتابعة.
 */
export function watchConnectivity(
  push: PushToast,
  dismiss: (id: string) => void,
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  isOnline: () => boolean = () => navigator.onLine,
): () => void {
  let wasOffline = false
  const showOffline = () => {
    wasOffline = true
    push('info', 'You are offline. Your work is still saved on this device.', { id: OFFLINE_TOAST_ID, sticky: true })
  }
  const showOnline = () => {
    dismiss(OFFLINE_TOAST_ID)
    if (wasOffline) push('success', 'Back online.')
    wasOffline = false
  }
  if (!isOnline()) showOffline()
  target.addEventListener('offline', showOffline)
  target.addEventListener('online', showOnline)
  return () => {
    target.removeEventListener('offline', showOffline)
    target.removeEventListener('online', showOnline)
  }
}
