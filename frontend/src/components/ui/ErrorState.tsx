import { useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/Button'

interface ErrorStateProps {
  title?: string
  description?: string
  retryLabel?: string
  /** Called when the user clicks retry; awaited so the button can show a busy state. */
  onRetry?: () => void | Promise<void>
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn\u2019t load this. Please try again.',
  retryLabel = 'Try again',
  onRetry,
  className = '',
}: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    if (!onRetry) return
    setRetrying(true)
    try {
      await onRetry()
    } catch {
      // Swallow — the error state stays visible so the user can try again.
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 px-6 py-14 text-center ${className}`}
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
        <AlertTriangle className="size-6" />
      </span>
      <h3 className="mt-4 font-semibold tracking-tight text-neutral-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-neutral-600">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={handleRetry} disabled={retrying} className="mt-5">
          <RefreshCw className={`size-3.5 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : retryLabel}
        </Button>
      )}
    </div>
  )
}
