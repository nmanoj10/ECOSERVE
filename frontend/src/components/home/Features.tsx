import { BarChart3, Bot, MapPin, Route, ShieldCheck, Zap } from 'lucide-react'

import { Eyebrow } from '@/components/home/Eyebrow'
import { Reveal } from '@/components/home/Reveal'

const features = [
  {
    icon: Zap,
    title: 'Instant matching',
    description: 'AI pairs surplus with demand the moment it’s listed — no waiting, no cold calls.',
  },
  {
    icon: Route,
    title: 'Smart routing',
    description: 'Optimized pickup and delivery paths cut fuel, time, and last-minute no-shows.',
  },
  {
    icon: MapPin,
    title: 'Live tracking',
    description: 'Every delivery is visible in real time from the storefront to the shelter.',
  },
  {
    icon: BarChart3,
    title: 'Impact analytics',
    description: 'Dashboards turn every donation into meals, kilograms, and CO₂ saved.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified network',
    description: 'NGOs are verified and volunteers are rated after every single delivery.',
  },
  {
    icon: Bot,
    title: 'AI assistant',
    description: 'Estimate impact, ask questions, and get guidance in plain language, 24/7.',
  },
]

export default function Features() {
  return (
    <section id="features" className="scroll-mt-24 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow className="justify-center">Features</Eyebrow>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Everything the chain needs, in one place.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Built for donors, NGOs, and volunteers — each side sees only what it needs, sharing one source of truth.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 3) * 0.08} className="h-full">
              <div className="group h-full rounded-2xl border border-neutral-200 bg-white p-7 transition duration-300 hover:border-brand-200">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition duration-300 group-hover:bg-brand-500 group-hover:text-white">
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
  )
}
