import { Sparkles } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useUiStore } from '@/stores/ui-store'
import { useEffectsAllowed } from './useEffectsAllowed'

/** مفتاح تشغيل/إيقاف المؤثر الزخرفي. يُعطَّل مع شرح إن كان النظام يطلب تقليل الحركة. */
export function EffectsToggle({ className }: { className?: string }) {
  const enabled = useUiStore((state) => state.backgroundEffect)
  const setEnabled = useUiStore((state) => state.setBackgroundEffect)
  const allowed = useEffectsAllowed()
  const on = enabled && allowed

  return (
    <IconButton
      label={
        !allowed
          ? 'Background effect is off because reduced motion is requested'
          : on
            ? 'Turn off background effect'
            : 'Turn on background effect'
      }
      aria-pressed={on}
      disabled={!allowed}
      onClick={() => setEnabled(!enabled)}
      className={cn('rounded-full', className)}
    >
      <Sparkles className={cn('size-5', on ? 'text-accent' : 'text-muted')} aria-hidden="true" />
    </IconButton>
  )
}
