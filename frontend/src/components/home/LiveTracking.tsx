import { BellRing, Clock, MapPin, Navigation, Radio, Truck } from 'lucide-react'
import { useRef } from 'react'

import { Reveal } from '@/components/home/Reveal'
import { gsap, useGSAP } from '@/utils/gsap'

const feed = [
  { time: '2 min ago', route: 'Green Bites Kitchen → Hope Shelter', note: 'Picked up · 24 meals' },
  { time: '11 min ago', route: 'Daily Mart → Annapurna Trust', note: 'In transit · 18 meals' },
  { time: '24 min ago', route: 'Sunrise Bakery → City Mission', note: 'Delivered · 40 meals' },
]

const bullets = [
  {
    icon: Navigation,
    title: 'Pickup to plate, in real time',
    description: 'Every delivery shows live status, ETA, and the volunteer behind the wheel.',
  },
  {
    icon: BellRing,
    title: 'Freshness alerts',
    description: 'Get notified the moment a donation is at risk — before it is too late.',
  },
  {
    icon: Clock,
    title: 'Honest ETAs',
    description: 'Routes adapt to traffic and pickup windows, so NGO kitchens can plan ahead.',
  },
]

function Pin({ x, y, label, tone }: { x: string; y: string; label: string; tone: 'brand' | 'emerald' }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full" style={{ left: x, top: y }}>
      <div className="flex flex-col items-center">
        <span className={`text-[10px] font-semibold ${tone === 'brand' ? 'text-brand-700' : 'text-emerald-700'}`}>
          {label}
        </span>
        <span className="relative mt-0.5 flex size-4 items-center justify-center">
          {tone === 'brand' && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
          )}
          <span
            className={`relative inline-flex size-4 items-center justify-center rounded-full ring-2 ring-white ${
              tone === 'brand' ? 'bg-brand-600' : 'bg-emerald-500'
            }`}
          >
            <MapPin className="size-2.5 text-white" />
          </span>
        </span>
      </div>
    </div>
  )
}

export default function LiveTracking() {
  const sectionRef = useRef<HTMLElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const routeRef = useRef<SVGPathElement>(null)
  const truckRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
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
        truck.style.transform = `translate(${screen.x - rect.left - 18}px, ${screen.y - rect.top - 18}px) rotate(${angle}deg)`
      }

      place(0)
      gsap.to(state, {
        value: length,
        duration: 7,
        ease: 'none',
        repeat: -1,
        onUpdate: () => place(state.value),
      })
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} id="live" className="scroll-mt-24 bg-neutral-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          {/* Copy + feed */}
          <div>
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Live tracking</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Every plate, mapped in real time.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-neutral-600">
                Donors watch their surplus leave the door. NGOs watch it arrive. Volunteers see the whole route — and so
                do you.
              </p>
            </Reveal>

            <div className="mt-8 space-y-5">
              {bullets.map((bullet, i) => (
                <Reveal key={bullet.title} delay={0.1 + i * 0.08}>
                  <div className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                      <bullet.icon className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-neutral-900">{bullet.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{bullet.description}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.2} className="mt-8">
              <div className="space-y-2.5">
                {feed.map((item) => (
                  <div
                    key={item.route}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${
                        item.note.startsWith('Delivered') ? 'bg-neutral-300' : 'animate-pulse bg-brand-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{item.route}</p>
                      <p className="text-xs text-neutral-500">{item.note}</p>
                    </div>
                    <span className="shrink-0 text-xs text-neutral-400">{item.time}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Map mockup */}
          <Reveal delay={0.1}>
            <div
              ref={mapRef}
              className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
                  </span>
                  <p className="text-sm font-semibold text-neutral-900">Live network</p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                  3 active deliveries
                </span>
              </div>

              <div className="relative aspect-[4/3] w-full">
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 480 320"
                  preserveAspectRatio="xMidYMid slice"
                  aria-hidden="true"
                >
                  <defs>
                    <pattern id="map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                      <path d="M32 0H0V32" fill="none" stroke="#f1f1f1" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="480" height="320" fill="#fafafa" />
                  <rect width="480" height="320" fill="url(#map-grid)" />
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
                <Pin x="50%" y="30%" label="Volunteer Rohan" tone="brand" />
                <Pin x="82%" y="38%" label="Hope Shelter" tone="emerald" />

                {/* Moving truck */}
                <div ref={truckRef} className="absolute left-0 top-0">
                  <span className="flex size-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg ring-2 ring-white">
                    <Truck className="size-4.5" />
                  </span>
                </div>

                {/* Status card */}
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-neutral-200/80 bg-white/90 p-4 shadow-lg backdrop-blur">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        Green Bites Kitchen → Hope Shelter
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                        <Radio className="size-3.5 text-brand-600" /> ETA 12 min · Live
                      </p>
                    </div>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Truck className="size-4.5" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-medium">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">Picked up</span>
                    <span className="rounded-full bg-brand-600 px-2.5 py-1 text-white">In transit</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-500">Delivered</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
