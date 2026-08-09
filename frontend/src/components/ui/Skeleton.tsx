import type { HTMLAttributes } from 'react'

/** Animated loading placeholder. Pass `rounded-full` for circles, etc. */
export function Skeleton({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`animate-pulse rounded-lg bg-neutral-200/70 ${className}`} {...rest} />
}
