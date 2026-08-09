import type { ReactNode } from 'react'

import { Reveal } from '@/components/home/Reveal'

interface PageHeroProps {
  eyebrow: string
  title: ReactNode
  description: string
  children?: ReactNode
  align?: 'center' | 'left'
}

/** Consistent hero band for the public marketing pages. */
export function PageHero({ eyebrow, title, description, children, align = 'center' }: PageHeroProps) {
  const centered = align === 'center'

  return (
    <section className="relative overflow-hidden pt-32 sm:pt-36">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white" />
      <div className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]">
        <div className="absolute -top-40 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-200/60 via-emerald-200/50 to-teal-200/50 blur-3xl" />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-brand-100/70 blur-3xl" />
      </div>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]" />

      <div className={`mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 ${centered ? 'text-center' : ''}`}>
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            {title}
          </h1>
          <p
            className={`mt-5 max-w-2xl text-lg leading-relaxed text-neutral-600 ${centered ? 'mx-auto' : ''}`}
          >
            {description}
          </p>
          {children && <div className={`mt-8 flex flex-wrap gap-3 ${centered ? 'justify-center' : ''}`}>{children}</div>}
        </Reveal>
      </div>
    </section>
  )
}
