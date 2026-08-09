import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export type ModalSize = 'sm' | 'md' | 'lg'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: ModalSize
  showClose?: boolean
  children: ReactNode
  footer?: ReactNode
}

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

/** Accessible modal overlay rendered into a portal on `document.body`. */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  showClose = true,
  children,
  footer,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()

  // Keep the latest onClose without re-running the open/close effect below.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      // Trap focus within the dialog.
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  const hasHeader = Boolean(title || description || showClose)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="animate-overlay-in absolute inset-0 bg-neutral-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`animate-panel-in relative max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl focus:outline-none ${sizes[size]}`}
      >
        {hasHeader && (
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-4">
            {title || description ? (
              <div>
                {title && (
                  <h2 id={titleId} className="text-lg font-semibold tracking-tight text-neutral-900">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descriptionId} className="mt-0.5 text-sm text-neutral-500">
                    {description}
                  </p>
                )}
              </div>
            ) : (
              <span />
            )}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-1.5 rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="size-4.5" />
              </button>
            )}
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
