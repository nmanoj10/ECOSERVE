/**
 * Step 116 — Live-tracking verification (three windows).
 *
 * Standalone script (not part of the test runner). Prerequisites:
 *   - backend :3001 and frontend :5173 running
 *   - a delivery in IN_TRANSIT (see backend/scripts/setup-live-tracking.ts)
 *
 * Windows:
 *   Window 1 (volunteer) — real geolocation override via CDP; the browser's
 *     watchPosition drives useDeliveryTracking → socket 'delivery:gps'.
 *   Window 2 (NGO)       — observes the blue live marker on LiveTrackingMap.
 *   Window 3 (donor)     — observes the same on its "Live deliveries" map.
 *
 * Run from frontend/:  node e2e/live-tracking-check.mjs
 */
import { chromium } from '@playwright/test'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = 'http://localhost:5173'
const PASSWORD = 'LiveTrack123!'
const EMAILS = {
  volunteer: 'live.volunteer.1786468869950@gmail.com',
  ngo: 'live.ngo.1786468869950@gmail.com',
  donor: 'live.donor.1786468869950@gmail.com',
}
const FOOD = 'Live Tracking Biryani 69950'
const START = { latitude: 12.9833, longitude: 77.5811 }
const MOVES = [
  { latitude: 12.99, longitude: 77.6 },
  { latitude: 12.96, longitude: 77.62 },
  { latitude: 12.9352, longitude: 77.6245 }, // at the NGO
  { latitude: 12.94, longitude: 77.63 },
  { latitude: 12.95, longitude: 77.615 },
  { latitude: 12.955, longitude: 77.605 },
]

async function login(page, email) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: /log ?in/i }).click()
}

const markerJs = `(() => {
  const icons = [...document.querySelectorAll('div.leaflet-marker-icon')]
  const live = icons.find((el) => el.querySelector('span.animate-ping'))
  return live ? live.style.transform : null
})()`

async function watchMarker(page, label, cardTitle) {
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  const card = page.getByText(cardTitle, { exact: false }).first()
  try {
    await card.waitFor({ timeout: 90_000 })
    console.log(`[${label}] card "${cardTitle}" visible`)
  } catch {
    console.log(`[${label}] ⚠ card "${cardTitle}" NOT found within 90s`)
  }

  const seen = []
  const deadline = Date.now() + 4.5 * 60_000
  while (Date.now() < deadline && seen.length < 5) {
    const t = await page.evaluate(markerJs)
    if (t && !seen.includes(t)) {
      seen.push(t)
      console.log(`[${label}] marker transform ${seen.length}: ${t}`)
    }
    await sleep(2500)
  }
  return { label, seen, errors, foodVisible: await page.getByText(FOOD, { exact: false }).first().isVisible().catch(() => false) }
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
const consoleErrors = []

try {
  // ── Window 1: volunteer (drives the location) ──────────────────────────
  const volCtx = await browser.newContext({ reducedMotion: 'reduce' })
  await volCtx.grantPermissions(['geolocation'], { origin: BASE })
  await volCtx.setGeolocation({ latitude: START.latitude, longitude: START.longitude, accuracy: 5 })
  const vol = await volCtx.newPage()
  vol.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[volunteer] ${msg.text()}`) })
  vol.on('pageerror', (err) => consoleErrors.push(`[volunteer] pageerror: ${err.message}`))

  await login(vol, EMAILS.volunteer)
  await vol.waitForURL(/\/volunteer/, { timeout: 45_000 })
  console.log('[volunteer] logged in → dashboard')
  await vol.getByText('Live tracking', { exact: true }).first().waitFor({ timeout: 45_000 })
  console.log('[volunteer] "Live tracking" badge visible (GPS watcher active)')
  await vol.getByRole('button', { name: /mark as delivered/i }).waitFor({ timeout: 30_000 })
  console.log('[volunteer] in-transit delivery confirmed (Mark as delivered button)')

  // ── Windows 2 & 3: NGO + donor observers ───────────────────────────────
  const ngoCtx = await browser.newContext({ reducedMotion: 'reduce' })
  const ngo = await ngoCtx.newPage()
  await login(ngo, EMAILS.ngo)
  await ngo.waitForURL(/\/ngo/, { timeout: 45_000 })
  console.log('[NGO] logged in → dashboard')

  const donorCtx = await browser.newContext({ reducedMotion: 'reduce' })
  const donor = await donorCtx.newPage()
  await login(donor, EMAILS.donor)
  await donor.waitForURL(/\/donor/, { timeout: 45_000 })
  console.log('[donor] logged in → dashboard')

  // ── Move the volunteer while the observers watch ───────────────────────
  const watchNgo = watchMarker(ngo, 'NGO', 'Live tracking')
  const watchDonor = watchMarker(donor, 'DONOR', 'Live deliveries')

  await sleep(5_000)
  for (const [i, move] of MOVES.entries()) {
    await volCtx.setGeolocation({ latitude: move.latitude, longitude: move.longitude, accuracy: 5 })
    console.log(`[volunteer] moved → ${move.latitude}, ${move.longitude} (${i + 1}/${MOVES.length})`)
    await sleep(18_000) // > the 10s send-throttle in useDeliveryTracking
  }

  results.push(await watchNgo)
  results.push(await watchDonor)
} finally {
  await browser.close()
}

// ── Report ────────────────────────────────────────────────────────────────
console.log('\n══════════════ LIVE TRACKING RESULT ══════════════')
let pass = true
for (const r of results) {
  const moved = r.seen.length >= 2
  if (!moved) pass = false
  console.log(`[${r.label}] marker moved: ${moved ? '✅ YES' : '❌ NO'} (${r.seen.length} distinct transforms)`)
  console.log(`[${r.label}] food name visible: ${r.foodVisible ? '✅' : '❌'}`)
  if (r.seen.length) console.log(`[${r.label}] transforms: ${r.seen.join('  |  ')}`)
  if (r.errors.length) console.log(`[${r.label}] console errors: ${r.errors.slice(0, 5).join(' ;; ')}`)
}
console.log(`[volunteer console errors] ${consoleErrors.slice(0, 5).join(' ;; ') || 'none'}`)
console.log(pass ? '✅ PASS — live tracking works in all windows' : '❌ FAIL — marker did not move in every window')
process.exit(pass ? 0 : 1)
