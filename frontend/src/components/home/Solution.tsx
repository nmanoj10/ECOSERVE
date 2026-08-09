import { HeartHandshake, Recycle, Route } from 'lucide-react'

import { Reveal } from '@/components/home/Reveal'

const pillars = [
  {
    icon: Recycle,
    step: '01',
    title: 'Rescue',
    description: 'Donors list surplus in under two minutes — no cold calls, no paperwork, no guessing who to call.',
  },
  {
    icon: Route,
    step: '02',
    title: 'Route',
    description: 'AI-optimized matching and routing get each donation to the right NGO while it is still fresh.',
  },
  {
    icon: HeartHandshake,
    step: '03',
    title: 'Rehome',
    description: 'Verified NGOs and rated volunteers turn surplus into meals, tracked from pickup to plate.',
  },
]

export default function Solution() {
  return (
    <section id="solution" className="scroll-mt-24 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">The solution</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            A connected chain that moves surplus in minutes.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            Ecoserve replaces the analog scramble with one real-time loop — three moves, end to end.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {pillars.map((pillar, i) => (
            <Reveal key={pillar.step} delay={i * 0.1} className="h-full">
              <div className="group relative h-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 p-8 transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_-16px_rgba(22,163,74,0.25)]">
                <span className="absolute right-6 top-6 text-5xl font-semibold tracking-tight text-neutral-200/80 transition duration-300 group-hover:text-brand-200">
                  {pillar.step}
                </span>
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/25 transition duration-300 group-hover:scale-110">
                  <pillar.icon className="size-6" />
                </span>
                <h3 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">{pillar.title}</h3>
                <p className="mt-2 leading-relaxed text-neutral-600">{pillar.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
