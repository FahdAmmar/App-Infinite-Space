import { useEffect } from 'react'
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUiStore, type Toast, type ToastKind } from '@/stores/ui-store'
import { Button, IconButton } from './Button'
import { TOAST_DURATION_MS } from './toast-durations'

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

  // كل الرسائل تختفي وحدها (زر الإغلاق يبقى متاحاً). الأخطاء أطول مهلة لأنها تحتاج قراءة، لكنها رفض مؤقت
  // (وصل غير مسموح، حد الحجم) لا فشل حفظ؛ لو بقيت حتى الإغلاق لغطّت شريط أدوات التحديد (لوحظ في فحص المتصفح)
  useEffect(() => {
    if (toast.sticky) return // الرسائل الدائمة (إصدار جديد، عدم اتصال) تُغلق بالزر أو بالبرنامج فقط
    const timer = window.setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS[toast.kind])
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.kind, toast.sticky, dismiss])

  return (
    <div className="pointer-events-auto flex w-full max-w-md animate-toast-in items-start gap-3 rounded-2xl border border-line bg-raised p-4 shadow-pop">
      <Icon className={cn('mt-0.5 size-5 shrink-0', ICON_COLORS[toast.kind])} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm leading-relaxed">{toast.message}</p>
      {toast.action && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            toast.action?.run()
            dismiss(toast.id)
          }}
        >
          {toast.action.label}
        </Button>
      )}
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
      className="pointer-events-none fixed inset-x-0 top-[calc(4.75rem+var(--safe-top))] z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
