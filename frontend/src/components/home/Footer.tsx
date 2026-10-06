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
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2.5" aria-label="Ecoserve home">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-white">
                <Leaf className="size-5" />
              </span>
              <span className="text-[22px] font-bold tracking-tight text-neutral-900">Ecoserve</span>
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-neutral-600">
              The food-rescue platform connecting donors, NGOs, and volunteers — keeping surplus food on plates and out
              of landfills.
            </p>
            <div id="contact" className="mt-7 space-y-3 text-sm text-neutral-600">
              <p className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-brand-500" />
                hello@ecoserve.org
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-brand-500" />
                +91 22 0000 0000
              </p>
              <p className="flex items-center gap-2.5">
                <MapPin className="size-4 shrink-0 text-brand-500" />
                Mumbai · Pune · Bengaluru
              </p>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-semibold text-neutral-900">{column.title}</h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link to={link.to} className="text-sm text-neutral-600 transition hover:text-brand-600">
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className="text-sm text-neutral-600 transition hover:text-brand-600">
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

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-neutral-200 pt-8 text-sm text-neutral-500 sm:flex-row">
          <span>© 2026 Ecoserve. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <Leaf className="size-3.5 text-brand-500" />
            Built for a greener tomorrow.
          </span>
        </div>
      </div>
    </footer>
  )
}
