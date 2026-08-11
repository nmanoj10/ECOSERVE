/**
 * Phase 46 — verify the donation-with-photo flow end to end:
 *
 *   Supabase donor → backend /uploads/imagekit-auth → client-style ImageKit
 *   upload → POST /donations (image metadata) → backend calls the FastAPI
 *   ai-service /predict-url → AI prediction persisted on the donation.
 *
 * Also calls the ai-service /predict-url directly with the same image URL.
 *
 * Prerequisites: backend :3001 running, ai-service running on :8000, and
 * IMAGEKIT_* keys configured in backend/.env.
 *
 * Usage (from backend/):  npx tsx scripts/verify-ai-donation.ts
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3001/api/v1'
const AI_URL = (process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
const SECRET = process.env.SUPABASE_SECRET_KEY ?? ''
const IMAGEKIT_PUBLIC = process.env.IMAGEKIT_PUBLIC_KEY ?? ''

const aiDir = fileURLToPath(new URL('../../ai-service/', import.meta.url))
const TEST_IMAGE = resolve(aiDir, 'test_image.jpg')

if (!SUPABASE_URL || !PUBLISHABLE || !SECRET || !IMAGEKIT_PUBLIC) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY / IMAGEKIT_PUBLIC_KEY in backend/.env')
  process.exit(1)
}

const PASSWORD = 'LiveTrack123!'
const suffix = Date.now()
const DONOR_EMAIL = `live.ai.${suffix}@gmail.com`
const COORDS = { latitude: 12.9716, longitude: 77.5946 }

async function jsonFetch(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, init)
  const body = (await res.json().catch(() => null)) as unknown
  return { status: res.status, body }
}

async function main(): Promise<void> {
  // ── 1. Donor via Supabase Admin API + backend /auth/register ───────────
  console.log('→ creating confirmed donor in Supabase + registering profile')
  await jsonFetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DONOR_EMAIL, password: PASSWORD, email_confirm: true }),
  })
  const loginRes = await jsonFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DONOR_EMAIL, password: PASSWORD }),
  })
  const token = (loginRes.body as { access_token: string }).access_token

  const regRes = await jsonFetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: `AI Verify Donor ${suffix % 100000}`,
      role: 'DONOR',
      phone: '9999999999',
      donor: {
        organizationName: 'AI Verify Kitchen',
        organizationType: 'Restaurant',
        address: '12 MG Road, Bengaluru',
        city: 'Bengaluru',
        state: 'Karnataka',
        ...COORDS,
      },
    }),
  })
  if (regRes.status !== 201) {
    throw new Error(`register failed (${regRes.status}): ${JSON.stringify(regRes.body)}`)
  }
  console.log(`  ✓ donor ${DONOR_EMAIL}`)

  // ── 2. Signed ImageKit upload (client-style, folder 'donations') ───────
  console.log('→ backend /uploads/imagekit-auth → direct ImageKit upload')
  const authRes = await jsonFetch(`${API_BASE}/uploads/imagekit-auth`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const auth = authRes.body as { configured: boolean; token: string; expire: number; signature: string }
  if (!auth.configured) throw new Error(`imagekit-auth not configured: ${JSON.stringify(auth)}`)

  const fileBuf = readFileSync(TEST_IMAGE)
  const form = new FormData()
  form.append('file', new Blob([fileBuf], { type: 'image/jpeg' }), 'test_image.jpg')
  form.append('fileName', 'test_image.jpg')
  form.append('folder', 'donations')
  form.append('useUniqueFileName', 'true')
  form.append('publicKey', IMAGEKIT_PUBLIC)
  form.append('token', auth.token)
  form.append('expire', String(auth.expire))
  form.append('signature', auth.signature)

  const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: form })
  if (!uploadRes.ok) {
    throw new Error(`ImageKit upload failed (${uploadRes.status}): ${await uploadRes.text().catch(() => '')}`)
  }
  const upload = (await uploadRes.json()) as { url: string; fileId: string; name: string; size: number; fileType: string }
  console.log(`  ✓ uploaded → ${upload.url}`)

  // ── 3. Create the donation with the image (backend triggers AI) ─────────
  console.log('→ creating donation with photo (backend calls ai-service /predict-url)')
  const now = Date.now()
  const toIso = (ms: number) => new Date(ms).toISOString()
  const donationRes = await jsonFetch(`${API_BASE}/donations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      foodName: `AI Verified Biryani ${suffix % 100000}`,
      category: 'Rice',
      quantity: 10,
      unit: 'kg',
      expiryTime: toIso(now + 5 * 3_600_000),
      pickupTime: toIso(now + 2 * 3_600_000),
      pickupAddress: '12 MG Road, Bengaluru',
      latitude: COORDS.latitude,
      longitude: COORDS.longitude,
      images: [{ url: upload.url, fileName: upload.name, fileSize: upload.size, mimeType: 'image/jpeg' }],
    }),
  })
  if (donationRes.status !== 201) {
    throw new Error(`donation create failed (${donationRes.status}): ${JSON.stringify(donationRes.body)}`)
  }
  const donationId = (donationRes.body as { donation: { id: string } }).donation.id
  console.log(`  ✓ donation ${donationId} created`)

  // ── 4. Verify the persisted AI prediction ───────────────────────────────
  console.log('→ GET /donations/:id — AI prediction persisted?')
  const detailRes = await jsonFetch(`${API_BASE}/donations/${donationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const detail = (detailRes.body as { donation: Record<string, unknown> }).donation
  const prediction = (detail.predictions as Array<Record<string, unknown>>)[0]
  const imageUrl = (detail.images as Array<{ imageUrl: string }>)[0]?.imageUrl
  console.log(`  image stored: ${imageUrl}`)
  console.log(`  prediction: ${JSON.stringify(prediction, null, 2)}`)

  // ── 5. Direct /predict-url call against the same image ─────────────────
  console.log('→ direct ai-service POST /predict-url')
  const aiRes = await jsonFetch(`${AI_URL}/predict-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  })
  console.log(`  ai-service response (${aiRes.status}): ${JSON.stringify(aiRes.body)}`)

  // ── Verdict ─────────────────────────────────────────────────────────────
  const foodClass = prediction?.foodClass as string | null
  const model = prediction?.foodClassifierModel as string | null
  const freshness = prediction?.freshnessScore as number | undefined
  const enriched = typeof foodClass === 'string' && foodClass.length > 0 && foodClass !== 'Unknown'
  console.log('\n══════════════ AI DONATION FLOW RESULT ══════════════')
  console.log(`donor email: ${DONOR_EMAIL}`)
  console.log(`image uploaded to ImageKit: ${upload.url}`)
  console.log(`prediction persisted: ${foodClass ?? '(none)'} (model ${model ?? 'n/a'}, freshness ${freshness ?? 'n/a'})`)
  console.log(enriched ? '✅ PASS — AI dish enrichment ran and persisted' : '⚠️ AI enrichment absent or "Unknown" — see prediction above')
  console.log('═════════════════════════════════════════════════════')
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
