import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}
      {...rest}
    />
  )
}

export function CardHeader({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-wrap items-start justify-between gap-3 px-6 pt-6 ${className}`} {...rest} />
}

export function CardTitle({ className = '', ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-base font-semibold tracking-tight text-neutral-900 ${className}`} {...rest} />
}

export function CardDescription({ className = '', ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`mt-0.5 text-sm text-neutral-500 ${className}`} {...rest} />
}

export function CardContent({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-6 py-5 ${className}`} {...rest} />
}

export function CardFooter({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 px-6 py-4 ${className}`}
      {...rest}
    />
  )
}
