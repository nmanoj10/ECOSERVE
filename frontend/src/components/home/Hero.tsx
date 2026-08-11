import { ArrowRight, CheckCircle2, Leaf, MapPin, Sparkles, Star, Truck, Wheat } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { gsap, useGSAP } from '@/utils/gsap'

const marqueeItems = ['Restaurants', 'Grocery stores', 'Caterers', 'Bakeries', 'Hotels', 'Food banks', 'Canteens', 'Stadiums']

const steps = [
  { label: 'Listed', done: true },
  { label: 'Matched', done: true },
  { label: 'In transit', done: false, live: true },
  { label: 'Delivered', done: false },
]

function Pin({ x, y, label, tone }: { x: string; y: string; label: string; tone: 'brand' | 'emerald' }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full" style={{ left: x, top: y }}>
      <div className="flex flex-col items-center">
        <span className={`text-[9px] font-semibold ${tone === 'brand' ? 'text-brand-700' : 'text-emerald-700'}`}>
          {label}
        </span>
        <span className="relative mt-0.5 flex size-3.5 items-center justify-center">
          {tone === 'brand' && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
          )}
          <span
            className={`relative inline-flex size-3.5 items-center justify-center rounded-full ring-2 ring-white ${
              tone === 'brand' ? 'bg-brand-600' : 'bg-emerald-500'
            }`}
          >
            <MapPin className="size-2 text-white" />
          </span>
        </span>
      </div>
    </div>
  )
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const mockRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const routeRef = useRef<SVGPathElement>(null)
  const truckRef = useRef<HTMLDivElement>(null)

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

      // The delivery truck crawls along the mock map, forever.
      const path = routeRef.current
      const truck = truckRef.current
      const map = mapRef.current
      if (!path || !truck || !map) return

      const length = path.getTotalLength()
      const state = { value: 0 }

      const place = (value: number) => {
        const pt = path.getPointAtLength(value)
        const ahead = path.getPointAtLength(Math.min(value + 8, length))
        const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI
        const ctm = path.getScreenCTM()
        if (!ctm) return
        const screen = new DOMPoint(pt.x, pt.y).matrixTransform(ctm)
        const rect = map.getBoundingClientRect()
        truck.style.transform = `translate(${screen.x - rect.left - 14}px, ${screen.y - rect.top - 14}px) rotate(${angle}deg)`
      }

      place(0)
      gsap.to(state, {
        value: length,
        duration: 6,
        ease: 'none',
        repeat: -1,
        onUpdate: () => place(state.value),
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

        {/* Product visual — a live donation, end to end */}
        <div ref={mockRef} className="relative [perspective:1200px]">
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-300/40 via-emerald-200/30 to-teal-200/40 blur-2xl" />

            {/* App window */}
            <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.16)]">
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50/80 px-5 py-3.5">
                <span className="size-2.5 rounded-full bg-red-400/80" />
                <span className="size-2.5 rounded-full bg-amber-400/80" />
                <span className="size-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <Leaf className="size-3.5 text-brand-600" />
                  Ecoserve · Live network
                </span>
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold text-brand-700">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-brand-500" />
                  </span>
                  LIVE
                </span>
              </div>

              <div className="space-y-4 p-5">
                {/* Active donation */}
                <div className="flex items-center gap-3.5 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-500 text-white shadow-md shadow-brand-500/25">
                    <Wheat className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">Active donation</p>
                    <p className="truncate text-sm font-semibold text-neutral-900">40 kg sourdough bread</p>
                    <p className="truncate text-xs text-neutral-500">Green Bites Kitchen → Hope Shelter</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                    expires in 6h
                  </span>
                </div>

                {/* AI match */}
                <div className="flex items-center gap-2.5 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                    <Sparkles className="size-3.5" />
                  </span>
                  <p className="text-xs leading-snug text-neutral-600">
                    <span className="font-semibold text-neutral-900">AI matched</span> · Hope Shelter is 1.2 km away
                    and can take it now
                  </p>
                </div>

                {/* Live route map */}
                <div ref={mapRef} className="relative h-36 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 480 320"
                    preserveAspectRatio="xMidYMid slice"
                    aria-hidden="true"
                  >
                    <defs>
                      <pattern id="hero-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                        <path d="M32 0H0V32" fill="none" stroke="#f1f1f1" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="480" height="320" fill="#fafafa" />
                    <rect width="480" height="320" fill="url(#hero-map-grid)" />
                    <rect x="24" y="238" width="76" height="58" rx="12" fill="#e8f5e9" />
                    <rect x="380" y="20" width="80" height="64" rx="12" fill="#e8f5e9" />
                    <rect x="210" y="180" width="60" height="48" rx="10" fill="#e3f2fd" />
                    <path d="M0 204 H480" stroke="#e7e7e7" strokeWidth="10" />
                    <path d="M148 0 V320" stroke="#e7e7e7" strokeWidth="8" />
                    <path d="M0 84 H480" stroke="#ededed" strokeWidth="6" />
                    <path d="M330 0 V320" stroke="#ededed" strokeWidth="6" />
                    <path
                      ref={routeRef}
                      d="M 96 268 C 150 250 190 140 392 120"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="7 6"
                      className="animate-dash"
                    />
                    <circle cx="96" cy="268" r="5" fill="#22c55e" />
                    <circle cx="392" cy="120" r="5" fill="#10b981" />
                  </svg>

                  <Pin x="20%" y="84%" label="Green Bites" tone="brand" />
                  <Pin x="82%" y="38%" label="Hope Shelter" tone="emerald" />

                  {/* Moving truck */}
                  <div ref={truckRef} className="absolute left-0 top-0">
                    <span className="flex size-7 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg ring-2 ring-white">
                      <Truck className="size-3.5" />
                    </span>
                  </div>
                </div>

                {/* Status stepper */}
                <div className="flex items-center gap-1.5">
                  {steps.map((step, i) => (
                    <div key={step.label} className="flex flex-1 items-center gap-1.5">
                      <span
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          step.done
                            ? 'bg-brand-600 text-white'
                            : step.live
                              ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
                              : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        {step.done ? <CheckCircle2 className="size-3" /> : step.live && <span className="size-1.5 animate-pulse rounded-full bg-brand-500" />}
                        {step.label}
                      </span>
                      {i < steps.length - 1 && <span className="h-px flex-1 bg-neutral-200" />}
                    </div>
                  ))}
                </div>

                {/* Volunteer */}
                <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-emerald-500 text-xs font-bold text-white">
                    RS
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">Rohan S.</p>
                    <p className="truncate text-xs text-neutral-500">Volunteer · ETA 12 min</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-700">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    4.9
                  </span>
                </div>

                {/* Impact footer */}
                <div className="flex items-center justify-between rounded-2xl bg-neutral-950 px-4 py-3">
                  <span className="text-xs text-neutral-400">This delivery will rescue</span>
                  <span className="flex items-center gap-2.5 text-xs font-semibold text-white">
                    <span>240 meals</span>
                    <span className="size-1 rounded-full bg-neutral-700" />
                    <span className="text-emerald-400">96 kg CO₂</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Floating chips */}
            <div className="absolute -right-3 -top-5 animate-float sm:-right-6">
              <div className="flex items-center gap-2.5 rounded-2xl border border-neutral-200/80 bg-white/95 py-2.5 pl-3 pr-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_-12px_rgba(0,0,0,0.18)] backdrop-blur">
                <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <CheckCircle2 className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Delivered</p>
                  <p className="text-[11px] text-neutral-500">40 meals · just now</p>
                </div>
              </div>
            </div>

            <div className="absolute -left-3 bottom-20 animate-float-delayed sm:-left-6">
              <div className="rounded-2xl bg-neutral-950/95 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.2),0_20px_40px_-16px_rgba(0,0,0,0.4)] ring-1 ring-white/10 backdrop-blur">
                <p className="text-lg font-semibold tracking-tight text-white">+186 t</p>
                <p className="text-[11px] text-neutral-400">CO₂ saved this year</p>
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
