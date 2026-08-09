import { BarChart3, PackagePlus, Sparkles, Truck } from 'lucide-react'

import { Reveal } from '@/components/home/Reveal'

const steps = [
  {
    icon: PackagePlus,
    title: 'List surplus',
    description: 'Post what you can\u2019t sell — photos, quantities, and pickup window. Takes under two minutes.',
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
    <section id="how-it-works" className="scroll-mt-24 bg-neutral-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">How it works</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            From surplus to supper in four steps.
          </h2>
        </Reveal>

        <div className="relative mt-16">
          {/* Connector line */}
          <div className="absolute inset-x-8 top-8 hidden h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent lg:block" />

          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.12}>
                <li className="group relative text-center lg:text-left">
                  <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl border border-brand-200 bg-white shadow-sm transition duration-300 group-hover:border-brand-400 group-hover:shadow-md lg:mx-0">
                    <step.icon className="size-7 text-brand-600" />
                    <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
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
