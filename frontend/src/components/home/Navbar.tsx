import { Leaf, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const homeLinks = [
  { href: '#problem', label: 'The problem' },
  { href: '#solution', label: 'Solution' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#ai', label: 'AI assistant' },
  { href: '#live', label: 'Live tracking' },
  { href: '#impact', label: 'Impact' },
]

const pageLinks = [
  { to: '/about', label: 'About' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/features', label: 'Features' },
  { to: '/impact', label: 'Impact' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const isHome = pathname === '/'

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8)
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? window.scrollY / max : 0
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on navigation.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const renderLink = (link: (typeof pageLinks)[number] | (typeof homeLinks)[number]) => {
    if ('to' in link) {
      const active = pathname === link.to
      return (
        <Link
          key={link.to}
          to={link.to}
          className={`rounded-full px-3.5 py-1.5 text-sm transition ${
            active
              ? 'bg-brand-50 font-medium text-brand-800'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
          }`}
        >
          {link.label}
        </Link>
      )
    }
    return (
      <a
        key={link.href}
        href={link.href}
        className="rounded-full px-3.5 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
      >
        {link.label}
      </a>
    )
  }

  const links = isHome ? homeLinks : pageLinks

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Reading progress */}
      <div className="h-0.5 bg-neutral-900/[0.06]">
        <div
          ref={barRef}
          className="h-full w-full origin-left scale-x-0 bg-gradient-to-r from-brand-500 via-emerald-500 to-teal-400"
        />
      </div>

      <nav
        aria-label="Main"
        className={`border-b transition-colors duration-300 ${
          scrolled
            ? 'border-neutral-200 bg-white/90 shadow-sm backdrop-blur-xl'
            : 'border-transparent bg-white/60 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Ecoserve home">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <Leaf className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-neutral-900">Ecoserve</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">{links.map(renderLink)}</div>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              to="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              Sign up
            </Link>
          </div>

          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-neutral-200 bg-white/95 px-4 pb-6 pt-2 backdrop-blur-xl lg:hidden">
            <div className="flex flex-col gap-1">
              {links.map((link) =>
                'to' in link ? (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      pathname === link.to
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-neutral-700 hover:bg-brand-50 hover:text-brand-800'
                    }`}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-brand-50 hover:text-brand-800"
                  >
                    {link.label}
                  </a>
                ),
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Log in
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
