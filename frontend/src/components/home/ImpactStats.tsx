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
    <section id="impact" className="scroll-mt-24 bg-canvas py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <Reveal className="overflow-hidden rounded-3xl bg-brand-500 px-6 py-16 sm:px-14 sm:py-20">
          <div className="text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-white/90">
              <span className="size-1.5 rounded-full bg-white" />
              Impact so far
            </p>
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Small donations add up to something enormous.
            </h2>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-white/85">
              Community numbers, live from the Ecoserve network. Every meal is counted the moment it is delivered.
            </p>
          </div>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.08} className="text-center">
                <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-white/15 text-white">
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
                <p className="mt-0.5 text-xs text-white/75">{stat.note}</p>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
