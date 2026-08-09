import { Leaf, Recycle, UtensilsCrossed, Users } from 'lucide-react'

import { CountUp } from '@/components/home/CountUp'
import { Reveal } from '@/components/home/Reveal'

const stats = [
  {
    icon: UtensilsCrossed,
    target: 482300,
    suffix: '+',
    label: 'Meals rescued',
    note: 'served through verified NGOs',
  },
  {
    icon: Recycle,
    target: 214000,
    suffix: ' kg',
    label: 'Food diverted',
    note: 'kept out of landfills',
  },
  {
    icon: Leaf,
    target: 186400,
    suffix: ' kg',
    label: 'CO₂ saved',
    note: 'versus landfill emissions',
  },
  {
    icon: Users,
    target: 3840,
    suffix: '+',
    label: 'Active volunteers',
    note: 'delivering across the city',
  },
]

export default function ImpactStats() {
  return (
    <section id="impact" className="scroll-mt-24 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 via-brand-600 to-emerald-600 px-6 py-16 sm:px-14 sm:py-20">
          {/* Decorations */}
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

          <div className="relative text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-100">Impact so far</p>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Small donations add up to something enormous.
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-brand-50/90">
              Community numbers, live from the Ecoserve network. Every meal is counted the moment it is delivered.
            </p>
          </div>

          <div className="relative mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.08} className="text-center">
                <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-inset ring-white/20">
                  <stat.icon className="size-5" />
                </span>
                <p className="mt-4">
                  <CountUp
                    target={stat.target}
                    suffix={stat.suffix}
                    className="text-4xl font-semibold tracking-tight text-white sm:text-5xl"
                  />
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{stat.label}</p>
                <p className="mt-0.5 text-xs text-brand-100/80">{stat.note}</p>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
