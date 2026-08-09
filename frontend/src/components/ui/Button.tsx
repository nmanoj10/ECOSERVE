import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** When set, renders a react-router Link with the same styling. */
  to?: string
  children: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700',
  secondary: 'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
  outline: 'border border-neutral-300 bg-transparent text-neutral-700 hover:bg-neutral-100',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/25 hover:bg-red-700',
  dark: 'bg-neutral-900 text-white hover:bg-neutral-700',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-6 text-base',
  icon: 'size-10 justify-center rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  to,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'inline-flex select-none items-center justify-center font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-60',
    variants[variant],
    sizes[size],
    className,
  ].join(' ')

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
