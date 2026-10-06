import { Bike, HandHeart, ShieldCheck, Store } from 'lucide-react'

const roles = [
  {
    icon: Store,
    label: 'Donors',
    detail: 'Restaurant, grocery, or caterer with surplus food.',
  },
  {
    icon: HandHeart,
    label: 'NGOs',
    detail: 'Verified organization serving communities.',
  },
  {
    icon: Bike,
    label: 'Volunteers',
    detail: 'Deliver rescued food across your city.',
  },
]

/**
 * Text overlay for the register page brand panel, which is backed by a
 * full-bleed photo. Every block sits on its own translucent surface so it
 * stays readable no matter what the image is doing behind it.
 */
export default function RegisterImagePanel() {
  return (
    <div className="max-w-sm">
      <p className="inline-flex rounded-full bg-neutral-950/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300 backdrop-blur-sm">
        Join the network
      </p>
      <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
        Your account, live in under 2 minutes.
      </h2>
      <p className="mt-3 max-w-sm leading-relaxed text-neutral-200 [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]">
        Pick a role, verify, and start rescuing food the same day.
      </p>

      <ul className="mt-7 space-y-2.5">
        {roles.map((role) => (
          <li
            key={role.label}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-950/45 px-3.5 py-3 backdrop-blur-md"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/25 text-brand-300 ring-1 ring-inset ring-brand-400/30">
              <role.icon className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">{role.label}</span>
              <span className="block text-xs leading-snug text-neutral-300">{role.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-3 py-1.5 text-xs font-semibold text-brand-100 ring-1 ring-inset ring-brand-400/30 backdrop-blur-md">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Free for charities
      </p>
    </div>
  )
}
