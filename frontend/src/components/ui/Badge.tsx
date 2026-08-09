import type { HTMLAttributes } from 'react'

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'outline'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  /** Renders a small colored dot before the label. */
  dot?: boolean
}

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-100',
  outline: 'border border-neutral-200 bg-white text-neutral-600',
}

const dotColors: Record<BadgeVariant, string> = {
  neutral: 'bg-neutral-400',
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  outline: 'bg-neutral-400',
}

export function Badge({ variant = 'neutral', dot = false, className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...rest}
    >
      {dot && <span className={`size-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  )
}
