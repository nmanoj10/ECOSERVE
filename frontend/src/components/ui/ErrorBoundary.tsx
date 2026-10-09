import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { ErrorState } from '@/components/ui/ErrorState'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional heading context, e.g. "Admin console". */
  label?: string
  /** Custom fallback instead of the default ErrorState. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Side-effect hook (e.g. reporting) invoked on every caught error. */
  onError?: (error: Error, info: ErrorInfo) => void
  /**
   * When this value changes, any caught error is cleared and the children are
   * re-rendered in place — no subtree remount. Route boundaries pass the
   * pathname so navigation recovers a crashed route.
   */
  resetKey?: string | number | null
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render, lifecycle, and child-constructor errors and shows a friendly
 * fallback (Phase 34, Step 88). Errors are logged and never crash the whole
 * app: the boundary can be remounted (e.g. by keying it on the route) to reset.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info)
    this.props.onError?.(error, info)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.props.resetKey !== prevProps.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  /** Clears the error and re-renders the children in place. */
  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset)
    }

    return (
      <ErrorState
        title={this.props.label ? `${this.props.label} hit a snag` : 'Something went wrong'}
        description="An unexpected error interrupted this view. Reloading usually fixes it — your data is safe."
        retryLabel="Reload"
        onRetry={() => window.location.reload()}
        error={this.state.error}
        className="min-h-[60vh]"
      />
    )
  }
}

export default ErrorBoundary
