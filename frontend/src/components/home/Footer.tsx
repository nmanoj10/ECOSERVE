import { Leaf, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

const columns = [
  {
    title: 'Platform',
    links: [
      { label: 'Donate food', to: '/register' },
      { label: 'Become a volunteer', to: '/register' },
      { label: 'NGO portal', to: '/register' },
      { label: 'Live tracking', href: '/#live' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', to: '/about' },
      { label: 'Impact report', to: '/impact' },
      { label: 'AI assistant', href: '/#ai' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'How it works', to: '/how-it-works' },
      { label: 'Features', to: '/features' },
      { label: 'Privacy policy', href: '#' },
      { label: 'Terms of service', href: '#' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Leaf className="size-5" />
              </span>
              <span className="text-lg font-semibold tracking-tight text-white">Ecoserve</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-400">
              The food-rescue platform connecting donors, NGOs, and volunteers — keeping surplus food on plates and out
              of landfills.
            </p>
            <div id="contact" className="mt-6 space-y-2.5 text-sm text-neutral-400">
              <p className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-brand-400" />
                hello@ecoserve.org
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-brand-400" />
                +91 22 0000 0000
              </p>
              <p className="flex items-center gap-2.5">
                <MapPin className="size-4 shrink-0 text-brand-400" />
                Mumbai · Pune · Bengaluru
              </p>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{column.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link
                          to={link.to}
                          className="text-sm text-neutral-400 transition hover:text-brand-300"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className="text-sm text-neutral-400 transition hover:text-brand-300">
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-8 text-sm text-neutral-500 sm:flex-row">
          <span>© 2026 Ecoserve. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <Leaf className="size-3.5 text-brand-400" />
            Built for a greener tomorrow.
          </span>
        </div>
      </div>
    </footer>
  )
}
