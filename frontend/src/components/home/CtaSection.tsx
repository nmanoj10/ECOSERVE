import { ArrowRight, Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/home/Reveal'

export default function CtaSection() {
  return (
    <section className="bg-white py-24 sm:py-28">
      <Reveal className="mx-auto max-w-3xl px-6 text-center sm:px-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Leaf className="size-7" />
        </span>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
          Your surplus can change someone&apos;s day.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
          Join the restaurants, grocers, NGOs, and volunteers already keeping food on plates — and out of the bin.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-base font-semibold text-white transition hover:bg-brand-600"
          >
            Start donating
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-7 py-4 text-base font-medium text-neutral-900 transition hover:bg-neutral-50"
          >
            Become a volunteer
          </Link>
        </div>

        <p className="mt-6 text-sm text-neutral-500">Free for NGOs · Verified partners · Setup in minutes</p>
      </Reveal>
    </section>
  )
}
