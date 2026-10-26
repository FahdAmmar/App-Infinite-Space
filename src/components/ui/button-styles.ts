import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'icon'

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-[background-color,filter,box-shadow,color] duration-150 disabled:pointer-events-none disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  // أبيض بنص أسود في الداكن وعكسه في الفاتح (زر Share في المرجع 1)
  primary: 'bg-primary text-primary-ink hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:bg-raised hover:border-muted/50',
  ghost: 'text-muted hover:bg-raised hover:text-ink',
  danger: 'bg-danger text-danger-ink hover:brightness-110',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-full px-4 text-sm',
  md: 'h-11 rounded-full px-6 text-[0.95rem]',
  icon: 'size-10 rounded-xl',
}

/** أنماط الأزرار مفصولة عن المكوّن لتُستخدم أيضاً على الروابط (<Link>) دون تكرار. */
export function buttonStyles({
  variant = 'secondary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}): string {
  return cn(base, variants[variant], sizes[size], className)
}
