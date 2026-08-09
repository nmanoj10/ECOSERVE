import type { HTMLAttributes } from 'react'

export type AvatarSize = 'sm' | 'md' | 'lg'

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string
  src?: string
  size?: AvatarSize
}

const gradients = [
  'from-brand-500 to-emerald-500',
  'from-teal-500 to-brand-400',
  'from-emerald-600 to-teal-400',
  'from-brand-600 to-emerald-400',
  'from-lime-600 to-emerald-500',
]

const sizes: Record<AvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Avatar({ name, src, size = 'md', className = '', ...rest }: AvatarProps) {
  const hash = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const gradient = gradients[hash % gradients.length]

  if (src) {
    return (
      <span className={`inline-block shrink-0 overflow-hidden rounded-full ${sizes[size]} ${className}`} {...rest}>
        <img src={src} alt={name} className="size-full object-cover" />
      </span>
    )
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-semibold text-white ${sizes[size]} ${className}`}
      {...rest}
    >
      {initialsOf(name) || '?'}
    </span>
  )
}
