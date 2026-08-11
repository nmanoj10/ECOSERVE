/**
 * Step 116 — Live-tracking test setup.
 *
 * Creates three confirmed Supabase users (donor / NGO / volunteer), registers
 * their role profiles through the real backend API, lists a donation, has the
 * NGO claim it, assigns the volunteer, and starts the delivery so its status
 * is IN_TRANSIT. Prints the test credentials + delivery id so the multi-window
 * browser test can be driven manually.
 *
 * Uses the same Supabase Admin API + backend endpoints as the E2E suite
 * (frontend/e2e/support/api.ts) — email confirmation is bypassed by creating
 * users with `email_confirm: true` (no emails are sent).
 *
 * Usage (from backend/):  npx tsx scripts/setup-live-tracking.ts
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

const PASSWORD = 'LiveTrack123!'
const suffix = Date.now()

const users = {
  donor: { email: `live.donor.${suffix}@gmail.com`, password: PASSWORD, name: `Live Donor ${suffix % 100000}` },
  ngo: { email: `live.ngo.${suffix}@gmail.com`, password: PASSWORD, name: `Live NGO ${suffix % 100000}` },
  volunteer: { email: `live.volunteer.${suffix}@gmail.com`, password: PASSWORD, name: `Live Volunteer ${suffix % 100000}` },
} as const

/** Bengaluru coordinates — donor city centre, NGO ~5 km east, volunteer ~1.5 km north. */
const COORDS = {
  donor: { latitude: 12.9716, longitude: 77.5946 },
  ngo: { latitude: 12.9352, longitude: 77.6245 },
  volunteer: { latitude: 12.9833, longitude: 77.5811 },
} as const

async function adminCreateUser(email: string, password: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (res.ok) return
  const body = (await res.json().catch(() => null)) as { msg?: string } | null
  // 4xx = already registered — the user exists, keep going.
  if (res.status >= 400 && res.status < 500) return
  throw new Error(`adminCreateUser failed (${res.status}): ${body?.msg ?? 'unknown error'}`)
}

async function passwordLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { msg?: string } | null
    throw new Error(`passwordLogin failed (${res.status}): ${body?.msg ?? 'unknown error'}`)
  }
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

async function api(method: 'get' | 'post' | 'patch', path: string, token: string, data?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message ?? JSON.stringify(body)
    throw new Error(`${method.toUpperCase()} ${path} failed (${res.status}): ${message}`)
  }
  return body
}

async function main(): Promise<void> {
  console.log('→ creating confirmed Supabase users + login tokens')
  const tokens = new Map<string, string>()
  for (const [role, user] of Object.entries(users)) {
    await adminCreateUser(user.email, user.password)
    const token = await passwordLogin(user.email, user.password)
    tokens.set(role, token)
    console.log(`  ✓ ${role}: ${user.email}`)
  }

  console.log('→ registering role profiles (real /auth/register)')
  const profiles: Record<string, Record<string, unknown>> = {
    donor: {
      organizationName: `${users.donor.name} Kitchen`,
      organizationType: 'Restaurant',
      address: '12 MG Road, Bengaluru',
      city: 'Bengaluru',
      state: 'Karnataka',
      ...COORDS.donor,
    },
    ngo: {
      ngoName: `${users.ngo.name} Trust`,
      registrationNumber: `NG-LIVE-${suffix}`,
      address: '45 Indiranagar, Bengaluru',
      city: 'Bengaluru',
      state: 'Karnataka',
      ...COORDS.ngo,
    },
    volunteer: {
      vehicleType: 'bike',
      availability: 'OFFLINE',
      ...COORDS.volunteer,
    },
  }
  for (const [role, user] of Object.entries(users)) {
    await api('post', '/auth/register', tokens.get(role)!, {
      fullName: user.name,
      role: role.toUpperCase(),
      phone: '9999999999',
      [role]: profiles[role],
    })
    console.log(`  ✓ ${role} profile registered`)
  }

  console.log('→ volunteer becomes AVAILABLE')
  await api('patch', '/volunteer/availability', tokens.get('volunteer')!, { availability: 'AVAILABLE' })
  console.log('  ✓ availability = AVAILABLE')

  console.log('→ listing a donation (donor)')
  const now = Date.now()
  const toIso = (ms: number) => new Date(ms).toISOString()
  const donationRes = (await api('post', '/donations', tokens.get('donor')!, {
    foodName: `Live Tracking Biryani ${suffix % 100000}`,
    category: 'Grains',
    quantity: 12,
    unit: 'kg',
    expiryTime: toIso(now + 5 * 3_600_000),
    pickupTime: toIso(now + 2 * 3_600_000),
    pickupAddress: '12 MG Road, Bengaluru',
    latitude: COORDS.donor.latitude,
    longitude: COORDS.donor.longitude,
    images: [],
  })) as { donation: { id: string } }
  const donationId = donationRes.donation.id
  console.log(`  ✓ donation ${donationId}`)

  console.log('→ NGO claims the donation')
  await api('post', '/ngo/requests', tokens.get('ngo')!, { donationId })
  console.log('  ✓ request ACCEPTED (donation RESERVED)')

  console.log('→ volunteer accepts the delivery (assignment)')
  const assignmentRes = (await api('post', '/assignments', tokens.get('volunteer')!, { donationId })) as {
    delivery: { id: string }
  }
  const deliveryId = assignmentRes.delivery.id
  console.log(`  ✓ delivery ${deliveryId}`)

  console.log('→ volunteer picks up + starts transit')
  await api('post', `/deliveries/${deliveryId}/start`, tokens.get('volunteer')!)
  console.log('  ✓ delivery IN_TRANSIT')

  console.log('\n═══════════════════════════════════════════════════')
  console.log(' TEST CREDENTIALS (password: LiveTrack123!)')
  for (const [role, user] of Object.entries(users)) {
    console.log(`  ${role.padEnd(9)} ${user.email}`)
  }
  console.log(`  deliveryId ${deliveryId}`)
  console.log('═══════════════════════════════════════════════════')
  console.log('Next: open two/three browser windows and log in as each role.')
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
