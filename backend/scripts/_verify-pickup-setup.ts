/**
 * TEMPORARY verification helper — creates fresh confirmed users, drives the
 * flow up to VOLUNTEER_ASSIGNED (donor lists → NGO claims → volunteer
 * accepts), and prints the credentials + delivery id so the browser test can
 * log in and click "Start pickup" itself.
 */
import 'dotenv/config'

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3001/api/v1'
const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
const SECRET = process.env.SUPABASE_SECRET_KEY ?? ''

if (!SUPABASE_URL || !PUBLISHABLE || !SECRET) {
  console.error('❌ Missing SUPABASE keys in backend/.env')
  process.exit(1)
}

const PASSWORD = 'VerifyPickup123!'
const suffix = Date.now()
const users = {
  donor: { email: `vf.donor.${suffix}@gmail.com`, name: `VF Donor ${suffix % 100000}` },
  ngo: { email: `vf.ngo.${suffix}@gmail.com`, name: `VF NGO ${suffix % 100000}` },
  volunteer: { email: `vf.vol.${suffix}@gmail.com`, name: `VF Volunteer ${suffix % 100000}` },
} as const

/** Bengaluru: donor city centre, NGO ~5 km east, volunteer ~1.5 km north. */
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
  if (res.status >= 400 && res.status < 500) return // already registered
  throw new Error(`adminCreateUser failed (${res.status}): ${body?.msg ?? 'unknown'}`)
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login ${email} failed (${res.status})`)
  return ((await res.json()) as { access_token: string }).access_token
}

async function api(method: 'get' | 'post' | 'patch', path: string, token: string, data?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    throw new Error(`${method.toUpperCase()} ${path} failed (${res.status}): ${JSON.stringify(body)}`)
  }
  return body
}

async function main(): Promise<void> {
  const tokens = new Map<string, string>()
  for (const [role, user] of Object.entries(users)) {
    await adminCreateUser(user.email, PASSWORD)
    tokens.set(role, await login(user.email))
  }

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
      registrationNumber: `VF-${suffix}`,
      address: '45 Indiranagar, Bengaluru',
      city: 'Bengaluru',
      state: 'Karnataka',
      ...COORDS.ngo,
    },
    volunteer: { vehicleType: 'bike', availability: 'OFFLINE', ...COORDS.volunteer },
  }
  for (const [role, user] of Object.entries(users)) {
    const res = await api('post', '/auth/register', tokens.get(role)!, {
      fullName: user.name,
      role: role.toUpperCase(),
      phone: '9999999999',
      [role]: profiles[role],
    })
    if (res && (res as { user?: unknown }).user) console.log(`✓ ${role} profile registered`)
  }

  await api('patch', '/volunteer/availability', tokens.get('volunteer')!, { availability: 'AVAILABLE' })
  console.log('✓ volunteer AVAILABLE')

  const now = Date.now()
  const toIso = (ms: number) => new Date(ms).toISOString()
  const created = (await api('post', '/donations', tokens.get('donor')!, {
    foodName: `Verify Flow Biryani ${suffix % 100000}`,
    category: 'Grains',
    quantity: 10,
    unit: 'kg',
    expiryTime: toIso(now + 6 * 3_600_000),
    pickupTime: toIso(now + 2 * 3_600_000),
    pickupAddress: '12 MG Road, Bengaluru',
    latitude: COORDS.donor.latitude,
    longitude: COORDS.donor.longitude,
    images: [],
  })) as { donation: { id: string } }
  const donationId = created.donation.id
  console.log(`✓ donation listed: ${donationId}`)

  await api('post', '/ngo/requests', tokens.get('ngo')!, { donationId })
  console.log('✓ NGO claimed (donation RESERVED)')

  const assigned = (await api('post', '/assignments', tokens.get('volunteer')!, { donationId })) as {
    delivery: { id: string; status: string }
  }
  console.log(`✓ volunteer accepted → delivery ${assigned.delivery.id} (${assigned.delivery.status})`)

  console.log('\n═══════════════════════════════════════════')
  console.log(` PASSWORD=${PASSWORD}`)
  for (const [role, user] of Object.entries(users)) console.log(` ${role.padEnd(9)} ${user.email}`)
  console.log(` deliveryId ${assigned.delivery.id}`)
  console.log('═══════════════════════════════════════════')
}

main().catch((err) => {
  console.error('❌', (err as Error).message)
  process.exit(1)
})
