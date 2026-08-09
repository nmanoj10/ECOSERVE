import { ArrowRight, BarChart3, BellRing, Bot, CalendarClock, MapPin, Route, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHero } from '@/components/layout/PageHero'
import PublicLayout from '@/components/layout/PublicLayout'
import { Reveal } from '@/components/home/Reveal'
import CtaSection from '@/components/home/CtaSection'

const features = [
  { icon: Zap, title: 'Instant matching', description: 'AI pairs surplus with demand the moment it\u2019s listed — no waiting, no cold calls.' },
  { icon: Route, title: 'Smart routing', description: 'Optimized pickup and delivery paths cut fuel, time, and last-minute no-shows.' },
  { icon: MapPin, title: 'Live tracking', description: 'Every delivery is visible in real time from the storefront to the shelter.' },
  { icon: BarChart3, title: 'Impact analytics', description: 'Dashboards turn every donation into meals, kilograms, and CO₂ saved.' },
  { icon: ShieldCheck, title: 'Verified network', description: 'NGOs are verified and volunteers are rated after every single delivery.' },
  { icon: Bot, title: 'AI assistant', description: 'Estimate impact, ask questions, and get guidance in plain language, 24/7.' },
  { icon: BellRing, title: 'Smart alerts', description: 'Freshness warnings and assignment nudges arrive before it\u2019s too late.' },
  { icon: CalendarClock, title: 'Flexible scheduling', description: 'Pickup windows, recurring pickups, and one-time trips all fit your calendar.' },
  { icon: Sparkles, title: 'Impact stories', description: 'Donors and volunteers see the exact meals their surplus became.' },
]

const weeklyBars = [
  { day: 'Mon', meals: 620 },
  { day: 'Tue', meals: 780 },
  { day: 'Wed', meals: 690 },
  { day: 'Thu', meals: 860 },
  { day: 'Fri', meals: 1020 },
  { day: 'Sat', meals: 1180 },
  { day: 'Sun', meals: 940 },
]

export default function FeaturesPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Features"
        title={
          <>
            Everything the chain needs, <span className="bg-gradient-to-r from-brand-600 to-emerald-500 bg-clip-text text-transparent">in one place.</span>
          </>
        }
        description="Built for donors, NGOs, and volunteers — each side sees only what it needs, sharing one source of truth."
      >
        <Link
          to="/register"
          className="group inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
        >
          Explore it free
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </PageHero>

      {/* Feature grid */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={(i % 3) * 0.08} className="h-full">
                <div className="group h-full rounded-2xl border border-neutral-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_40px_-20px_rgba(22,163,74,0.3)]">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition duration-300 group-hover:bg-brand-600 group-hover:text-white">
                    <feature.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-semibold text-neutral-900">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase: live tracking */}
      <section className="bg-neutral-50 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Live tracking</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Watch surplus travel, door to door.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-neutral-600">
              Donors see their food leave. NGOs see it arrive. Volunteers see the whole route. Status updates, ETAs,
              and proof of delivery — all in one view.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Live status and ETA for every delivery',
                'Real-time alerts when a pickup is at risk',
                'Proof of delivery, captured at the door',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-neutral-600">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-300/40 to-emerald-200/40 blur-2xl" />
              <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.16)]">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
                    </span>
                    <p className="text-sm font-semibold text-neutral-900">Delivery #4821</p>
                  </div>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">In transit</span>
                </div>
                <div className="relative aspect-[16/9] w-full">
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 270" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                    <defs>
                      <pattern id="ft-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                        <path d="M32 0H0V32" fill="none" stroke="#f1f1f1" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="480" height="270" fill="#fafafa" />
                    <rect width="480" height="270" fill="url(#ft-grid)" />
                    <rect x="20" y="196" width="72" height="54" rx="12" fill="#e8f5e9" />
                    <rect x="388" y="16" width="72" height="56" rx="12" fill="#e8f5e9" />
                    <path d="M0 176 H480" stroke="#e7e7e7" strokeWidth="10" />
                    <path d="M130 0 V270" stroke="#e7e7e7" strokeWidth="8" />
                    <path d="M 84 226 C 140 200 180 110 396 92" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 6" className="animate-dash" />
                    <circle cx="84" cy="226" r="5" fill="#22c55e" />
                    <circle cx="396" cy="92" r="5" fill="#10b981" />
                  </svg>
                  <div className="absolute -translate-x-1/2 -translate-y-full" style={{ left: '17.5%', top: '84%' }}>
                    <span className="flex size-4 items-center justify-center rounded-full bg-brand-600 ring-2 ring-white">
                      <MapPin className="size-2.5 text-white" />
                    </span>
                  </div>
                  <div className="absolute -translate-x-1/2 -translate-y-full" style={{ left: '82.5%', top: '34%' }}>
                    <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                      <MapPin className="size-2.5 text-white" />
                    </span>
                  </div>
                  <div className="absolute inset-x-4 bottom-3 flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white/90 px-4 py-2.5 backdrop-blur">
                    <span className="text-xs font-medium text-neutral-700">Green Bites → Hope Shelter</span>
                    <span className="text-xs font-semibold text-brand-700">ETA 12 min</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Showcase: AI assistant */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <Reveal className="lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Ecoserve AI</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              An assistant that turns words into meals.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-neutral-600">
              Ask about impact, matching, or logistics in plain language. Ecoserve AI estimates, recommends, and acts —
              inside every workflow.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Carbon-impact estimates in seconds',
                'Smart matching for every donation',
                'Guidance available around the clock',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-neutral-600">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15} className="lg:order-1">
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-400/30 to-teal-300/30 blur-2xl" />
              <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-950 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4">
                  <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-emerald-400 text-white">
                    <Bot className="size-4.5" />
                  </span>
                  <p className="text-sm font-semibold text-white">Ecoserve AI</p>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400" /> Online
                  </span>
                </div>
                <div className="space-y-4 px-5 py-6">
                  <div className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white">
                      How much CO₂ did we save last month?
                    </p>
                  </div>
                  <div className="flex justify-start">
                    <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-2.5 text-sm leading-relaxed text-neutral-200">
                      You diverted <span className="font-medium text-emerald-400">18.2 tonnes</span> last month — about{' '}
                      <span className="font-medium text-emerald-400">45,600 meals</span>. That&apos;s up 12% from
                      February. Want the breakdown by city?
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['By city', 'By food type', 'Top donors'].map((chip) => (
                      <span key={chip} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Showcase: impact analytics */}
      <section className="bg-neutral-50 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Impact analytics</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              See the difference, in real numbers.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-neutral-600">
              Live dashboards show meals rescued, food diverted, and CO₂ saved — per day, per city, per donor. No
              estimates, no rounding up.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Confirmed delivery data, not projections',
                'City, donor, and NGO breakdowns',
                'Impact reports you can share publicly',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-neutral-600">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-300/40 to-emerald-200/40 blur-2xl" />
              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.16)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">Meals rescued this week</p>
                    <p className="text-xs text-neutral-500">Across all cities</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    +18% vs last week
                  </span>
                </div>
                <div className="mt-6 flex h-40 items-end gap-3">
                  {weeklyBars.map((bar) => {
                    const height = Math.round((bar.meals / 1180) * 100)
                    return (
                      <div key={bar.day} className="group flex flex-1 flex-col items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-700 opacity-0 transition group-hover:opacity-100">
                          {bar.meals}
                        </span>
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-emerald-400 transition duration-300 group-hover:from-brand-500 group-hover:to-emerald-300"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-xs text-neutral-400">{bar.day}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </PublicLayout>
  )
}
