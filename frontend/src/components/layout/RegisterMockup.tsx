import { Bike, CheckCircle2, HandHeart, Leaf, ShieldCheck, Sparkles, Store } from 'lucide-react'

const roles = [
  { icon: Store, label: 'Restaurants', detail: 'Grocers & caterers' },
  { icon: HandHeart, label: 'Charities', detail: 'Verified NGOs', active: true },
  { icon: Bike, label: 'Riders', detail: 'City volunteers' },
]

const steps = [
  { label: 'Account created', note: 'Done', done: true },
  { label: 'Email confirmed', note: 'Done', done: true },
  { label: 'Charity verification', note: 'In progress', live: true },
  { label: 'You are live', note: 'Waiting', pending: true },
]

/**
 * Pure-CSS onboarding mockup for the register page brand panel — shows the
 * role picker and verification flow as a live-looking app window.
 */
export default function RegisterMockup() {
  return (
    <div className="max-w-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">Join the network</p>
      <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-white">
        Your account, live in under 2 minutes.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">
        Pick a role, verify, and start rescuing food the same day.
      </p>

      <div className="relative mt-6">
        <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/25 to-emerald-500/15 blur-2xl" />

        {/* App window */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 shadow-2xl">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-2.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
              <Leaf className="size-3 text-brand-400" />
              Ecoserve · Onboarding
            </span>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
              <ShieldCheck className="size-3" />
              SECURE
            </span>
          </div>

          <div className="space-y-3.5 p-4">
            {/* Welcome row */}
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-500 text-white shadow-lg shadow-brand-500/25">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Welcome aboard!</p>
                <p className="text-[11px] text-neutral-400">Your charity profile is almost ready</p>
              </div>
            </div>

            {/* Role picker */}
            <div className="grid grid-cols-3 gap-2">
              {roles.map((role) => (
                <div
                  key={role.label}
                  className={`rounded-xl border p-2.5 text-center transition ${
                    role.active
                      ? 'border-brand-400/60 bg-brand-500/10 ring-1 ring-inset ring-brand-400/30'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <role.icon className={`mx-auto size-4 ${role.active ? 'text-brand-300' : 'text-neutral-500'}`} />
                  <p className={`mt-1.5 text-[11px] font-semibold ${role.active ? 'text-white' : 'text-neutral-400'}`}>
                    {role.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Setup progress */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                Setup progress
              </p>
              <ul className="space-y-1">
                {steps.map((step) => (
                  <li key={step.label} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
                    {step.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                    ) : step.live ? (
                      <span className="relative flex size-4 shrink-0 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
                        <span className="relative inline-flex size-4 rounded-full bg-brand-500/80 ring-2 ring-brand-400/30" />
                      </span>
                    ) : (
                      <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-white/15" />
                    )}
                    <span className={`text-xs ${step.done || step.live ? 'text-neutral-200' : 'text-neutral-500'}`}>
                      {step.label}
                    </span>
                    <span
                      className={`ml-auto text-[10px] font-semibold ${
                        step.done ? 'text-emerald-400' : step.live ? 'text-brand-300' : 'text-neutral-600'
                      }`}
                    >
                      {step.note}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Impact footer */}
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-3.5 py-2.5 ring-1 ring-inset ring-white/10">
              <span className="text-[11px] text-neutral-400">Once verified, your rescue starts</span>
              <span className="text-[11px] font-semibold text-white">
                240 meals <span className="text-emerald-400">· 96 kg CO₂</span>
              </span>
            </div>
          </div>
        </div>

        {/* Floating chips */}
        <div className="absolute -right-2 -top-4 animate-float">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-neutral-900/95 px-3 py-2 shadow-xl ring-1 ring-white/10 backdrop-blur">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckCircle2 className="size-3.5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold text-white">Email confirmed</p>
              <p className="text-[9px] text-neutral-400">3 min ago</p>
            </div>
          </div>
        </div>

        <div className="absolute -left-2 bottom-12 animate-float-delayed">
          <div className="flex items-center gap-2 rounded-xl bg-brand-500/15 px-3 py-2 ring-1 ring-inset ring-brand-400/30 backdrop-blur">
            <ShieldCheck className="size-3.5 text-brand-300" />
            <p className="text-[11px] font-semibold text-brand-200">Free for charities</p>
          </div>
        </div>
      </div>
    </div>
  )
}
