import { ArrowRight, Award, BarChart3, HeartHandshake, Target, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHero } from '@/components/layout/PageHero'
import PublicLayout from '@/components/layout/PublicLayout'
import { Reveal } from '@/components/home/Reveal'
import CtaSection from '@/components/home/CtaSection'

const values = [
  {
    icon: HeartHandshake,
    title: 'Rescue first',
    description: 'Edible food belongs on plates. We judge every decision by how much food it saves.',
  },
  {
    icon: BarChart3,
    title: 'Radical transparency',
    description: 'Meals, kilograms, and CO₂ are public by default. Everyone sees where their food went.',
  },
  {
    icon: Users,
    title: 'Community-powered',
    description: 'Volunteers, donors, and NGOs are the platform. We build the rails and get out of the way.',
  },
  {
    icon: Target,
    title: 'Measurable impact',
    description: 'If we can\u2019t count it, we don\u2019t claim it. Every number on this site comes from a delivery.',
  },
]

const milestones = [
  {
    year: '2024',
    title: 'Founded in Mumbai',
    description: 'Ecoserve launches with twelve neighborhood restaurants and three shelter partners.',
  },
  {
    year: '2025',
    title: 'First 100,000 meals',
    description: 'Pune goes live, volunteers pass 1,000, and the first donation is rescued in under four minutes.',
  },
  {
    year: 'Early 2026',
    title: 'AI joins the chain',
    description: 'Ecoserve AI ships — matching donations, estimating impact, and answering questions around the clock.',
  },
  {
    year: 'Now',
    title: 'Three cities and counting',
    description: '482,000+ meals rescued, 190+ NGOs onboarded, and a roadmap to ten more cities.',
  },
]

const team = [
  { name: 'Aarav Mehta', role: 'Co-founder & CEO', initials: 'AM', gradient: 'from-brand-500 to-emerald-500' },
  { name: 'Priya Sharma', role: 'Head of NGO partnerships', initials: 'PS', gradient: 'from-teal-500 to-brand-400' },
  { name: 'Rohan Iyer', role: 'Head of operations', initials: 'RI', gradient: 'from-emerald-600 to-teal-400' },
  { name: 'Ananya Rao', role: 'AI lead', initials: 'AR', gradient: 'from-brand-600 to-emerald-400' },
  { name: 'Kabir D\'Souza', role: 'Volunteer experience', initials: 'KD', gradient: 'from-lime-600 to-emerald-500' },
  { name: 'Meera Nair', role: 'Community & impact', initials: 'MN', gradient: 'from-teal-600 to-emerald-500' },
]

export default function AboutPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="About Ecoserve"
        title={
          <>
            Rescuing food, <span className="bg-gradient-to-r from-brand-600 to-emerald-500 bg-clip-text text-transparent">restoring communities.</span>
          </>
        }
        description="We build the connective tissue between surplus food and the people who need it — one verified delivery at a time."
      >
        <Link
          to="/register"
          className="group inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
        >
          Join the movement
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/impact"
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-50"
        >
          See our impact
        </Link>
      </PageHero>

      {/* Mission */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Our mission</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Food is already there. So is need. We close the gap between them.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-600">
              Ecoserve started with a simple observation: restaurants throw away perfect food every night, while
              shelters turn people away every night. The problem was never scarcity — it was coordination.
            </p>
            <p className="mt-4 leading-relaxed text-neutral-600">
              So we built the coordination layer. Donors list surplus in minutes, our AI matches it to verified NGOs,
              and volunteers deliver it — tracked live, counted automatically, and measured in meals, kilograms, and
              CO₂.
            </p>
            <p className="mt-4 leading-relaxed text-neutral-600">
              Today, 482,000+ meals later, we believe the same loop can scale to every city on earth.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-300/40 to-emerald-200/40 blur-2xl" />
              <figure className="rounded-3xl border border-neutral-200 bg-neutral-50 p-10 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.16)]">
                <Award className="size-8 text-brand-600" />
                <blockquote className="mt-5 text-xl font-medium leading-relaxed tracking-tight text-neutral-900">
                  &ldquo;The best way to predict the future is to feed it. Every plate we rescue is a small act of
                  rebellion against waste — and a small act of care for a neighbor.&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-emerald-500 text-sm font-semibold text-white">
                    AM
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">Aarav Mehta</p>
                    <p className="text-xs text-neutral-500">Co-founder & CEO, Ecoserve</p>
                  </div>
                </figcaption>
              </figure>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className="bg-neutral-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">What we believe</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Four principles guide every delivery.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, i) => (
              <Reveal key={value.title} delay={i * 0.08} className="h-full">
                <div className="h-full rounded-2xl border border-neutral-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_-16px_rgba(22,163,74,0.25)]">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                    <value.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-semibold text-neutral-900">{value.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{value.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Our story</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              From twelve restaurants to three cities.
            </h2>
          </Reveal>

          <div className="relative mt-16">
            <div className="absolute inset-x-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent lg:block" />
            <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {milestones.map((milestone, i) => (
                <Reveal key={milestone.title} delay={i * 0.1}>
                  <li className="relative text-center lg:text-left">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-brand-200 bg-white text-sm font-semibold text-brand-700 shadow-sm lg:mx-0">
                      {milestone.year}
                    </span>
                    <h3 className="mt-5 text-lg font-semibold tracking-tight text-neutral-900">{milestone.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{milestone.description}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-neutral-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">The team</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Small team. Huge appetite for change.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-neutral-600">
              Operators, engineers, and community builders who would rather move food than attend meetings about it.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member, i) => (
              <Reveal key={member.name} delay={(i % 3) * 0.08} className="h-full">
                <div className="flex h-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-sm">
                  <span
                    className={`flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${member.gradient} text-base font-semibold text-white shadow-md`}
                  >
                    {member.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-900">{member.name}</p>
                    <p className="text-sm text-neutral-500">{member.role}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaSection />
    </PublicLayout>
  )
}
