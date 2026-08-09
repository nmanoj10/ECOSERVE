import { AlertTriangle, Globe2, Users } from 'lucide-react'

import { Reveal } from '@/components/home/Reveal'

const stats = [
  {
    icon: Globe2,
    value: '1.3B',
    label: 'tonnes of food',
    detail: 'are lost or wasted every year — roughly one-third of everything the world grows.',
  },
  {
    icon: AlertTriangle,
    value: '8–10%',
    label: 'of global emissions',
    detail: 'come from food loss and waste. If it were a country, it would rank third.',
  },
  {
    icon: Users,
    value: '783M',
    label: 'people faced hunger',
    detail: 'in 2022 — while edible food rots in bins, storehouses, and loading docks.',
  },
]

export default function Problem() {
  return (
    <section id="problem" className="relative scroll-mt-24 overflow-hidden bg-neutral-950 py-24 sm:py-32">
      {/* Green glow backdrop */}
      <div className="absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">The problem</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            A third of the world&apos;s food is wasted. Most of it never reaches a plate.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-400">
            The food exists. The people who need it exist. What&apos;s missing is the connective tissue between them.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.1} className="h-full">
              <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur transition duration-300 hover:border-brand-400/40 hover:bg-white/[0.05]">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-inset ring-brand-400/20 transition duration-300 group-hover:scale-110">
                  <stat.icon className="size-5" />
                </span>
                <p className="mt-6 text-4xl font-semibold tracking-tight text-white">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-brand-300">{stat.label}</p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{stat.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2} className="mt-12">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 bg-gradient-to-r from-brand-500/10 to-emerald-500/10 p-8 sm:flex-row sm:items-center">
            <div>
              <p className="text-lg font-semibold text-white">Meanwhile, the system that could fix it is analog.</p>
              <p className="mt-1 text-sm text-neutral-400">
                Cold calls, paper forms, and waiting rooms — while food expires by the hour.
              </p>
            </div>
            <a
              href="#solution"
              className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100"
            >
              See the fix →
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
