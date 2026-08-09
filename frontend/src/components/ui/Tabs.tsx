import { createContext, useContext, useId } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
  baseId: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs subcomponents must be used within <Tabs>')
  return ctx
}

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ value, onValueChange, children, className = '' }: TabsProps) {
  const baseId = useId()
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className = '' }: { children: ReactNode; className?: string }) {
  const moveFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index === -1) return
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % buttons.length
    if (e.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length
    if (next !== null) {
      e.preventDefault()
      buttons[next].focus()
      buttons[next].click()
    }
  }

  return (
    <div
      role="tablist"
      onKeyDown={moveFocus}
      className={`inline-flex flex-wrap items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1 ${className}`}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className = '' }: TabsTriggerProps) {
  const { value: active, setValue, baseId } = useTabs()
  const selected = active === value
  const tabId = `${baseId}-tab-${value}`

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      onClick={() => setValue(value)}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        selected ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
      } ${className}`}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const { value: active, baseId } = useTabs()
  if (active !== value) return null
  return (
    <div id={`${baseId}-panel-${value}`} role="tabpanel" aria-labelledby={`${baseId}-tab-${value}`} className={className}>
      {children}
    </div>
  )
}
