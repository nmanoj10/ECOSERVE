import { ArrowRight, Bot, CheckCircle2, Send, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/home/Reveal'

const capabilities = [
  'Estimate the carbon impact of any donation in seconds',
  'Match surplus food to the NGOs that need it most',
  'Answer volunteer and donor questions in plain language, 24/7',
]

export default function AiSection() {
  return (
    <section id="ai" className="relative scroll-mt-24 overflow-hidden bg-neutral-950 py-24 sm:py-32">
      {/* Backdrop */}
      <div className="absolute inset-0">
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">Ecoserve AI</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ask anything. Get instant impact.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-400">
            The assistant sits inside every workflow — turning questions into actions and surplus into meals.
          </p>

          <ul className="mt-8 space-y-3">
            {capabilities.map((capability) => (
              <li key={capability} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-400" />
                <span className="text-neutral-300">{capability}</span>
              </li>
            ))}
          </ul>

          <Link
            to="/register"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-400"
          >
            Try the AI assistant
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        {/* Chat mockup */}
        <Reveal delay={0.15}>
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/30 to-emerald-500/20 blur-2xl" />

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4">
                <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-emerald-400 text-white">
                  <Bot className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Ecoserve AI</p>
                  <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    Online
                  </p>
                </div>
                <Sparkles className="ml-auto size-4 text-neutral-500" />
              </div>

              {/* Messages */}
              <div className="space-y-4 px-5 py-6">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white">
                    I have 40 kg of bread expiring tomorrow. Who can take it?
                  </p>
                </div>
                <div className="flex justify-start">
                  <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-2.5 text-sm leading-relaxed text-neutral-200">
                    Hope Shelter in Andheri can receive 40 kg within 24 hours. Estimated impact:{' '}
                    <span className="font-medium text-emerald-400">~240 meals</span> ·{' '}
                    <span className="font-medium text-emerald-400">96 kg CO₂ saved</span>. Want me to create the
                    donation?
                  </p>
                </div>

                {/* Typing indicator */}
                <div className="flex items-center gap-1.5 pl-2" aria-hidden>
                  <span className="size-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:300ms]" />
                </div>
              </div>

              {/* Input */}
              <div className="border-t border-white/10 bg-white/[0.03] px-5 py-4">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-950 py-2 pl-4 pr-1.5">
                  <span className="flex-1 truncate text-sm text-neutral-500" aria-hidden>
                    Ask about a donation, route, or impact…
                  </span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                    <Send className="size-4" />
                  </span>
                </div>
                <p className="mt-2.5 text-center text-[11px] text-neutral-600">
                  Demo interface — the assistant ships with the full platform.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
