import type { ReactNode } from 'react'
import { Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

/** Simple light shell: logo, heading, and the form on a centered white card. */
export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-canvas px-4 py-10 sm:px-8 sm:py-12">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(34,197,94,0.08),transparent)]"
        aria-hidden="true"
      />

      <div className="animate-panel-in relative w-full max-w-[26rem] sm:max-w-[30rem]">
        <div className="flex flex-col items-center text-center">
          <Link to="/" aria-label="Ecoserve home">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
              <Leaf className="size-6" />
            </span>
          </Link>
          <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-[1.65rem]">
            {title}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{subtitle}</p>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}
