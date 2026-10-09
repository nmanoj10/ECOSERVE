/**
 * SEO metadata tests.
 *
 * PageMeta mirrors the current route into the document head: title, meta
 * description, og:/twitter: tags, and a self-referencing canonical URL (the
 * static index.html can't know which route served it — vercel.json rewrites
 * every path to the same file).
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { PageMeta, metaFor } from '@/components/seo/PageMeta'

describe('metaFor', () => {
  it('returns the exact match for a known route', () => {
    expect(metaFor('/about').title).toBe('About Ecoserve — Rescuing food, restoring communities')
  })

  it('falls back to the longest matching prefix for nested routes', () => {
    expect(metaFor('/donor/new').title).toBe('Donor dashboard — Ecoserve')
    expect(metaFor('/ngo/profile').title).toBe('NGO dashboard — Ecoserve')
  })

  it('uses the site defaults for unknown paths', () => {
    expect(metaFor('/some/unknown/path').title).toBe(
      'Ecoserve — Rescue surplus food, feed communities',
    )
  })
})

describe('<PageMeta />', () => {
  it('sets the document title, description, and canonical for the route', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <PageMeta />
      </MemoryRouter>,
    )

    expect(document.title).toBe('About Ecoserve — Rescuing food, restoring communities')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      metaFor('/about').description,
    )
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://ecoserve.vercel.app/about',
    )
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://ecoserve.vercel.app/about',
    )
  })

  it('points the homepage canonical at the bare origin', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PageMeta />
      </MemoryRouter>,
    )

    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://ecoserve.vercel.app/',
    )
  })

  it('keeps social tags in step with the title', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <PageMeta />
      </MemoryRouter>,
    )

    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      document.title,
    )
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(
      document.title,
    )
  })
})
