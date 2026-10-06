/**
 * Demo flow — drives the complete food-rescue journey with the 3 demo users
 * through the real backend API:
 *
 *   donor@gmail.com     lists a donation  (POST /donations)
 *   ngo@gmail.com       claims it          (POST /ngo/requests)     → RESERVED
 *   volunteer@gmail.com accepts delivery   (POST /assignments)      → delivery VOLUNTEER_ASSIGNED
 *   volunteer@gmail.com picks up + starts  (POST /deliveries/:id/start) → IN_TRANSIT / PICKED_UP
 *   volunteer@gmail.com submits GPS sample (POST /deliveries/:id/location)
 *   volunteer@gmail.com completes          (POST /deliveries/:id/complete) → DELIVERED
 *
 * Every step asserts the expected response + status transition and reports a
 * PASS/FAIL verdict at the end. Idempotent enough to re-run: each run lists a
 * fresh donation. Requires backend :3001 running and demo users set up
 * (scripts/setup-demo-users.ts).
 *
 * Usage (from backend/):  npx tsx scripts/demo-flow-drive.ts
 */
/// <reference types="node" />
import 'dotenv/config'

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3001/api/v1'
const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''

if (!SUPABASE_URL || !PUBLISHABLE) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY in backend/.env')
  process.exit(1)
}

const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demopass123!'
/** Moodbidri — the demo donor's registered location. */
const COORDS = { latitude: 13.02351, longitude: 74.967774 }

