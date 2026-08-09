import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

export function Table({ className = '', ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${className}`} {...rest} />
    </div>
  )
}

export function TableHeader({ className = '', ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`text-left text-xs uppercase tracking-wide text-neutral-500 ${className}`} {...rest} />
}

export function TableBody({ className = '', ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-neutral-100 ${className}`} {...rest} />
}

export function TableRow({ className = '', ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`transition-colors hover:bg-neutral-50/60 ${className}`} {...rest} />
}

export function TableHead({ className = '', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`border-b border-neutral-200 px-4 py-3 font-semibold ${className}`} {...rest} />
}

export function TableCell({ className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 align-middle text-neutral-700 ${className}`} {...rest} />
}
