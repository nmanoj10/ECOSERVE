import { ArrowRight, CheckCircle2, FileBarChart, Leaf, Recycle, ShieldCheck, UtensilsCrossed, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { PageHero } from '@/components/layout/PageHero'
import PublicLayout from '@/components/layout/PublicLayout'
import { CountUp } from '@/components/home/CountUp'
import { Reveal } from '@/components/home/Reveal'
import CtaSection from '@/components/home/CtaSection'

const counters = [
  { icon: UtensilsCrossed, target: 482300, suffix: '+', label: 'Meals rescued' },
  { icon: Recycle, target: 214000, suffix: ' kg', label: 'Food diverted' },
  { icon: Leaf, target: 186400, suffix: ' kg', label: 'CO₂ saved' },
  { icon: Users, target: 3840, suffix: '+', label: 'Active volunteers' },
]

const monthlyMeals = [
  { month: 'Jan', meals: 18400 },
  { month: 'Feb', meals: 21200 },
  { month: 'Mar', meals: 23900 },
  { month: 'Apr', meals: 22600 },
  { month: 'May', meals: 27100 },
  { month: 'Jun', meals: 30500 },
  { month: 'Jul', meals: 33200 },
  { month: 'Aug', meals: 36400 },
  { month: 'Sep', meals: 38900 },
  { month: 'Oct', meals: 42600 },
  { month: 'Nov', meals: 45200 },
  { month: 'Dec', meals: 49700 },
]

const cities = [
  { name: 'Mumbai', meals: 214000, pct: 100 },
  { name: 'Pune', meals: 138000, pct: 64 },
  { name: 'Bengaluru', meals: 96400, pct: 45 },
]

const foodTypes = [
  { name: 'Bakery', pct: 34, color: '#16a34a' },
  { name: 'Fresh produce', pct: 27, color: '#4ade80' },
  { name: 'Cooked meals', pct: 22, color: '#86efac' },
  { name: 'Packaged', pct: 11, color: '#fbbf24' },
  { name: 'Other', pct: 6, color: '#d4d4d8' },
]

const measures = [
  {
    icon: ShieldCheck,
    title: 'Verified deliveries',
    description: 'Impact is counted only after the receiving NGO confirms the delivery — no self-reported numbers.',
  },
  {
    icon: FileBarChart,
    title: 'Standard conversions',
    description: 'Confirmed kilograms become meals and CO₂ using published, conservative conversion factors.',
  },
  {
    icon: CheckCircle2,
    title: 'Public by default',
    description: 'Community totals are open for anyone to audit — transparency is a feature, not a policy.',
  },
]

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 shadow-lg">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-sm font-semibold text-neutral-900">{payload[0].value.toLocaleString('en-US')} meals</p>
    </div>
  )
}

export default function ImpactPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Impact"
        title={
          <>
            Every meal counted. <span className="bg-gradient-to-r from-brand-600 to-emerald-500 bg-clip-text text-transparent">Every meal matters.</span>
          </>
        }
        description="Live numbers from the Ecoserve network — updated the moment a delivery is confirmed by an NGO."
      >
        <Link
          to="/register"
          className="group inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
        >
          Add to the total
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </PageHero>

      {/* Counters */}
      <section className="bg-white pb-20 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 via-brand-600 to-emerald-600 px-6 py-14 sm:px-14">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {counters.map((counter, i) => (
                <Reveal key={counter.label} delay={i * 0.08} className="text-center">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-inset ring-white/20">
                    <counter.icon className="size-5" />
                  </span>
                  <p className="mt-4">
                    <CountUp
                      target={counter.target}
                      suffix={counter.suffix}
                      className="text-4xl font-semibold tracking-tight text-white sm:text-5xl"
                    />
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">{counter.label}</p>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Charts */}
      <section className="bg-neutral-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">The data</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Where the meals go, and where they come from.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {/* Area chart */}
            <Reveal className="lg:col-span-2">
              <div className="h-full rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.12)] sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-neutral-900">Meals rescued, month by month</p>
                    <p className="text-xs text-neutral-500">Calendar year 2026 · all cities</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    +170% from January
                  </span>
                </div>
                <div className="mt-6 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyMeals} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="mealsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: '#a3a3a3' }}
                        axisLine={false}
                        tickLine={false}
                        interval={1}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#a3a3a3' }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                        tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#d4d4d8' }} />
                      <Area
                        type="monotone"
                        dataKey="meals"
                        stroke="#16a34a"
                        strokeWidth={2.5}
                        fill="url(#mealsFill)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#16a34a' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Reveal>

            {/* City breakdown */}
            <Reveal delay={0.1}>
              <div className="h-full rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.12)] sm:p-8">
                <p className="text-base font-semibold text-neutral-900">Meals by city</p>
                <p className="text-xs text-neutral-500">All time</p>
                <div className="mt-8 space-y-7">
                  {cities.map((city) => (
                    <div key={city.name}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium text-neutral-900">{city.name}</span>
                        <span className="text-neutral-500">{city.meals.toLocaleString('en-US')}</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400"
                          style={{ width: `${city.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-8 rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-800">
                  Mumbai leads the network with 190+ partner NGOs and 1,600 active volunteers.
                </p>
              </div>
            </Reveal>

            {/* Food type donut */}
            <Reveal delay={0.1}>
              <div className="h-full rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.12)] sm:p-8">
                <p className="text-base font-semibold text-neutral-900">What gets rescued</p>
                <p className="text-xs text-neutral-500">Share of all time, by food type</p>
                <div className="mt-8 flex items-center justify-center">
                  <div className="relative size-44">
                    <div
                      className="size-full rounded-full"
                      style={{
                        background: `conic-gradient(${foodTypes
                          .map((type, i) => {
                            const start = foodTypes.slice(0, i).reduce((sum, t) => sum + t.pct, 0)
                            return `${type.color} ${start}% ${start + type.pct}%`
                          })
                          .join(', ')})`,
                      }}
                    />
                    <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white">
                      <span className="text-2xl font-semibold tracking-tight text-neutral-900">214 t</span>
                      <span className="text-xs text-neutral-500">diverted</span>
                    </div>
                  </div>
                </div>
                <ul className="mt-8 space-y-2.5">
                  {foodTypes.map((type) => (
                    <li key={type.name} className="flex items-center gap-2.5 text-sm">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: type.color }} />
                      <span className="text-neutral-700">{type.name}</span>
                      <span className="ml-auto font-medium text-neutral-500">{type.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How we measure */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">How we measure</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Numbers you can audit, not admire.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {measures.map((measure, i) => (
              <Reveal key={measure.title} delay={i * 0.08} className="h-full">
                <div className="h-full rounded-2xl border border-neutral-200 bg-neutral-50 p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-sm">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25">
                    <measure.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-semibold text-neutral-900">{measure.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{measure.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaSection />
    </PublicLayout>
  )
}
