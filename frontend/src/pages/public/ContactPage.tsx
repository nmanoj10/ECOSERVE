import { Building2, CheckCircle2, Clock, Mail, MapPin, Phone, Send } from 'lucide-react'
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { PageHero } from '@/components/layout/PageHero'
import PublicLayout from '@/components/layout/PublicLayout'
import { Reveal } from '@/components/home/Reveal'

const channels = [
  {
    icon: Mail,
    title: 'Email us',
    lines: ['hello@ecoserve.org', 'partners@ecoserve.org'],
  },
  {
    icon: Phone,
    title: 'Call us',
    lines: ['+91 22 0000 0000', 'Mon–Sat, 9am–7pm IST'],
  },
  {
    icon: Building2,
    title: 'Head office',
    lines: ['4th Floor, Link House, Andheri East', 'Mumbai 400 069, India'],
  },
  {
    icon: Clock,
    title: 'Response time',
    lines: ['Within 2 business days', 'Faster for active deliveries'],
  },
]

const subjects = ['Donating food', 'Volunteering', 'NGO partnership', 'Corporate partnership', 'Press & media', 'Something else']

interface FormValues {
  name: string
  email: string
  organization: string
  subject: string
  message: string
}

const initialValues: FormValues = { name: '', email: '', organization: '', subject: subjects[0], message: '' }

const inputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function ContactPage() {
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  const update = (field: keyof FormValues) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const next: Partial<Record<keyof FormValues, string>> = {}
    if (!values.name.trim()) next.name = 'Please tell us your name.'
    if (!values.email.trim()) next.email = 'An email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'That email doesn\u2019t look right.'
    if (!values.message.trim()) next.message = 'A message helps us route your query.'
    else if (values.message.trim().length < 10) next.message = 'A little more detail, please (10+ characters).'

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setStatus('sending')
    window.setTimeout(() => setStatus('sent'), 1200)
  }

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Contact"
        title={
          <>
            Let&apos;s talk <span className="bg-gradient-to-r from-brand-600 to-emerald-500 bg-clip-text text-transparent">food rescue.</span>
          </>
        }
        description="Questions about donating, volunteering, partnering, or press — we read everything and reply fast."
      />

      <section className="bg-white pb-24 sm:pb-32">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:px-8">
          {/* Contact channels */}
          <div className="space-y-4">
            {channels.map((channel, i) => (
              <Reveal key={channel.title} delay={i * 0.07}>
                <div className="flex gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25">
                    <channel.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-neutral-900">{channel.title}</p>
                    {channel.lines.map((line) => (
                      <p key={line} className="text-sm text-neutral-600">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}

            <Reveal delay={0.3}>
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
                  <MapPin className="size-4" />
                  Live in three cities
                </p>
                <p className="mt-1 text-sm text-brand-800">
                  Mumbai · Pune · Bengaluru — with seven more cities on the roadmap this year.
                </p>
              </div>
            </Reveal>
          </div>

          {/* Form */}
          <Reveal delay={0.1}>
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.14)] sm:p-8">
              {status === 'sent' ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="size-7" />
                  </span>
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">Message sent!</h2>
                  <p className="mt-2 max-w-sm text-neutral-600">
                    Thanks, {values.name.split(' ')[0] || 'friend'}. We&apos;ll reply within two business days — usually
                    much faster.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setValues(initialValues)
                      setStatus('idle')
                    }}
                    className="mt-6 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Send us a message</h2>
                  <p className="mt-1 text-sm text-neutral-500">Fields marked * are required.</p>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-neutral-700">
                        Full name *
                      </label>
                      <input id="name" type="text" value={values.name} onChange={update('name')} placeholder="Priya Sharma" className={inputClass} />
                      {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
                        Email *
                      </label>
                      <input id="email" type="email" value={values.email} onChange={update('email')} placeholder="you@example.com" className={inputClass} />
                      {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="organization" className="mb-1.5 block text-sm font-medium text-neutral-700">
                        Organization
                      </label>
                      <input id="organization" type="text" value={values.organization} onChange={update('organization')} placeholder="Optional" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-neutral-700">
                        Subject
                      </label>
                      <select id="subject" value={values.subject} onChange={update('subject')} className={inputClass}>
                        {subjects.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-neutral-700">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      value={values.message}
                      onChange={update('message')}
                      placeholder="Tell us about your surplus, your organization, or your idea…"
                      className={`${inputClass} resize-none`}
                    />
                    {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
                  >
                    {status === 'sending' ? 'Sending…' : 'Send message'}
                    <Send className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <p className="mt-4 text-xs text-neutral-500">
                    This demo form doesn&apos;t send data anywhere — it simulates the real flow.
                  </p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  )
}
