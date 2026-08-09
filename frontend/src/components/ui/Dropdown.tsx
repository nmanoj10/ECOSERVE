import { cloneElement, createContext, useContext, useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactElement, ReactNode } from 'react'

interface DropdownContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  close: () => void
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

function useDropdown() {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error('Dropdown subcomponents must be used within <Dropdown>')
  return ctx
}

interface DropdownProps {
  children: ReactNode
  className?: string
}

export function Dropdown({ children, className = '' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <DropdownContext.Provider value={{ open, setOpen, close: () => setOpen(false) }}>
      <div ref={rootRef} className={`relative inline-block ${className}`}>
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

interface DropdownTriggerProps {
  /** The element that opens the menu. Its own onClick (if any) still fires first. */
  children: ReactElement<Record<string, unknown>>
}

export function DropdownTrigger({ children }: DropdownTriggerProps) {
  const { open, setOpen } = useDropdown()
  const childProps = (children.props ?? {}) as { onClick?: (e: MouseEvent<HTMLElement>) => void }

  return cloneElement(children, {
    onClick: (e: MouseEvent<HTMLElement>) => {
      childProps.onClick?.(e)
      setOpen(!open)
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  })
}

interface DropdownContentProps {
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
}

export function DropdownContent({ children, align = 'end', className = '' }: DropdownContentProps) {
  const { open } = useDropdown()
  if (!open) return null

  return (
    <div
      role="menu"
      className={`animate-panel-in absolute z-40 mt-1.5 min-w-48 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-neutral-900/10 ${
        align === 'end' ? 'right-0' : 'left-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}

interface DropdownItemProps {
  children: ReactNode
  onClick?: () => void
  danger?: boolean
}

export function DropdownItem({ children, onClick, danger = false }: DropdownItemProps) {
  const { close } = useDropdown()

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        close()
        onClick?.()
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  )
}

export function DropdownSeparator() {
  return <div className="my-1.5 h-px bg-neutral-100" />
}
