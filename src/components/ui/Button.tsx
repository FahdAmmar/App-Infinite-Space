import type { ComponentProps } from 'react'
import { buttonStyles, type ButtonSize, type ButtonVariant } from './button-styles'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />
}

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label'> {
  /** مطلوب: الأزرار التي تحوي أيقونة فقط يجب أن يكون لها اسم نصي لقارئ الشاشة */
  label: string
  variant?: ButtonVariant
}

export function IconButton({ label, variant = 'ghost', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={buttonStyles({ variant, size: 'icon', className })}
      {...props}
    />
  )
}
