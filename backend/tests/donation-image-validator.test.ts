/**
 * Phase 38, Step 96 — ImageKit URL guard (donation image validator).
 *
 * Runs in isolation with `env` mocked to a *configured* ImageKit endpoint so
 * the URL-allowlist refine is exercised deterministically, regardless of the
 * developer's local .env.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/config/env.js', () => ({
  env: { IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/ecoserve' },
}))

import { donationImageSchema } from '../src/validators/donation.js'

describe('donationImageSchema — configured ImageKit endpoint', () => {
  it('accepts a URL hosted on the configured endpoint', () => {
    const result = donationImageSchema.safeParse({
      url: 'https://ik.imagekit.io/ecoserve/donations/abc.jpg',
      fileName: 'abc.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('accepts URLs on sub-paths of the endpoint', () => {
    const result = donationImageSchema.safeParse({
      url: 'https://ik.imagekit.io/ecoserve/tr:w-400/donations/abc.jpg',
      fileName: 'abc.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('rejects URLs outside the endpoint', () => {
    const result = donationImageSchema.safeParse({
      url: 'https://evil.example.com/phish.jpg',
      fileName: 'phish.jpg',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a URL on a lookalike host', () => {
    const result = donationImageSchema.safeParse({
      url: 'https://ik.imagekit.io.evil.example/x.jpg',
      fileName: 'x.jpg',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-URL strings', () => {
    const result = donationImageSchema.safeParse({ url: 'not-a-url', fileName: 'x.jpg' })
    expect(result.success).toBe(false)
  })
})
