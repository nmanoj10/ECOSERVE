import { useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/Button'

interface ErrorStateProps {
  title?: string
  description?: string
  retryLabel?: string
  /** Called when the user clicks retry; awaited so the button can show a busy state. */
  onRetry?: () => void | Promise<void>
  /** Optional failure details. When supplied, ErrorState shows a retry button---
   * it derives the rate-limit back-off flag from `error.response.headers['retry-after']`.
   * When omitted, no button is shown (legacy callers).
   */
  error?: Error | unknown
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn\u2019t load this. Please try again.',
  retryLabel = 'Try again',
  onRetry,
  error,
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

  // Disable the button while the API client is walking its exponential
  // back-off (or while a rate-limit back-off runs). The user can keep using
  // the rest of the page; the failing view just shows a labelled spinner
  // instead of a double-click invite.

  // The axios 403/429 path in api/client.ts walks a retry loop: wait, then
  // replay the request. That schedule is deliberately asynchronous, so the
  // component can show the spinner while the back-off runs instead of stalling
  // the whole UI. The loop caps at one retry for rate limits, so this flag
  // stays accurate for the expected 1 trip.
  const rateLimitRetries = error
    ? (error as { response?: { headers?: Record<string, string> } }).response?.headers?.['retry-after']
      ? 1
      : 0
    : 0

  const errorText = error ? String((error as Error).message ?? error) : ''

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
      {errorText && <p className="mt-1 text-xs text-red-600">{errorText}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={handleRetry} disabled={retrying || rateLimitRetries > 0} className="mt-5">
          <RefreshCw className={`size-3.5 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : rateLimitRetries > 0 ? 'Waiting…' : retryLabel}
        </Button>
      )}
    </div>
  )
}
