import { useEffect } from 'react'
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUiStore, type Toast, type ToastKind } from '@/stores/ui-store'
import { IconButton } from './Button'

const ICONS: Record<ToastKind, typeof Info> = {
  success: CircleCheck,
  error: TriangleAlert,
  info: Info,
}

const ICON_COLORS: Record<ToastKind, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-accent',
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useUiStore((state) => state.dismissToast)
  const Icon = ICONS[toast.kind]

  // رسائل النجاح والمعلومات تختفي وحدها؛ الأخطاء تبقى حتى يغلقها المستخدم لأنها تتطلب انتباهاً
  useEffect(() => {
    if (toast.kind === 'error') return
    const timer = window.setTimeout(() => dismiss(toast.id), 5000)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.kind, dismiss])

  return (
    <div className="pointer-events-auto flex w-full max-w-md animate-toast-in items-start gap-3 rounded-2xl border border-line bg-raised p-4 shadow-pop">
      <Icon className={cn('mt-0.5 size-5 shrink-0', ICON_COLORS[toast.kind])} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm leading-relaxed">{toast.message}</p>
      <IconButton label="Dismiss notification" onClick={() => dismiss(toast.id)} className="-mr-2 -mt-2 size-8">
        <X className="size-4" aria-hidden="true" />
      </IconButton>
    </div>
  )
}

/**
 * منطقة إشعارات دائمة الوجود في DOM مع aria-live، لأن قارئات الشاشة تُعلن
 * المحتوى المضاف إلى منطقة حية موجودة مسبقاً بشكل أوثق من منطقة تُنشأ مع الرسالة.
 */
export function Toaster() {
  const toasts = useUiStore((state) => state.toasts)

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[4.75rem] z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