let failures = 0
function step(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

async function passwordLogin(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { msg?: string } | null
    throw new Error(`login ${email} failed (${res.status}): ${body?.msg ?? 'unknown'}`)
  }
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

async function api(
  method: 'get' | 'post' | 'patch',
  path: string,
  token: string,
  data?: unknown,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  return { status: res.status, body }
}

async function main(): Promise<void> {
  console.log('→ signing in the 3 demo users')
  const donorToken = await passwordLogin('donor@gmail.com')
  const ngoToken = await passwordLogin('ngo@gmail.com')
  const volunteerToken = await passwordLogin('volunteer@gmail.com')
  console.log('  ✅ donor, NGO, volunteer signed in\n')

  // ── 1. Volunteer available ────────────────────────────────────────────────
  console.log('1) volunteer sets availability → AVAILABLE')
  const avail = await api('patch', '/volunteer/availability', volunteerToken, { availability: 'AVAILABLE' })
  step('PATCH /volunteer/availability → 200', avail.status === 200, `HTTP ${avail.status}`)

  // ── 2. Donor lists a donation ─────────────────────────────────────────────
  console.log('\n2) donor lists a donation')
  const now = Date.now()
  const toIso = (ms: number) => new Date(ms).toISOString()
  const created = await api(
    'post',
    '/donations',
    donorToken,
    {
      foodName: 'Demo Lunch Biryani',
      category: 'Rice',
      quantity: 15,
      unit: 'kg',
      expiryTime: toIso(now + 5 * 3_600_000),
      pickupTime: toIso(now + 2 * 3_600_000),
      pickupAddress: 'Tenkamijar, Moodbidri',
      latitude: COORDS.latitude,
      longitude: COORDS.longitude,
      images: [],
    },
  )
  const donationId = (created.body as { donation?: { id?: string } } | null)?.donation?.id
  step('POST /donations → 201 with id', created.status === 201 && Boolean(donationId), `HTTP ${created.status}`)
  if (!donationId) {
    console.error('\n❌ Donation create failed — aborting flow. See step 2 above.')
    process.exit(1)
  }

  // ── 3. NGO claims it ──────────────────────────────────────────────────────
  console.log('\n3) NGO claims the donation')
  const claimed = await api('post', '/ngo/requests', ngoToken, { donationId })
  step('POST /ngo/requests → 201 (ACCEPTED)', claimed.status === 201, `HTTP ${claimed.status}`)

  const afterClaim = await api('get', `/donations/${donationId}`, donorToken)
  const claimStatus = (afterClaim.body as { donation?: { status?: string } } | null)?.donation?.status
  step('donation status → RESERVED', claimStatus === 'RESERVED', claimStatus ?? '(none)')

  // ── 4. Volunteer accepts ──────────────────────────────────────────────────
  console.log('\n4) volunteer accepts the delivery')
  const accepted = await api('post', '/assignments', volunteerToken, { donationId })
  const deliveryId = (accepted.body as { delivery?: { id?: string } } | null)?.delivery?.id
  const deliveryStatus = (accepted.body as { delivery?: { status?: string } } | null)?.delivery?.status
  step('POST /assignments → 201 with delivery', accepted.status === 201 && Boolean(deliveryId), `HTTP ${accepted.status}`)
  step('delivery status → VOLUNTEER_ASSIGNED', deliveryStatus === 'VOLUNTEER_ASSIGNED', deliveryStatus ?? '(none)')

  // ── 5. Volunteer picks up + starts transit ────────────────────────────────
  console.log('\n5) volunteer picks up and starts transit')
  const started = await api('post', `/deliveries/${deliveryId}/start`, volunteerToken)
  const startedBody = started.body as { delivery?: { status?: string }; donation?: { status?: string } } | null
  step('POST /deliveries/:id/start → 200', started.status === 200, `HTTP ${started.status}`)
  step('delivery status → IN_TRANSIT', startedBody?.delivery?.status === 'IN_TRANSIT', startedBody?.delivery?.status ?? '(none)')
  step('donation status → PICKED_UP', startedBody?.donation?.status === 'PICKED_UP', startedBody?.donation?.status ?? '(none)')

  // ── 6. GPS tracking sample ────────────────────────────────────────────────
  console.log('\n6) volunteer submits a GPS sample')
  const gps = await api('post', `/deliveries/${deliveryId}/location`, volunteerToken, {
    latitude: 13.05,
    longitude: 74.98,
    accuracy: 12,
    speed: 18,
    timestamp: new Date().toISOString(),
  })
  step('POST /deliveries/:id/location → 201', gps.status === 201, `HTTP ${gps.status}`)

  // ── 7. Volunteer completes the delivery ───────────────────────────────────
  console.log('\n7) volunteer completes the delivery')
  const completed = await api('post', `/deliveries/${deliveryId}/complete`, volunteerToken)
  const completedBody = completed.body as { delivery?: { status?: string }; donation?: { status?: string } } | null
  step('POST /deliveries/:id/complete → 200', completed.status === 200, `HTTP ${completed.status}`)
  step('delivery status → DELIVERED', completedBody?.delivery?.status === 'DELIVERED', completedBody?.delivery?.status ?? '(none)')
  step('donation status → DELIVERED', completedBody?.donation?.status === 'DELIVERED', completedBody?.donation?.status ?? '(none)')

  // ── 8. Final state ────────────────────────────────────────────────────────
  console.log('\n8) final state')
  const tracking = await api('get', '/deliveries/tracking', volunteerToken)
  const active = (tracking.body as { deliveries?: unknown[] } | null)?.deliveries ?? []
  step('volunteer has no active deliveries (freed up)', tracking.status === 200 && active.length === 0, `${active.length} active`)

  const detail = await api('get', `/donations/${donationId}`, donorToken)
  const finalDonation = detail.body as { donation?: { status?: string; foodName?: string; quantity?: number; unit?: string } } | null
  step('donation final status → DELIVERED', finalDonation?.donation?.status === 'DELIVERED', finalDonation?.donation?.status ?? '(none)')

  console.log('\n═══════════════════════════════════════════')
  console.log(` donationId ${donationId}`)
  console.log(` food: ${finalDonation?.donation?.foodName} (${finalDonation?.donation?.quantity} ${finalDonation?.donation?.unit})`)
  console.log(` journey: AVAILABLE → RESERVED → PICKED_UP → DELIVERED`)
  console.log(` result: ${failures === 0 ? 'FULL DEMO FLOW PASS ✅' : `${failures} FAILURE(S) ❌`}`)
  console.log('═══════════════════════════════════════════')
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('❌ Flow failed:', (err as Error).message)
  process.exit(1)
})
