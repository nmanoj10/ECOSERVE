import type { ReactNode } from 'react'
import { Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

/** Two-column shell for the login/register pages: brand story + form. */
export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] overflow-hidden bg-neutral-950 lg:block">
        <div className="absolute inset-0">
          <div className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />
        </div>

        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Ecoserve home">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <Leaf className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">Ecoserve</span>
          </Link>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">The food-rescue platform</p>
            <h2 className="mt-4 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-white">
              Rescue food. Restore communities.
            </h2>
            <p className="mt-3 max-w-sm leading-relaxed text-neutral-400">
              Connect surplus food with the people who need it — in minutes, not days.
            </p>
          </div>

          <div className="flex items-center gap-8">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-white">482k+</p>
              <p className="text-sm text-neutral-500">meals rescued</p>
            </div>
            <div className="h-9 w-px bg-white/10" />
            <div>
              <p className="text-2xl font-semibold tracking-tight text-white">3,840</p>
              <p className="text-sm text-neutral-500">active volunteers</p>
            </div>
            <div className="h-9 w-px bg-white/10" />
            <div>
              <p className="text-2xl font-semibold tracking-tight text-white">186 t</p>
              <p className="text-sm text-neutral-500">CO₂ saved</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center lg:mb-6 lg:items-start lg:text-left">
            <Link to="/" className="lg:hidden" aria-label="Ecoserve home">
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Leaf className="size-6" />
              </span>
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900 lg:mt-0">{title}</h1>
            <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
          </div>

          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  )
}
