/**
 * Phase 38, Step 99 — API helpers for the E2E journey.
 *
 * The Supabase project has email confirmation enabled, so test users are
 * created through the Admin API (service-role key) with confirmed emails —
 * the standard E2E workaround for a platform-level setting. Their role
 * profiles are then registered through the backend's real /auth/register
 * endpoint (idempotent), with coordinates so the NGO nearby search works.
 */
import { deflateSync } from 'node:zlib'
import type { APIRequestContext } from '@playwright/test'

import { env, TEST_COORDS } from './env'

export interface TestUser {
  email: string
  password: string
  accessToken: string
  refreshToken: string
}

/**
 * Creates a confirmed Supabase auth user via the Admin API.
 * Idempotent: a 4xx "already registered" for the same email is treated as
 * success (the user exists and is confirmed), so retried runs stay safe.
 */
export async function adminCreateUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const res = await request.post(`${env.supabaseUrl}/auth/v1/admin/users`, {
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
    data: { email, password, email_confirm: true },
  })
  if (res.ok()) return
  const body = (await res.json().catch(() => null)) as { msg?: string } | null
  // 4xx = already registered (duplicate email) — the user is there, keep going.
  if (res.status() >= 400 && res.status() < 500) return
  throw new Error(`adminCreateUser failed (${res.status()}): ${body?.msg ?? 'unknown error'}`)
}

/** Password-grant login (the same GoTrue flow the frontend LoginPage uses). */
export async function passwordLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<TestUser> {
  const res = await request.post(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: env.publishableKey },
    data: { email, password },
  })
  if (!res.ok()) {
    const body = (await res.json().catch(() => null)) as { msg?: string } | null
    throw new Error(`passwordLogin failed (${res.status()}): ${body?.msg ?? 'unknown error'}`)
  }
  const json = (await res.json()) as {
    access_token: string
    refresh_token: string
  }
  return { email, password, accessToken: json.access_token, refreshToken: json.refresh_token }
}

/** Registers the role profile through the backend's /auth/register (idempotent). */
export async function registerProfile(
  request: APIRequestContext,
  user: TestUser,
  role: 'DONOR' | 'NGO' | 'VOLUNTEER',
  name: string,
): Promise<void> {
  const profiles: Record<string, unknown> = {
    DONOR: {
      organizationName: `${name} Kitchen`,
      organizationType: 'Restaurant',
      address: '12 MG Road, Bengaluru',
      city: 'Bengaluru',
      state: 'Karnataka',
      ...TEST_COORDS.donor,
    },
    NGO: {
      ngoName: `${name} Trust`,
      registrationNumber: `NG-E2E-${Date.now()}`,
      address: '45 Indiranagar, Bengaluru',
      city: 'Bengaluru',
      state: 'Karnataka',
      ...TEST_COORDS.ngo,
    },
    VOLUNTEER: {
      vehicleType: 'bike',
      // Starts OFFLINE so the availability toggle in the UI is a real action.
      availability: 'OFFLINE',
      ...TEST_COORDS.volunteer,
    },
  }

  const res = await request.post(`${env.apiBase}/auth/register`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data: {
      fullName: name,
      role,
      phone: '9999999999',
      [role === 'DONOR' ? 'donor' : role === 'NGO' ? 'ngo' : 'volunteer']: profiles[role],
    },
  })
  if (!res.ok()) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(`registerProfile failed (${res.status()}): ${body?.error?.message ?? 'unknown error'}`)
  }
}

/** Authenticated backend call helper (Bearer token attached). */
export async function apiCall(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  user: TestUser,
  data?: unknown,
) {
  const res = await request[method](`${env.apiBase}${path}`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data,
  })
  return res
}

// ── Test image ──────────────────────────────────────────────────────────────

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

/**
 * A real 128×128 RGB PNG (solid colour) — large enough to pass the AI
 * service's ≥100×100 pixel check so the food-classifier enrichment runs.
 */
export function makeTestPng(width = 128, height = 128): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour RGB
  // compression=0, filter=0, interlace=0 (already zeroed)

  // One filter byte (0) per scanline + width*3 RGB bytes.
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3)
    raw[rowStart] = 0
    for (let x = 0; x < width; x++) {
      const i = rowStart + 1 + x * 3
      raw[i] = 0x16 // teal-ish, food-adjacent colour
      raw[i + 1] = 0xa3
      raw[i + 2] = 0x4a
    }
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
