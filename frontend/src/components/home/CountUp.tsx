import { useRef, useState } from 'react'

import { gsap, useGSAP } from '@/utils/gsap'

interface CountUpProps {
  /** Final number to count to. */
  target: number
  /** Animation duration in seconds. */
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}

function format(value: number, decimals: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Counts from 0 to `target` when scrolled into view. */
export function CountUp({ target, duration = 2, prefix = '', suffix = '', decimals = 0, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [text, setText] = useState(format(0, decimals))

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setText(format(target, decimals))
        return
      }

      const state = { value: 0 }
      gsap.to(state, {
        value: target,
        duration,
        ease: 'power2.out',
        scrollTrigger: { trigger: ref.current, start: 'top 92%', once: true },
        onUpdate: () => {
          const rounded = Math.round(state.value * 10 ** decimals) / 10 ** decimals
          setText(format(rounded, decimals))
        },
      })
    },
    { scope: ref, dependencies: [target, duration, decimals] },
  )

  return (
    <span ref={ref} className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  )
}
