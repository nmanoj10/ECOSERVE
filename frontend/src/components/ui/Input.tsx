import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={[
          'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition',
          'placeholder:text-neutral-400 focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
            : 'border-neutral-300 focus:border-brand-500 focus:ring-brand-500/20',
          className,
        ].join(' ')}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  )
})
