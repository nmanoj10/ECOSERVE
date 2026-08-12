/* Verification for the 3 demo users (donor / NGO / volunteer) — asserts every
 * condition the demo depends on: Supabase auth confirmed, password login,
 * platform row, correct role, ACTIVE status, and a complete role profile.
 * Companion to scripts/setup-demo-users.ts. */
import 'dotenv/config'

import { prisma } from '../src/config/prisma.js'

const DEMO_USERS = [
  { email: 'donor@gmail.com', expectedRole: 'DONOR' },
  { email: 'ngo@gmail.com', expectedRole: 'NGO' },
  { email: 'volunteer@gmail.com', expectedRole: 'VOLUNTEER' },
] as const
const PASSWORD = 'Demopass123!'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
const SECRET = process.env.SUPABASE_SECRET_KEY ?? ''

let failures = 0
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

async function supabaseUser(email: string): Promise<{ id?: string; email_confirmed_at?: string | null } | null> {
  // The Admin API `?email=` filter is unreliable — fetch all and exact-match.
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  })
  const body = (await res.json().catch(() => null)) as { users?: Array<{ id?: string; email?: string; email_confirmed_at?: string | null }> } | null
  return body?.users?.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase()) ?? null
}

async function passwordLogin(email: string): Promise<{ ok: boolean; status?: number; msg?: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (res.ok) return { ok: true }
  const body = (await res.json().catch(() => null)) as { msg?: string; error_description?: string } | null
  return { ok: false, status: res.status, msg: body?.msg ?? body?.error_description ?? 'unknown' }
}

/** Profile completeness per role — every field the matching/booking flows need. */
function checkProfile(email: string, user: { role: string; donor?: unknown; ngo?: unknown; volunteer?: unknown }): void {
  if (user.role === 'DONOR') {
    const p = user.donor as { organizationName?: string; city?: string; state?: string; latitude?: number | null; longitude?: number | null } | null
    check(`${email} — donor org name`, Boolean(p?.organizationName))
    check(`${email} — donor city + state`, Boolean(p?.city && p?.state))
    check(`${email} — donor coordinates`, typeof p?.latitude === 'number' && typeof p?.longitude === 'number')
  } else if (user.role === 'NGO') {
    const p = user.ngo as { ngoName?: string; registrationNumber?: string; city?: string; latitude?: number | null; longitude?: number | null } | null
    check(`${email} — NGO name`, Boolean(p?.ngoName))
    check(`${email} — NGO registration number`, Boolean(p?.registrationNumber))
    check(`${email} — NGO coordinates`, typeof p?.latitude === 'number' && typeof p?.longitude === 'number')
  } else if (user.role === 'VOLUNTEER') {
    const p = user.volunteer as { availability?: string; currentLatitude?: number | null; currentLongitude?: number | null } | null
    check(`${email} — volunteer availability AVAILABLE`, p?.availability === 'AVAILABLE', p?.availability ?? '(unset)')
    check(`${email} — volunteer live coordinates`, typeof p?.currentLatitude === 'number' && typeof p?.currentLongitude === 'number')
  }
}

console.log('== Demo users: Supabase auth + login ==')
for (const { email } of DEMO_USERS) {
  const auth = await supabaseUser(email)
  check(`${email} — Supabase auth user exists`, Boolean(auth?.id))
  check(`${email} — email confirmed`, Boolean(auth?.email_confirmed_at))
  const login = await passwordLogin(email)
  check(`${email} — password login (${PASSWORD})`, login.ok, login.ok ? '' : `HTTP ${login.status}: ${login.msg}`)
}

console.log('\n== Demo users: platform rows + profiles ==')
const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, include: { donor: true, ngo: true, volunteer: true } })
for (const { email, expectedRole } of DEMO_USERS) {
  const u = users.find((x) => x.email.toLowerCase() === email)
  check(`${email} — platform row`, Boolean(u))
  if (!u) continue
  check(`${email} — status ACTIVE`, u.status === 'ACTIVE', u.status)
  check(`${email} — role is ${expectedRole}`, u.role === expectedRole, u.role)
  check(`${email} — ${u.role} profile exists`, Boolean(u.donor || u.ngo || u.volunteer))
  checkProfile(email, u)
}

console.log(`\n== Result: ${failures === 0 ? 'ALL CONDITIONS PASS' : `${failures} FAILURE(S)`} ==`)
await prisma.$disconnect()
process.exit(failures === 0 ? 0 : 1)
