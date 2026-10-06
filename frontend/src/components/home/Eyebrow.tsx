/**
 * Section label used above every heading on the landing page.
 *
 * Deliberately sentence case with a leading dot rather than the usual
 * uppercase + wide-tracking treatment — the page reads as one calm, flat
 * system, so the labels stay in the same voice as the headlines.
 */
export function Eyebrow({ children, className = '' }: { children: string; className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-sm font-medium text-brand-600 ${className}`}>
      <span className="size-1.5 rounded-full bg-brand-500" />
      {children}
    </p>
  )
}
