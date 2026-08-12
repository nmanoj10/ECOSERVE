/**
 * Demo users — idempotent setup for exactly 3 accounts (donor / NGO /
 * volunteer). Ensures each one:
 *
 *   1. exists in Supabase Auth, email-confirmed (no emails sent)
 *   2. can log in with the shared demo password
 *   3. has a platform `users` row + role profile (registered through the real
 *      backend /auth/register so validation runs, not a direct DB insert)
 *
 * Safe to re-run: existing accounts are updated (password reset), never
 * duplicated. Fixes broken passwords and missing profiles in place.
 *
 * NOTE: resetting the password invalidates existing GoTrue refresh tokens,
 * so any browser sessions signed in at re-run time will be logged out.
 *
 * Usage (from backend/):  npx tsx scripts/setup-demo-users.ts
 */
import 'dotenv/config'

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3001/api/v1'
const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
const SECRET = process.env.SUPABASE_SECRET_KEY ?? ''

if (!SUPABASE_URL || !PUBLISHABLE || !SECRET) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY in backend/.env')
  process.exit(1)
}

const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demopass123!'

const demoUsers = {
  donor: {
    email: 'donor@gmail.com',
    name: 'Demo Donor',
    profile: {
      organizationName: 'Rameshwaram',
      organizationType: 'Restaurant',
      address: 'Tenkamijar, Moodbidri',
      city: 'Moodbidri',
      state: 'Karnataka',
      latitude: 13.02351,
      longitude: 74.967774,
    },
  },
  ngo: {
    email: 'ngo@gmail.com',
    name: 'Demo NGO',
    profile: {
      ngoName: 'Punith Rajkumar',
      registrationNumber: '100',
      address: 'Mijar, Mangalore',
      city: 'Mangalore',
      state: 'Karnataka',
      latitude: 13.0722,
      longitude: 74.9961,
    },
  },
  volunteer: {
    email: 'volunteer@gmail.com',
    name: 'Demo Volunteer',
    profile: {
      vehicleType: 'bike',
      vehicleNumber: 'KA-19-DEMO-01',
      availability: 'AVAILABLE',
      currentLatitude: 13.02351,
      currentLongitude: 74.967774,
    },
  },
} as const

let failures = 0
function log(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

async function adminCreateOrConfirm(email: string, password: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (res.ok) return
  const body = (await res.json().catch(() => null)) as { msg?: string } | null
  // 4xx = already registered — the account exists; confirm it below.
  if (res.status >= 400 && res.status < 500) return
  throw new Error(`adminCreateUser failed (${res.status}): ${body?.msg ?? 'unknown error'}`)
}

async function findAuthUser(email: string): Promise<{ id?: string; email_confirmed_at?: string | null } | null> {
  // NOTE: the Admin API `?email=` filter is unreliable (it can return the
  // whole list) — so fetch all users and exact-match the email ourselves.
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  })
  const listData = (await listRes.json().catch(() => null)) as { users?: Array<{ id?: string; email?: string; email_confirmed_at?: string | null }> } | null
  return listData?.users?.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase()) ?? null
}

async function adminResetPassword(email: string, password: string): Promise<boolean> {
  const authUser = await findAuthUser(email)
  if (!authUser?.id) return false
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, {
    method: 'PUT',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, email_confirm: true }),
  })
  return res.ok
}

async function passwordLogin(email: string): Promise<{ ok: boolean; token?: string; msg?: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { msg?: string } | null
    return { ok: false, msg: body?.msg ?? 'unknown error' }
  }
  const json = (await res.json()) as { access_token: string }
  return { ok: true, token: json.access_token }
}

async function registerProfile(role: string, user: (typeof demoUsers)[keyof typeof demoUsers], token: string): Promise<{ status: number }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: user.name,
      role: role.toUpperCase(),
      phone: '9999999999',
      [role]: user.profile,
    }),
  })
  if (res.status !== 201 && res.status !== 200) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(`register ${role} failed (${res.status}): ${body?.error?.message ?? JSON.stringify(body)}`)
  }
  return { status: res.status }
}

async function main(): Promise<void> {
  console.log(`Demo password: ${PASSWORD}\n`)

  for (const [role, user] of Object.entries(demoUsers)) {
    console.log(`── ${role.toUpperCase()} (${user.email}) ──`)
    await adminCreateOrConfirm(user.email, PASSWORD)
    const authUser = await findAuthUser(user.email)
    log('Supabase auth user exists + confirmed', Boolean(authUser?.email_confirmed_at))

    const reset = await adminResetPassword(user.email, PASSWORD)
    log('password reset to demo password', reset)

    const login = await passwordLogin(user.email)
    log('password login works', login.ok, login.ok ? '' : login.msg)

    if (login.token) {
      try {
        const { status } = await registerProfile(role, user, login.token)
        log('platform row + role profile registered (via /auth/register)', true, status === 201 ? 'created' : 'already registered')
      } catch (err) {
        log('platform row + role profile registered', false, (err as Error).message)
      }
    }
  }

  console.log(`\n== Result: ${failures === 0 ? 'ALL DEMO USERS READY ✅' : `${failures} FAILURE(S) ❌`} ==`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('❌ Setup failed:', err)
  process.exit(1)
})
