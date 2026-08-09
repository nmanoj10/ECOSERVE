import type { LucideIcon } from 'lucide-react'
import { ArrowRight, CheckCircle2, Leaf, MapPin, Sparkles, Truck, UtensilsCrossed } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { gsap, useGSAP } from '@/utils/gsap'

const marqueeItems = ['Restaurants', 'Grocery stores', 'Caterers', 'Bakeries', 'Hotels', 'Food banks', 'Canteens', 'Stadiums']

function StepRow({
  icon: Icon,
  label,
  detail,
  state,
}: {
  icon: LucideIcon
  label: string
  detail: string
  state: 'done' | 'active' | 'pending'
}) {
  return (
    <div className="relative flex items-center gap-4">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          state === 'done'
            ? 'bg-brand-600 text-white'
            : state === 'active'
              ? 'bg-brand-50 text-brand-600 ring-2 ring-brand-200'
              : 'bg-neutral-100 text-neutral-400'
        }`}
      >
        {state === 'done' ? <CheckCircle2 className="size-5" /> : <Icon className="size-4.5" />}
        {state === 'active' && (
          <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-brand-500" />
          </span>
        )}
      </span>
      <div>
        <p className="text-sm font-medium text-neutral-900">{label}</p>
        <p className="text-xs text-neutral-500">{detail}</p>
      </div>
    </div>
  )
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const mockRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      // Entrance
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.fromTo('.hero-fade', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.09 }, 0.1)
      tl.fromTo(
        mockRef.current,
        { opacity: 0, y: 56, rotateX: 8, scale: 0.97 },
        { opacity: 1, y: 0, rotateX: 0, scale: 1, duration: 1.1 },
        0.5,
      )

      // Scroll parallax — copy drifts up and fades; the mockup floats a touch slower.
      gsap.to(copyRef.current, {
        y: -70,
        opacity: 0.25,
        ease: 'none',
        scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom top', scrub: true },
      })
      gsap.to(mockRef.current, {
        y: -30,
        ease: 'none',
        scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom top', scrub: true },
      })
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="relative overflow-hidden pt-28 sm:pt-32">
      {/* Backdrop: green mesh gradient + dotted grid */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white" />
      <div className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_35%,transparent_75%)]">
        <div className="absolute -top-48 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-200/70 via-emerald-200/60 to-teal-200/60 blur-3xl" />
        <div className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-brand-100/80 blur-3xl" />
        <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-emerald-100/80 blur-3xl" />
      </div>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]" />

      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pb-24 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8 lg:pb-32">
        {/* Copy */}
        <div ref={copyRef}>
          <div className="hero-fade inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-brand-800 shadow-sm backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
            </span>
            Now live — AI-powered food rescue in your city
          </div>

          <h1 className="hero-fade mt-6 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
            Rescue food.
            <br />
            Restore{' '}
            <span className="bg-gradient-to-r from-brand-600 to-emerald-500 bg-clip-text text-transparent">
              communities.
            </span>
          </h1>

          <p className="hero-fade mt-6 max-w-xl text-lg leading-relaxed text-neutral-600">
            Ecoserve connects restaurants, grocers, and caterers with verified NGOs and volunteers — so surplus food
            reaches plates, not landfills. In minutes, not days.
          </p>

          <div className="hero-fade mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 hover:shadow-brand-700/30"
            >
              Donate food
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-50"
            >
              Become a volunteer
            </Link>
            <a
              href="#live"
              className="inline-flex items-center gap-1.5 px-2 py-3 text-sm font-medium text-neutral-600 transition hover:text-brand-700"
            >
              Watch it live
              <span aria-hidden>↓</span>
            </a>
          </div>

          <div className="hero-fade mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-neutral-900">482k+</p>
              <p className="text-sm text-neutral-500">meals rescued</p>
            </div>
            <div className="hidden h-9 w-px bg-neutral-200 sm:block" />
            <div>
              <p className="text-2xl font-semibold tracking-tight text-neutral-900">186 t</p>
              <p className="text-sm text-neutral-500">CO₂ saved</p>
            </div>
            <div className="hidden h-9 w-px bg-neutral-200 sm:block" />
            <div>
              <p className="text-2xl font-semibold tracking-tight text-neutral-900">3,840</p>
              <p className="text-sm text-neutral-500">active volunteers</p>
            </div>
          </div>
        </div>

        {/* Product mockup */}
        <div ref={mockRef} className="relative [perspective:1200px]">
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-300/40 via-emerald-200/30 to-teal-200/40 blur-2xl" />

            <div className="rounded-3xl border border-neutral-200/80 bg-white/80 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.12)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
                    <UtensilsCrossed className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">Donation #4821</p>
                    <p className="truncate text-xs text-neutral-500">Green Bites Kitchen → Hope Shelter</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-brand-500" />
                  </span>
                  Live
                </span>
              </div>

              <div className="relative mt-6 space-y-5">
                <span aria-hidden className="absolute bottom-2 left-5 top-3 w-px bg-neutral-200" />
                <StepRow icon={MapPin} label="Picked up" detail="Green Bites Kitchen · 09:42" state="done" />
                <StepRow icon={Truck} label="In transit" detail="Volunteer Rohan · 2.4 km away" state="active" />
                <StepRow icon={MapPin} label="Delivering to" detail="Hope Shelter · ETA 12 min" state="pending" />
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>Progress</span>
                  <span className="font-medium text-brand-700">68%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-brand-500 to-emerald-500" />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">24 meals</span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">9.6 kg food</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  4.8 kg CO₂ saved
                </span>
              </div>
            </div>

            {/* Floating side cards */}
            <div className="animate-float absolute -bottom-8 -left-6 hidden sm:block">
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-900/5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">AI matched in 3s</p>
                  <p className="text-xs text-neutral-500">Nearest verified NGO</p>
                </div>
              </div>
            </div>
            <div className="animate-float-delayed absolute -right-4 -top-8 hidden sm:block">
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-900/5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Leaf className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">−9.6 kg wasted</p>
                  <p className="text-xs text-neutral-500">diverted from landfill</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Marquee strip */}
      <div className="border-y border-neutral-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Surplus happens everywhere
          </span>
          <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="animate-marquee flex w-max items-center gap-10">
              {[...marqueeItems, ...marqueeItems].map((item, i) => (
                <span key={`${item}-${i}`} className="flex items-center gap-2.5 whitespace-nowrap text-sm text-neutral-500">
                  <span className="size-1.5 rounded-full bg-brand-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
