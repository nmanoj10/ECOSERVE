import { ArrowRight, BarChart3, Building2, ChevronDown, Handshake, PackagePlus, ShieldCheck, Sparkles, Truck, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHero } from '@/components/layout/PageHero'
import PublicLayout from '@/components/layout/PublicLayout'
import { Reveal } from '@/components/home/Reveal'
import CtaSection from '@/components/home/CtaSection'

const steps = [
  {
    icon: PackagePlus,
    title: 'List surplus',
    description: 'A restaurant posts what it can\u2019t sell — photos, quantities, and a pickup window. It takes under two minutes.',
  },
  {
    icon: Sparkles,
    title: 'AI matches',
    description: 'Ecoserve AI scores every open request and pairs the donation with the nearest verified NGO that can take it.',
  },
  {
    icon: Truck,
    title: 'Deliver fresh',
    description: 'A nearby volunteer accepts the trip, or an optimized driver route is dispatched. Everything is tracked live.',
  },
  {
    icon: BarChart3,
    title: 'Track impact',
    description: 'Meals, kilograms, and CO₂ are counted automatically and shared with every side — proof that the food landed.',
  },
]

const roles = [
  {
    id: 'donors',
    label: 'For donors',
    icon: Building2,
    heading: 'Turn surplus into goodwill in minutes.',
    description: 'Restaurants, grocers, and caterers offload surplus without cold calls or paperwork.',
    steps: [
      { title: 'Create a donation', description: 'Snap photos, set quantities, and choose a pickup window.' },
      { title: 'Get matched instantly', description: 'Our AI suggests the best NGO and the earliest pickup.' },
      { title: 'Hand off with proof', description: 'The volunteer scans, the NGO confirms, and your impact is recorded.' },
    ],
    cta: { label: 'Start donating', to: '/register' },
  },
  {
    id: 'ngos',
    label: 'For NGOs',
    icon: Handshake,
    heading: 'Receive food you can actually use.',
    description: 'Verified organizations set capacity, schedules, and preferences — and accept donations in one tap.',
    steps: [
      { title: 'Verify your NGO', description: 'A quick verification keeps the network trusted for everyone.' },
      { title: 'Set your needs', description: 'Capacity, food types, and pickup windows are saved as preferences.' },
      { title: 'Accept with one tap', description: 'Incoming donations appear in real time with live ETAs.' },
    ],
    cta: { label: 'Register your NGO', to: '/register' },
  },
  {
    id: 'volunteers',
    label: 'For volunteers',
    icon: Users,
    heading: 'Deliver, rate, repeat.',
    description: 'Volunteers turn spare time into rescued meals — with routes, ratings, and recognition.',
    steps: [
      { title: 'Find nearby trips', description: 'See open pickups on a live map, filtered by your schedule.' },
      { title: 'Pick up and deliver', description: 'Follow the optimized route with live ETA and proof of delivery.' },
      { title: 'Build your rating', description: 'Every completed delivery earns ratings and visible impact.' },
    ],
    cta: { label: 'Become a volunteer', to: '/register' },
  },
]

const faqs = [
  {
    question: 'Is Ecoserve free for NGOs?',
    answer:
      'Yes. The platform is free for verified NGOs forever. Donors and volunteers also pay nothing — the network is funded by partner grants and impact programs.',
  },
  {
    question: 'What kinds of food can be donated?',
    answer:
      'Fresh produce, bakery goods, packaged and sealed items, and prepared meals that are safe to transport. Each donation is matched to NGOs that have said they can accept that food type.',
  },
  {
    question: 'How are volunteers and NGOs verified?',
    answer:
      'NGOs complete a registration and verification step before joining. Volunteers create a profile and are rated after every delivery — a public history builds trust for everyone.',
  },
  {
    question: 'What happens if nobody picks up a donation?',
    answer:
      'Donors choose a pickup window when listing. If a delivery risks missing the window, freshness alerts go out and the AI immediately re-matches to the next best NGO.',
  },
  {
    question: 'How is impact measured?',
    answer:
      'Every delivery is confirmed by the receiving NGO. Standard conversion factors turn confirmed kilograms into meals and CO₂ saved — no estimates, no rounding up.',
  },
  {
    question: 'Which cities are live right now?',
    answer:
      'Mumbai, Pune, and Bengaluru are live today, with a roadmap to seven more cities this year. Cities join as soon as enough donors, NGOs, and volunteers are onboarded.',
  },
]

export default function HowItWorksPage() {
  const [activeRole, setActiveRole] = useState(roles[0].id)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const role = roles.find((r) => r.id === activeRole) ?? roles[0]

  return (
    <PublicLayout>
      <PageHero
        eyebrow="How it works"
        title={
          <>
            From surplus to supper <span className="bg-gradient-to-r from-brand-600 to-emerald-500 bg-clip-text text-transparent">in four steps.</span>
          </>
        }
        description="One connected loop for donors, NGOs, and volunteers — with AI doing the matching and the tracking doing the counting."
      >
        <Link
          to="/register"
          className="group inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
        >
          Get started free
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </PageHero>

      {/* The loop */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">The loop</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              The same four moves, every single day.
            </h2>
          </Reveal>

          <div className="relative mt-16">
            <div className="absolute inset-x-8 top-8 hidden h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent lg:block" />
            <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {steps.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.1}>
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

      {/* Role tabs */}
      <section className="bg-neutral-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Your role</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              The loop looks different from each side.
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-10 flex justify-center">
              <div
                className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-neutral-200 bg-white p-1 shadow-sm"
                role="tablist"
                aria-label="Choose your role"
              >
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    id={`tab-${r.id}`}
                    aria-selected={activeRole === r.id}
                    aria-controls={`panel-${r.id}`}
                    onClick={() => setActiveRole(r.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition ${
                      activeRole === r.id
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    <r.icon className="size-4" />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div
              id={`panel-${role.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${role.id}`}
              className="mx-auto mt-10 max-w-3xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.14)] sm:p-10"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{role.label}</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">{role.heading}</h3>
              <p className="mt-2 text-neutral-600">{role.description}</p>

              <ol className="mt-8 space-y-6">
                {role.steps.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-neutral-900">{step.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <Link
                to={role.cta.to}
                className="group mt-8 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
              >
                {role.cta.label}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">FAQ</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Common questions, straight answers.
            </h2>
          </Reveal>

          <div className="mt-12 space-y-3">
            {faqs.map((faq, i) => {
              const open = openFaq === i
              return (
                <Reveal key={faq.question} delay={i * 0.05}>
                  <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-brand-300">
                    <button
                      type="button"
                      id={`faq-${i}`}
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="font-semibold text-neutral-900">{faq.question}</span>
                      <ChevronDown
                        className={`size-5 shrink-0 text-neutral-400 transition-transform duration-300 ${open ? 'rotate-180 text-brand-600' : ''}`}
                      />
                    </button>
                    {open && (
                      <p
                        id={`faq-panel-${i}`}
                        role="region"
                        aria-labelledby={`faq-${i}`}
                        className="border-t border-neutral-100 px-6 py-5 text-sm leading-relaxed text-neutral-600"
                      >
                        {faq.answer}
                      </p>
                    )}
                  </div>
                </Reveal>
              )
            })}
          </div>

          <Reveal delay={0.1} className="mt-10 text-center">
            <p className="inline-flex items-center gap-2 text-sm text-neutral-500">
              <ShieldCheck className="size-4 text-brand-600" />
              Still curious?{' '}
              <Link to="/contact" className="font-medium text-brand-700 hover:underline">
                Talk to us
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </PublicLayout>
  )
}
