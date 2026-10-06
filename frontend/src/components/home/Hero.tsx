import { ArrowDown, ArrowRight } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'

import heroArt from '@/assets/hero.svg'
import { gsap, useGSAP } from '@/utils/gsap'

const stats = [
  { value: '482k+', label: 'meals rescued' },
  { value: '186 t', label: 'CO₂ saved' },
  { value: '3,840', label: 'active volunteers' },
]

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.fromTo(
        '.hero-fade',
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.75, stagger: 0.08 },
        0.1,
      )
      tl.fromTo(
        artRef.current,
        { opacity: 0, y: 40, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 1.1 },
        0.35,
      )

      // Slow parallax drift as the hero scrolls away.
      gsap.to(copyRef.current, {
        y: -50,
        ease: 'none',
        scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom top', scrub: true },
      })
      gsap.to(artRef.current, {
        y: -18,
        ease: 'none',
        scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom top', scrub: true },
      })
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-canvas pt-32 sm:pt-36">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-6 lg:px-10 lg:pb-28">
        {/* Copy */}
        <div ref={copyRef} className="relative z-10">
          <div className="hero-fade inline-flex items-center gap-2.5 rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-medium text-brand-600">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
            </span>
            Now live — AI-powered food rescue in your city
          </div>

          <h1 className="hero-fade mt-8 text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.03em] text-neutral-900 sm:text-[3.5rem] xl:text-[4.25rem]">
            Rescue food.
            <br />
            Restore <span className="text-brand-600">communities.</span>
          </h1>

          <p className="hero-fade mt-7 max-w-[35rem] text-[17px] leading-relaxed text-neutral-600">
            Ecoserve connects restaurants, grocers, and caterers with verified NGOs and volunteers — so surplus food
            reaches plates, not landfills. In minutes, not days.
          </p>

          <div className="hero-fade mt-9 flex flex-wrap items-center gap-4">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-base font-semibold text-white transition hover:bg-brand-600"
            >
              Donate food
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-7 py-4 text-base font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              Become a volunteer
            </Link>
            <a
              href="#live"
              className="group inline-flex items-center gap-1.5 py-4 text-[15px] font-medium text-neutral-900 transition hover:text-brand-600"
            >
              Watch it live
              <ArrowDown className="size-4 transition-transform group-hover:translate-y-0.5" />
            </a>
          </div>

          <dl className="hero-fade mt-14 grid max-w-lg grid-cols-3 divide-x divide-neutral-200">
            {stats.map((stat) => (
              <div key={stat.label} className="px-8 first:pl-0">
                <dt className="text-[1.9rem] leading-none font-bold tracking-tight text-neutral-900">{stat.value}</dt>
                <dd className="mt-2 text-sm text-neutral-500">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Illustration — the artwork carries its own near-white backdrop, so it
            is multiplied into the canvas to keep the edge invisible. */}
        <div className="relative lg:-mr-32 xl:-mr-44">
          <div
            ref={artRef}
            className="pointer-events-none mix-blend-multiply lg:origin-center"
            aria-hidden="true"
          >
            <img
              src={heroArt}
              alt=""
              width={1536}
              height={1024}
              className="h-auto w-full select-none"
              fetchPriority="high"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
