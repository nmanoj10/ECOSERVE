import { ArrowRight, Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/home/Reveal'

export default function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-neutral-950 py-24 sm:py-28">
      {/* Backdrop */}
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-0 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400 ring-1 ring-inset ring-brand-400/30">
          <Leaf className="size-7" />
        </span>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Your surplus can change someone&apos;s day.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-neutral-400">
          Join the restaurants, grocers, NGOs, and volunteers already keeping food on plates — and out of the bin.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-medium text-neutral-900 shadow-lg transition hover:bg-neutral-100"
          >
            Start donating
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/5"
          >
            Become a volunteer
          </Link>
        </div>

        <p className="mt-6 text-xs text-neutral-500">Free for NGOs · Verified partners · Setup in minutes</p>
      </Reveal>
    </section>
  )
}
