import { HeartHandshake, Recycle, Route } from 'lucide-react'

import { Eyebrow } from '@/components/home/Eyebrow'
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
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow className="justify-center">The solution</Eyebrow>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            A connected chain that moves surplus in minutes.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Ecoserve replaces the analog scramble with one real-time loop — three moves, end to end.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {pillars.map((pillar, i) => (
            <Reveal key={pillar.step} delay={i * 0.08} className="h-full">
              <div className="group relative h-full rounded-2xl border border-neutral-200 bg-white p-8 transition duration-300 hover:border-brand-200">
                <span className="absolute right-8 top-7 text-5xl font-semibold tracking-tight text-neutral-200 transition duration-300 group-hover:text-brand-200">
                  {pillar.step}
                </span>
                <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition duration-300 group-hover:bg-brand-500 group-hover:text-white">
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
