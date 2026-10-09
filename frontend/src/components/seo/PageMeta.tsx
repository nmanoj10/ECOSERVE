import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Per-route SEO metadata.
 *
 * index.html ships sensible static defaults for crawlers that don't run
 * JavaScript; this component swaps in the route-specific title, description,
 * canonical URL, and social tags once the SPA takes over. Canonical stays
 * dynamic because every route is served the same index.html (vercel.json
 * rewrites), so the static file can't know which URL it was requested for.
 */

/** Canonical production origin — used for og:url and rel=canonical. */
const SITE_URL = 'https://ecoserve.vercel.app'

const DEFAULT_META = {
  title: 'Ecoserve — Rescue surplus food, feed communities',
  description:
    'Ecoserve connects restaurants, grocers, and caterers with verified NGOs and volunteers to rescue surplus food — every meal, kilogram, and CO₂ saved, tracked live.',
}

type PageMeta = { title: string; description: string }

/**
 * Known routes. Exact matches win; nested paths (e.g. /donor/new) fall back
 * to their longest matching prefix, and anything unmatched uses the site
 * defaults. Keep titles under ~60 characters and descriptions under ~160.
 */
const ROUTES: Record<string, PageMeta> = {
  '/': {
    title: 'Ecoserve — Rescue surplus food, feed communities',
    description:
      'Ecoserve connects restaurants, grocers, and caterers with verified NGOs and volunteers to rescue surplus food — every meal, kilogram, and CO₂ saved, tracked live.',
  },
  '/how-it-works': {
    title: 'How It Works — Ecoserve',
    description:
      'From surplus to supper in four steps: list surplus food, let Ecoserve AI match it to a verified NGO, hand it to a volunteer, and watch the impact get counted.',
  },
  '/features': {
    title: 'Features — Ecoserve',
    description:
      'AI matching, optimized routing, live delivery tracking, impact dashboards, and 24/7 AI assistance — everything donors, NGOs, and volunteers need in one place.',
  },
  '/impact': {
    title: 'Impact — Ecoserve',
    description:
      'Live numbers from the Ecoserve network: meals rescued, kilograms saved, and CO₂ avoided — updated the moment an NGO confirms a delivery.',
  },
  '/about': {
    title: 'About Ecoserve — Rescuing food, restoring communities',
    description:
      'Ecoserve builds the connective tissue between surplus food and the people who need it — one verified delivery at a time. Meet the team and the mission.',
  },
  '/contact': {
    title: 'Contact Ecoserve — Let’s talk food rescue',
    description:
      'Questions about donating, volunteering, partnering, or press? Reach the Ecoserve team — we read everything and reply fast.',
  },
  '/login': {
    title: 'Log in — Ecoserve',
    description:
      'Sign in to your Ecoserve account to manage donations, deliveries, and impact as a donor, NGO, volunteer, or admin.',
  },
  '/register': {
    title: 'Create your account — Ecoserve',
    description:
      'Join Ecoserve free: create a donor, NGO, or volunteer account and start rescuing surplus food in your city today.',
  },
  '/donor': { title: 'Donor dashboard — Ecoserve', description: DEFAULT_META.description },
  '/ngo': { title: 'NGO dashboard — Ecoserve', description: DEFAULT_META.description },
  '/volunteer': { title: 'Volunteer dashboard — Ecoserve', description: DEFAULT_META.description },
  '/admin': { title: 'Admin dashboard — Ecoserve', description: DEFAULT_META.description },
  '/design-system': { title: 'Design system — Ecoserve', description: DEFAULT_META.description },
}

/** Resolve the metadata for a pathname: exact match, then longest prefix, then defaults. */
export function metaFor(pathname: string): PageMeta {
  const exact = ROUTES[pathname]
  if (exact) return exact

  const prefix = Object.keys(ROUTES)
    .filter((path) => path !== '/' && pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0]

  return (prefix ? ROUTES[prefix] : undefined) ?? DEFAULT_META
}

function setMetaTag(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

/** Keeps document head metadata in sync with the current route. */
export function PageMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const { title, description } = metaFor(pathname)
    const url = `${SITE_URL}${pathname}`

    document.title = title
    setMetaTag('name', 'description', description)
    setMetaTag('property', 'og:title', title)
    setMetaTag('property', 'og:description', description)
    setMetaTag('property', 'og:url', url)
    setMetaTag('name', 'twitter:title', title)
    setMetaTag('name', 'twitter:description', description)
    setCanonical(url)
  }, [pathname])

  return null
}
