import { Leaf, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  const isHome = pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on navigation.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // The mobile sheet overlays the page — stop the page scrolling behind it.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const links = isHome ? homeLinks : pageLinks

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <nav
        aria-label="Main"
        className={`transition-colors duration-300 ${
          scrolled ? 'border-b border-neutral-200/80 bg-canvas/85 backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        {/* Three equal columns keep the link group optically centred. */}
        <div className="mx-auto grid h-20 max-w-7xl grid-cols-[1fr_auto] items-center gap-6 px-6 sm:px-8 lg:grid-cols-[1fr_auto_1fr] lg:px-10">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Ecoserve home">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-white">
              <Leaf className="size-5" />
            </span>
            <span className="text-[22px] font-bold tracking-tight text-neutral-900">Ecoserve</span>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {links.map((link) =>
              'to' in link ? (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-[15px] transition ${
                    pathname === link.to
                      ? 'font-medium text-neutral-900'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-[15px] text-neutral-600 transition hover:text-neutral-900"
                >
                  {link.label}
                </a>
              ),
            )}
          </div>

          <div className="hidden items-center justify-end gap-5 lg:flex">
            <Link to="/login" className="text-[15px] font-medium text-neutral-900 transition hover:text-brand-600">
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-neutral-900 px-6 py-3 text-[15px] font-medium text-white transition hover:bg-neutral-700"
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
          <div className="border-b border-neutral-200 bg-canvas px-6 pb-8 pt-4 backdrop-blur-xl lg:hidden">
            <div className="flex flex-col">
              {links.map((link) =>
                'to' in link ? (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={`border-b border-neutral-200/70 py-3.5 text-[15px] transition ${
                      pathname === link.to ? 'font-medium text-brand-600' : 'text-neutral-700'
                    }`}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="border-b border-neutral-200/70 py-3.5 text-[15px] text-neutral-700 transition"
                  >
                    {link.label}
                  </a>
                ),
              )}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-neutral-200 bg-white px-5 py-3 text-center text-[15px] font-medium text-neutral-900 transition hover:bg-neutral-50"
              >
                Log in
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full bg-neutral-900 px-5 py-3 text-center text-[15px] font-medium text-white transition hover:bg-neutral-700"
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
