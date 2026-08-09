import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
}

interface ToastInput {
  variant?: ToastVariant
  title: string
  description?: string
}

interface ToastContextValue {
  toast: (input: ToastInput) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantStyles: Record<ToastVariant, { icon: typeof Info; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: 'border-emerald-200', iconColor: 'text-emerald-600' },
  error: { icon: XCircle, ring: 'border-red-200', iconColor: 'text-red-600' },
  warning: { icon: AlertTriangle, ring: 'border-amber-200', iconColor: 'text-amber-600' },
  info: { icon: Info, ring: 'border-neutral-200', iconColor: 'text-neutral-600' },
}

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, number>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = newId()
      setToasts((prev) => [...prev.slice(-3), { id, variant: input.variant ?? 'info', ...input }])
      timers.current.set(id, window.setTimeout(() => dismiss(id), 4500))
    },
    [dismiss],
  )

  useEffect(() => {
    const active = timers.current
    return () => active.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toaster viewport */}
      <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((item) => {
          const { icon: Icon, ring, iconColor } = variantStyles[item.variant]
          return (
            <div
              key={item.id}
              className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg shadow-neutral-900/10 ${ring}`}
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${iconColor}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                {item.description && <p className="mt-0.5 text-sm text-neutral-600">{item.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>')
  return ctx
}
