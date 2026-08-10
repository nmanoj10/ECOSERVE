import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/Button'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  /** Rows per page — used only for the "Showing X–Y" text. Defaults to 10. */
  limit?: number
}

/** Row of Prev/Next controls with a page indicator and result count. */
export function Pagination({ page, totalPages, total, onPageChange, limit = 10 }: PaginationProps) {
  if (total === 0) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
      <p className="text-xs text-neutral-500">
        Showing <span className="font-medium text-neutral-700">{from}</span>–<span className="font-medium text-neutral-700">{to}</span> of{' '}
        <span className="font-medium text-neutral-700">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
          Prev
        </Button>
        <span className="min-w-14 px-1 text-center text-xs font-medium text-neutral-600">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
