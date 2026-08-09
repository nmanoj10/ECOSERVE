import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className = '', id, children, ...rest },
  ref,
) {
  const selectId = id ?? rest.name

  return (
    <div>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={[
            'w-full appearance-none rounded-lg border bg-white px-3.5 py-2.5 pr-10 text-sm text-neutral-900 transition',
            'focus:outline-none focus:ring-2',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
              : 'border-neutral-300 focus:border-brand-500 focus:ring-brand-500/20',
            className,
          ].join(' ')}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})
