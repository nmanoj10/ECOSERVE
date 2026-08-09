import type { ReactNode } from 'react'
import { useRef } from 'react'

import { gsap, useGSAP } from '@/utils/gsap'

interface RevealProps {
  children: ReactNode
  className?: string
  /** Stagger delay in seconds. */
  delay?: number
  /** Initial vertical offset in px. */
  y?: number
}

/**
 * Fades and slides children into view the first time they enter the viewport.
 * Respects `prefers-reduced-motion`.
 */
export function Reveal({ children, className, delay = 0, y = 36 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap.fromTo(
        ref.current,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          delay,
          ease: 'power3.out',
          scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
        },
      )
    },
    { scope: ref, dependencies: [delay, y] },
  )

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
