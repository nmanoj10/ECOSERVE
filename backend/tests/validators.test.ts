/**
 * Phase 38, Step 96 — Validator unit tests.
 *
 * Every zod schema that guards the API surface: auth refresh, donation
 * create/list, NGO nearby + claim, volunteer availability, location reports,
 * assignments, and the admin management queries.
 */
import { describe, expect, it } from 'vitest'

import { env } from '../src/config/env.js'
import { refreshSchema } from '../src/validators/auth.js'
import { createDonationSchema, donationImageSchema, listDonationsQuerySchema } from '../src/validators/donation.js'
import { createAssignmentSchema, recommendQuerySchema } from '../src/validators/assignment.js'
import { registerSchema } from '../src/validators/register.js'
import { updateAvailabilitySchema } from '../src/validators/volunteer.js'
import { createNgoRequestSchema, nearbyDonationsQuerySchema } from '../src/validators/ngo.js'
import { submitLocationSchema } from '../src/validators/location.js'
import {
  listAdminDeliveriesQuerySchema,
  listAdminDonationsQuerySchema,
  listNgosQuerySchema,
  listUsersQuerySchema,
  rejectNgoSchema,
  reportsQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../src/validators/admin.js'

const validDonation = {
  foodName: 'Paneer curry',
  category: 'Cooked',
  quantity: 5,
  unit: 'kg',
  pickupAddress: '12 MG Road, Bengaluru',
}

/** URLs that pass the ImageKit endpoint guard regardless of the local .env. */
const imageEndpoint = env.IMAGEKIT_URL_ENDPOINT ?? 'https://ik.imagekit.io/ecoserve'
const imageUrl = (name: string) => `${imageEndpoint}/${name}`

describe('auth validators', () => {
  it('accepts a refresh token of sufficient length', () => {
    expect(refreshSchema.safeParse({ refreshToken: 'x'.repeat(10) }).success).toBe(true)
  })

  it('rejects short or missing refresh tokens', () => {
    expect(refreshSchema.safeParse({ refreshToken: 'short' }).success).toBe(false)
    expect(refreshSchema.safeParse({}).success).toBe(false)
  })

  it('trims surrounding whitespace before validating', () => {
    expect(refreshSchema.safeParse({ refreshToken: '   ' + 'x'.repeat(10) + '  ' }).success).toBe(true)
  })
})

describe('createDonationSchema', () => {
  it('accepts a minimal valid donation', () => {
    const result = createDonationSchema.safeParse(validDonation)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.images).toEqual([]) // default applied
  })

  it('rejects non-positive quantity', () => {
    expect(createDonationSchema.safeParse({ ...validDonation, quantity: 0 }).success).toBe(false)
    expect(createDonationSchema.safeParse({ ...validDonation, quantity: -2 }).success).toBe(false)
  })

  it('rejects missing required fields', () => {
    expect(createDonationSchema.safeParse({ foodName: 'x' }).success).toBe(false)
    expect(createDonationSchema.safeParse({ ...validDonation, foodName: '' }).success).toBe(false)
  })

  it('rejects out-of-range coordinates', () => {
    expect(createDonationSchema.safeParse({ ...validDonation, latitude: 91 }).success).toBe(false)
    expect(createDonationSchema.safeParse({ ...validDonation, longitude: -181 }).success).toBe(false)
    expect(createDonationSchema.safeParse({ ...validDonation, latitude: 12.9, longitude: 77.5 }).success).toBe(true)
  })

  it('rejects a pickup time after the expiry time', () => {
    expect(
      createDonationSchema.safeParse({
        ...validDonation,
        pickupTime: '2026-08-10T15:00:00+05:30',
        expiryTime: '2026-08-10T12:00:00+05:30',
      }).success,
    ).toBe(false)
  })

  it('rejects an expiry time before the prepared time', () => {
    expect(
      createDonationSchema.safeParse({
        ...validDonation,
        preparedAt: '2026-08-10T11:00:00+05:30',
        expiryTime: '2026-08-10T10:00:00+05:30',
      }).success,
    ).toBe(false)
  })

  it('accepts a valid prepared < expiry ordering', () => {
    expect(
      createDonationSchema.safeParse({
        ...validDonation,
        preparedAt: '2026-08-10T09:00:00+05:30',
        expiryTime: '2026-08-10T12:00:00+05:30',
        pickupTime: '2026-08-10T11:00:00+05:30',
      }).success,
    ).toBe(true)
  })

  it('rejects more than three images', () => {
    const img = (i: number) => ({ url: imageUrl(`${i}.jpg`), fileName: `${i}.jpg` })
    const result = createDonationSchema.safeParse({
      ...validDonation,
      images: [img(1), img(2), img(3), img(4)],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an image missing a URL', () => {
    const result = createDonationSchema.safeParse({
      ...validDonation,
      images: [{ fileName: 'a.jpg' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts up to three well-formed images', () => {
    const result = createDonationSchema.safeParse({
      ...validDonation,
      images: [
        { url: imageUrl('1.jpg'), fileName: '1.jpg', mimeType: 'image/jpeg', fileSize: 1024 },
        { url: imageUrl('2.webp'), fileName: '2.webp', mimeType: 'image/webp' },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('donationImageSchema', () => {
  it('rejects an oversized image file', () => {
    const result = donationImageSchema.safeParse({
      url: imageUrl('big.jpg'),
      fileName: 'big.jpg',
      fileSize: 6 * 1024 * 1024,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unsupported mime type', () => {
    const result = donationImageSchema.safeParse({
      url: imageUrl('x.gif'),
      fileName: 'x.gif',
      mimeType: 'image/gif',
    })
    expect(result.success).toBe(false)
  })

  it('respects the ImageKit endpoint guard when configured', () => {
    const endpoint = env.IMAGEKIT_URL_ENDPOINT
    const result = donationImageSchema.safeParse({ url: 'https://evil.example.com/x.jpg', fileName: 'x.jpg' })
    if (endpoint) {
      expect(result.success).toBe(false)
    } else {
      // Unconfigured (demo mode) — any URL is accepted.
      expect(result.success).toBe(true)
    }
  })
})

describe('listDonationsQuerySchema', () => {
  it('applies default pagination', () => {
    const result = listDonationsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(10)
    }
  })

  it('coerces string numbers from query params', () => {
    const result = listDonationsQuerySchema.safeParse({ page: '2', limit: '25' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(25)
    }
  })

  it('rejects an excessive limit, a bad status, and an out-of-range priority', () => {
    expect(listDonationsQuerySchema.safeParse({ limit: '51' }).success).toBe(false)
    expect(listDonationsQuerySchema.safeParse({ status: 'DELIVERING' }).success).toBe(false)
    expect(listDonationsQuerySchema.safeParse({ priority: '6' }).success).toBe(false)
    expect(listDonationsQuerySchema.safeParse({ priority: '3' }).success).toBe(true)
  })

  it('rejects malformed date ranges', () => {
    expect(listDonationsQuerySchema.safeParse({ dateFrom: 'yesterday' }).success).toBe(false)
    expect(listDonationsQuerySchema.safeParse({ dateFrom: '2026-08-01T00:00:00Z' }).success).toBe(true)
  })
})

describe('registerSchema', () => {
  it('accepts a complete donor registration', () => {
    const result = registerSchema.safeParse({
      fullName: 'Spice House',
      role: 'DONOR',
      phone: '9876543210',
      donor: {
        organizationName: 'Spice House',
        organizationType: 'Restaurant',
        address: '12 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a volunteer registration with no profile', () => {
    const result = registerSchema.safeParse({ fullName: 'Ravi', role: 'VOLUNTEER' })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown role and a missing name', () => {
    expect(registerSchema.safeParse({ fullName: 'X', role: 'SUPERHERO' }).success).toBe(false)
    expect(registerSchema.safeParse({ role: 'NGO' }).success).toBe(false)
  })

  it('rejects a fractional NGO capacity', () => {
    const result = registerSchema.safeParse({
      fullName: 'Hope',
      role: 'NGO',
      ngo: {
        ngoName: 'Hope NGO',
        registrationNumber: 'NG-1',
        address: 'A',
        city: 'C',
        state: 'S',
        capacity: 5.5,
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects out-of-range donor coordinates', () => {
    const base = {
      fullName: 'Spice House',
      role: 'DONOR' as const,
      donor: {
        organizationName: 'Spice House',
        organizationType: 'Restaurant',
        address: 'A',
        city: 'C',
        state: 'S',
      },
    }
    expect(registerSchema.safeParse({ ...base, donor: { ...base.donor, latitude: 95 } }).success).toBe(false)
  })
})

describe('assignment validators', () => {
  it('accepts a donation id', () => {
    expect(createAssignmentSchema.safeParse({ donationId: 'don-123' }).success).toBe(true)
  })

  it('rejects an empty donation id', () => {
    expect(createAssignmentSchema.safeParse({ donationId: '' }).success).toBe(false)
    expect(createAssignmentSchema.safeParse({}).success).toBe(false)
  })

  it('defaults the recommendation limit to 5 and caps it at 20', () => {
    const result = recommendQuerySchema.safeParse({ donationId: 'don-123' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(5)

    expect(recommendQuerySchema.safeParse({ donationId: 'don-123', limit: '21' }).success).toBe(false)
    expect(recommendQuerySchema.safeParse({ donationId: 'don-123', limit: '20' }).success).toBe(true)
  })
})

describe('volunteer availability', () => {
  it('accepts only the three availability states', () => {
    expect(updateAvailabilitySchema.safeParse({ availability: 'AVAILABLE' }).success).toBe(true)
    expect(updateAvailabilitySchema.safeParse({ availability: 'BUSY' }).success).toBe(true)
    expect(updateAvailabilitySchema.safeParse({ availability: 'OFFLINE' }).success).toBe(true)
    expect(updateAvailabilitySchema.safeParse({ availability: 'ON_FIRE' }).success).toBe(false)
  })
})

describe('location validator', () => {
  it('accepts a valid GPS report', () => {
    expect(
      submitLocationSchema.safeParse({
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        speed: 25.5,
        heading: 90,
        timestamp: '2026-08-10T12:00:00Z',
      }).success,
    ).toBe(true)
  })

  it('rejects out-of-range coordinates and heading', () => {
    expect(submitLocationSchema.safeParse({ latitude: 91, longitude: 0 }).success).toBe(false)
    expect(submitLocationSchema.safeParse({ latitude: 0, longitude: 181 }).success).toBe(false)
    expect(submitLocationSchema.safeParse({ latitude: 0, longitude: 0, heading: 361 }).success).toBe(false)
    expect(submitLocationSchema.safeParse({ latitude: 0, longitude: 0, speed: -1 }).success).toBe(false)
  })

  it('rejects a non-datetime timestamp', () => {
    expect(submitLocationSchema.safeParse({ latitude: 0, longitude: 0, timestamp: 'soon' }).success).toBe(false)
  })
})

describe('NGO validators', () => {
  it('parses nearby-search query strings and defaults distance/status', () => {
    const result = nearbyDonationsQuerySchema.safeParse({ lat: '12.97', lng: '77.59' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lat).toBe(12.97)
      expect(result.data.lng).toBe(77.59)
      expect(result.data.distance).toBe(25)
      expect(result.data.status).toBe('AVAILABLE')
    }
  })

  it('rejects missing coordinates and an excessive radius', () => {
    expect(nearbyDonationsQuerySchema.safeParse({ lng: '77.5' }).success).toBe(false)
    expect(nearbyDonationsQuerySchema.safeParse({ lat: '12', lng: '77', distance: '501' }).success).toBe(false)
  })

  it('accepts a claim request with a donation id', () => {
    expect(createNgoRequestSchema.safeParse({ donationId: 'don-1' }).success).toBe(true)
    expect(createNgoRequestSchema.safeParse({}).success).toBe(false)
  })
})

describe('admin validators', () => {
  it('listUsersQuerySchema — pagination defaults, role/status enums', () => {
    const result = listUsersQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(10)
    }
    expect(listUsersQuerySchema.safeParse({ role: 'JANITOR' }).success).toBe(false)
    expect(listUsersQuerySchema.safeParse({ status: 'BANNED' }).success).toBe(false)
    expect(listUsersQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
  })

  it('updateUserStatusSchema — only ACTIVE | SUSPENDED', () => {
    expect(updateUserStatusSchema.safeParse({ status: 'SUSPENDED' }).success).toBe(true)
    expect(updateUserStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true)
    expect(updateUserStatusSchema.safeParse({ status: 'PENDING' }).success).toBe(false)
  })

  it('updateUserRoleSchema — ADMIN is not assignable', () => {
    expect(updateUserRoleSchema.safeParse({ role: 'NGO' }).success).toBe(true)
    expect(updateUserRoleSchema.safeParse({ role: 'ADMIN' }).success).toBe(false)
  })

  it('listNgosQuerySchema — verification enum', () => {
    expect(listNgosQuerySchema.safeParse({ verification: 'PENDING' }).success).toBe(true)
    expect(listNgosQuerySchema.safeParse({ verification: 'MAYBE' }).success).toBe(false)
  })

  it('rejectNgoSchema — optional bounded reason', () => {
    expect(rejectNgoSchema.safeParse({}).success).toBe(true)
    expect(rejectNgoSchema.safeParse({ reason: 'Missing registration docs' }).success).toBe(true)
    expect(rejectNgoSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false)
  })

  it('listAdminDonationsQuerySchema — status enum + priority bounds', () => {
    expect(listAdminDonationsQuerySchema.safeParse({ status: 'EXPIRED' }).success).toBe(true)
    expect(listAdminDonationsQuerySchema.safeParse({ status: 'FROZEN' }).success).toBe(false)
    expect(listAdminDonationsQuerySchema.safeParse({ priority: '0' }).success).toBe(false)
    expect(listAdminDonationsQuerySchema.safeParse({ priority: '4' }).success).toBe(true)
  })

  it('listAdminDeliveriesQuerySchema — status enum + active flag', () => {
    expect(listAdminDeliveriesQuerySchema.safeParse({ active: 'true' }).success).toBe(true)
    expect(listAdminDeliveriesQuerySchema.safeParse({ status: 'IN_TRANSIT' }).success).toBe(true)
    expect(listAdminDeliveriesQuerySchema.safeParse({ active: 'yes' }).success).toBe(false)
  })

  it('reportsQuerySchema — preset ranges and custom required dates', () => {
    const result = reportsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.range).toBe('monthly')

    expect(reportsQuerySchema.safeParse({ range: 'weekly' }).success).toBe(true)
    expect(reportsQuerySchema.safeParse({ range: 'custom' }).success).toBe(true) // dates validated downstream
    expect(reportsQuerySchema.safeParse({ range: 'decade' }).success).toBe(false)
  })
})
