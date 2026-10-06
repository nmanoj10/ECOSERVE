import { BarChart3, PackagePlus, Sparkles, Truck } from 'lucide-react'

import { Eyebrow } from '@/components/home/Eyebrow'
import { Reveal } from '@/components/home/Reveal'

const steps = [
  {
    icon: PackagePlus,
    title: 'List surplus',
    description: 'Post what you can’t sell — photos, quantities, and pickup window. Takes under two minutes.',
  },
  {
    icon: Sparkles,
    title: 'AI matches',
    description: 'Ecoserve AI pairs every donation with the nearest verified NGO that can take it.',
  },
  {
    icon: Truck,
    title: 'Deliver fresh',
    description: 'Volunteers or optimized drivers pick up and drop off, with the route tracked live.',
  },
  {
    icon: BarChart3,
    title: 'Track impact',
    description: 'Meals, kilograms, and CO₂ are counted automatically — visible to everyone involved.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-canvas py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow className="justify-center">How it works</Eyebrow>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            From surplus to supper in four steps.
          </h2>
        </Reveal>

        <div className="relative mt-16">
          {/* Connector line */}
          <div className="absolute inset-x-10 top-8 hidden h-px bg-neutral-200 lg:block" />

          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.1}>
                <li className="group relative bg-canvas lg:bg-transparent">
                  <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl border border-neutral-200 bg-white transition duration-300 group-hover:border-brand-300 lg:mx-0">
                    <step.icon className="size-7 text-brand-600" />
                    <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-neutral-900">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{step.description}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
