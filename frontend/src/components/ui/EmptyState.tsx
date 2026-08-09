import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, icon: Icon = Inbox, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-14 text-center ${className}`}
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-white text-neutral-400 ring-1 ring-neutral-200">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-4 font-semibold tracking-tight text-neutral-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-neutral-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
