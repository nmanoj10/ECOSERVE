import type { ReactNode } from 'react'
import { BadgeCheck, Leaf, Quote } from 'lucide-react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  /** Optional custom brand-panel content (e.g. a product mockup). Defaults to the headline + testimonial. */
  panel?: ReactNode
  /**
   * Optional image URL rendered edge-to-edge as the brand panel backdrop. When
   * set, the ambient glows are swapped for the photo plus a scrim that keeps
   * the overlaid logo, `panel`, and stats legible on any frame of the image.
   */
  image?: string
}

/** Two-column shell for the login/register pages: brand story + form. */
export default function AuthLayout({ title, subtitle, children, panel, image }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <aside
        className={`relative hidden w-[44%] overflow-x-hidden overflow-y-auto bg-neutral-950 lg:block ${
          // A photo reads best filling a real viewport-sized frame, so pin the
          // panel while the (much taller) form scrolls beside it. Without an
          // image the panel just stretches with the page, as before.
          image ? 'lg:sticky lg:top-0 lg:h-screen' : ''
        }`}
      >
        {image ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${image})` }}
              aria-hidden="true"
            />
            {/* Scrim: heavier top and bottom (where the text sits), lighter through
                the middle so the photo still reads. */}
            <div
              className="absolute inset-0 bg-gradient-to-b from-neutral-950/90 via-neutral-950/45 to-neutral-950/90"
              aria-hidden="true"
            />
          </>
        ) : (
          <div className="absolute inset-0">
            <div className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
          </div>
        )}
        {/* Fine dot-grid texture, shared by both backdrops. */}
        <div
          className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]"
          aria-hidden="true"
        />

        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Ecoserve home">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <Leaf className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">Ecoserve</span>
          </Link>

          {panel ? (
            <div>{panel}</div>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">The food-rescue platform</p>
              <h2 className="mt-4 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-white">
                Rescue food. Restore communities.
              </h2>
              <p className="mt-3 max-w-sm leading-relaxed text-neutral-400">
                Connect surplus food with the people who need it — in minutes, not days.
              </p>

              {/* Testimonial */}
            <figure className="mt-10 max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <Quote className="size-5 text-brand-400" aria-hidden="true" />
              <blockquote className="mt-2.5 text-sm leading-relaxed text-neutral-300">
                &ldquo;We posted 40 kg of bread and a volunteer picked it up within the hour. It used to take us all
                day.&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-emerald-500 text-xs font-bold text-white">
                  PN
                </span>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    Priya N.
                    <BadgeCheck className="size-4 text-brand-400" aria-label="Verified" />
                  </p>
                  <p className="text-xs text-neutral-500">Kitchen manager, Green Bites</p>
                </div>
              </figcaption>
            </figure>
            </div>
          )}

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

          {/* Live network chip */}
          <div className="absolute right-12 top-24 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs text-neutral-300 backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            12 deliveries in progress right now
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
