import { ArrowRight, Bot, CheckCircle2, Send, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Eyebrow } from '@/components/home/Eyebrow'
import { Reveal } from '@/components/home/Reveal'

const capabilities = [
  'Estimate the carbon impact of any donation in seconds',
  'Match surplus food to the NGOs that need it most',
  'Answer volunteer and donor questions in plain language, 24/7',
]

export default function AiSection() {
  return (
    <section id="ai" className="relative scroll-mt-24 overflow-hidden bg-canvas py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-10">
        <Reveal>
          <Eyebrow>Ecoserve AI</Eyebrow>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Ask anything. Get instant impact.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            The assistant sits inside every workflow — turning questions into actions and surplus into meals.
          </p>

          <ul className="mt-8 space-y-3">
            {capabilities.map((capability) => (
              <li key={capability} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-500" />
                <span className="text-neutral-600">{capability}</span>
              </li>
            ))}
          </ul>

          <Link
            to="/register"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-base font-semibold text-white transition hover:bg-brand-600"
          >
            Try the AI assistant
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>

        {/* Chat mockup */}
        <Reveal delay={0.12}>
          <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-neutral-100 px-6 py-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-500 text-white">
                <Bot className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Ecoserve AI</p>
                <p className="flex items-center gap-1.5 text-xs text-brand-600">
                  <span className="size-1.5 rounded-full bg-brand-500" />
                  Online
                </p>
              </div>
              <Sparkles className="ml-auto size-4 text-neutral-300" />
            </div>

            {/* Messages */}
            <div className="space-y-4 px-6 py-7">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-sm text-white">
                  I have 40 kg of bread expiring tomorrow. Who can take it?
                </p>
              </div>
              <div className="flex justify-start">
                <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-neutral-100 px-4 py-2.5 text-sm leading-relaxed text-neutral-700">
                  Hope Shelter in Andheri can receive 40 kg within 24 hours. Estimated impact:{' '}
                  <span className="font-semibold text-brand-600">~240 meals</span> ·{' '}
                  <span className="font-semibold text-brand-600">96 kg CO₂ saved</span>. Want me to create the donation?
                </p>
              </div>

              {/* Typing indicator */}
              <div className="flex items-center gap-1.5 pl-2" aria-hidden>
                <span className="size-1.5 animate-bounce rounded-full bg-neutral-300 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-neutral-300 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-neutral-300 [animation-delay:300ms]" />
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-neutral-100 px-6 py-5">
              <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-canvas py-2 pl-5 pr-2">
                <span className="flex-1 truncate text-sm text-neutral-400" aria-hidden>
                  Ask about a donation, route, or impact…
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Send className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-center text-[11px] text-neutral-400">
                Demo interface — the assistant ships with the full platform.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
