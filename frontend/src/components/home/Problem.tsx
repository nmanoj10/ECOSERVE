import { AlertTriangle, ArrowRight, Globe2, Users } from 'lucide-react'

import { Eyebrow } from '@/components/home/Eyebrow'
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
    <section id="problem" className="relative scroll-mt-24 overflow-hidden bg-canvas py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <Reveal className="max-w-2xl">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            A third of the world&apos;s food is wasted. Most of it never reaches a plate.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            The food exists. The people who need it exist. What&apos;s missing is the connective tissue between them.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.08} className="h-full">
              <div className="group h-full rounded-2xl border border-neutral-200 bg-white p-8 transition duration-300 hover:border-brand-200">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition duration-300 group-hover:bg-brand-500 group-hover:text-white">
                  <stat.icon className="size-5" />
                </span>
                <p className="mt-6 text-4xl font-semibold tracking-tight text-neutral-900">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-brand-600">{stat.label}</p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">{stat.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.16} className="mt-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-neutral-200 bg-white p-8 sm:flex-row sm:items-center">
            <div>
              <p className="text-lg font-semibold tracking-tight text-neutral-900">
                Meanwhile, the system that could fix it is analog.
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Cold calls, paper forms, and waiting rooms — while food expires by the hour.
              </p>
            </div>
            <a
              href="#solution"
              className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-neutral-200 bg-white px-6 py-3 text-[15px] font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              See the fix
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
