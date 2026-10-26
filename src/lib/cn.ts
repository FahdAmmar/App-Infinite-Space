import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** يدمج أسماء الأصناف ويحل تعارضات Tailwind (آخر صنف يفوز). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
