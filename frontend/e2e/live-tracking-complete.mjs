/**
 * Step 116 — Complete the live-tracking journey.
 *
 * Standalone script. Prerequisites: backend :3001 + frontend :5173 running,
 * and a delivery currently IN_TRANSIT (see setup-live-tracking.ts).
 *
 * Opens all three windows FIRST so the NGO + donor sockets are listening when
 * the volunteer completes the delivery — the "Delivery completed" in-app
 * notification is verified arriving LIVE via Socket.IO (bell badge), then
 * dashboard + API state is checked end-to-end.
 *
 * Run from frontend/:  node e2e/live-tracking-complete.mjs
 */
import { chromium } from '@playwright/test'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = 'http://localhost:5173'
const API = 'http://localhost:3001/api/v1'
const SUPABASE_URL = 'https://chlaahfvkvrdpkzxaebw.supabase.co'
const PUBLISHABLE = 'sb_publishable_pCkxQGUm3wKCz55F12jqqA_3IutsjLf'
const PASSWORD = 'LiveTrack123!'
const EMAILS = {
  volunteer: 'live.volunteer.1786468869950@gmail.com',
  ngo: 'live.ngo.1786468869950@gmail.com',
  donor: 'live.donor.1786468869950@gmail.com',
}
const FOOD = 'Live Tracking Biryani 69950'
const DONATION_ID = 'cmsoxfxoa00040kjxyp31c3fr'
const DELIVERY_ID = 'cmsoxfzkq000b0kjx1j3g6ln1'
const NOTIF_TITLE = `Delivery completed: ${FOOD}`

async function login(page, email) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: /log ?in/i }).click()
}

async function supabaseLogin(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`supabaseLogin failed for ${email}: ${res.status}`)
  return (await res.json()).access_token
}

async function apiGet(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

/** Reads the notification bell's unread count from its aria-label. */
async function bellCount(page) {
  const label = await page.getByRole('button', { name: /notifications/i }).getAttribute('aria-label').catch(() => '')
  const m = label?.match(/\((\d+) unread\)/)
  return m ? Number(m[1]) : 0
}

/** Opens the bell dropdown and returns visible notification titles. */
async function openNotifs(page) {
  await page.getByRole('button', { name: /notifications/i }).click()
  const titles = await page.locator('button[class*="w-full rounded-lg"] p').allTextContents().catch(() => [])
  return titles
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
const consoleErrors = []

try {
  // ── Pre-check: the delivery must still be IN_TRANSIT ───────────────────
  const ngoToken = await supabaseLogin(EMAILS.ngo)
  const tracking = await apiGet('/deliveries/tracking', ngoToken)
  if (!tracking.deliveries.some((d) => d.id === DELIVERY_ID)) {
    console.log(`❌ delivery ${DELIVERY_ID} not found in /deliveries/tracking — already completed?`)
    process.exit(2)
  }
  console.log(`[pre-check] delivery ${DELIVERY_ID} is IN_TRANSIT ✓`)

  const mkPage = async (label) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${label}] ${msg.text()}`) })
    page.on('pageerror', (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`))
    return page
  }

  // ── Open all three windows (NGO + donor first, sockets listening) ──────
  const ngo = await mkPage('NGO')
  await login(ngo, EMAILS.ngo)
  await ngo.waitForURL(/\/ngo/, { timeout: 45_000 })
  const ngoBaseline = await bellCount(ngo)
  console.log(`[NGO] logged in, notification baseline = ${ngoBaseline}`)

  const donor = await mkPage('DONOR')
  await login(donor, EMAILS.donor)
  await donor.waitForURL(/\/donor/, { timeout: 45_000 })
  const donorBaseline = await bellCount(donor)
  console.log(`[DONOR] logged in, notification baseline = ${donorBaseline}`)

  const vol = await mkPage('VOLUNTEER')
  await login(vol, EMAILS.volunteer)
  await vol.waitForURL(/\/volunteer/, { timeout: 45_000 })
  await vol.getByRole('button', { name: /mark as delivered/i }).waitFor({ timeout: 45_000 })
  console.log('[VOLUNTEER] logged in, in-transit delivery visible')

  // ── Complete the delivery ───────────────────────────────────────────────
  await vol.getByRole('button', { name: /mark as delivered/i }).click()
  await vol.getByText('Delivery completed', { exact: false }).first().waitFor({ timeout: 20_000 })
  console.log('[VOLUNTEER] toast "Delivery completed" ✓')
  await vol.getByText('No active delivery').waitFor({ timeout: 20_000 })
  console.log('[VOLUNTEER] "No active delivery" empty state ✓')

  await vol.reload()
  await vol.getByText('Welcome back', { exact: false }).first().waitFor({ timeout: 30_000 })
  const volRow = vol.getByRole('row').filter({ hasText: FOOD }).first()
  await volRow.waitFor({ timeout: 30_000 })
  const rowText = await volRow.textContent()
  results.push(['VOLUNTEER recent delivery shows "Delivered"', /Delivered/i.test(rowText)])
  console.log(`[VOLUNTEER] recent deliveries row: ${rowText?.replace(/\s+/g, ' ').trim()}`)
  await vol.getByText('Meals delivered', { exact: true }).waitFor({ timeout: 30_000 })
  console.log('[VOLUNTEER] "Meals delivered" KPI visible ✓')
  const volMeals = await vol.getByText('Meals delivered', { exact: true }).locator('..').textContent()
  const volMealsNum = Number((volMeals ?? '').replace(/[^\d.]/g, ''))
  results.push(['VOLUNTEER meals delivered ≥ 1', volMealsNum >= 1])
  console.log(`[VOLUNTEER] meals delivered value: ${volMealsNum}`)

  // ── NGO: live notification + dashboard ──────────────────────────────────
  const ngoDeadline = Date.now() + 20_000
  let ngoTitles = []
  while (Date.now() < ngoDeadline) {
    ngoTitles = await openNotifs(ngo)
    if (ngoTitles.some((t) => t.includes(NOTIF_TITLE))) break
    await pageClickAway(ngo)
    await sleep(2_000)
  }
  results.push(['NGO live notification "Delivery completed" arrived', ngoTitles.some((t) => t.includes(NOTIF_TITLE))])
  console.log(`[NGO] notification titles: ${JSON.stringify(ngoTitles)}`)
  const ngoAfter = await bellCount(ngo)
  results.push(['NGO unread count increased', ngoAfter > ngoBaseline])
  console.log(`[NGO] unread ${ngoBaseline} → ${ngoAfter}`)
  await pageClickAway(ngo)

  await ngo.reload()
  await ngo.getByText('Welcome back', { exact: false }).first().waitFor({ timeout: 30_000 })
  const ngoCardGone = (await ngo.getByText('Deliveries in transit to your organization').count()) === 0
  results.push(['NGO "Live tracking" card removed', ngoCardGone])
  console.log(`[NGO] "Live tracking" card gone after reload: ${ngoCardGone}`)
  await ngo.getByText('Accepted food', { exact: true }).waitFor({ timeout: 30_000 })
  const ngoAccepted = await ngo.getByText('Accepted food', { exact: true }).locator('..').textContent()
  const ngoAcceptedNum = Number((ngoAccepted ?? '').replace(/[^\d.]/g, ''))
  results.push(['NGO accepted food ≥ 1', ngoAcceptedNum >= 1])
  console.log(`[NGO] accepted food value: ${ngoAcceptedNum}`)
  await ngo.getByText('Meals distributed', { exact: true }).waitFor({ timeout: 30_000 })
  console.log('[NGO] "Meals distributed" KPI visible ✓')

  // ── Donor: live notification + dashboard ────────────────────────────────
  const donorDeadline = Date.now() + 20_000
  let donorTitles = []
  while (Date.now() < donorDeadline) {
    donorTitles = await openNotifs(donor)
    if (donorTitles.some((t) => t.includes(NOTIF_TITLE))) break
    await pageClickAway(donor)
    await sleep(2_000)
  }
  results.push(['DONOR live notification "Delivery completed" arrived', donorTitles.some((t) => t.includes(NOTIF_TITLE))])
  console.log(`[DONOR] notification titles: ${JSON.stringify(donorTitles)}`)
  await pageClickAway(donor)

  await donor.reload()
  await donor.getByText('Welcome back', { exact: false }).first().waitFor({ timeout: 30_000 })
  const donorCardGone = (await donor.getByText('Your donations currently in transit').count()) === 0
  results.push(['DONOR "Live deliveries" card removed', donorCardGone])
  console.log(`[DONOR] "Live deliveries" card gone after reload: ${donorCardGone}`)
  const donorRow = donor.getByRole('row').filter({ hasText: FOOD }).first()
  await donorRow.waitFor({ timeout: 30_000 })
  const donorRowText = await donorRow.textContent()
  results.push(['DONOR donation row shows "Delivered"', /Delivered/i.test(donorRowText ?? '')])
  console.log(`[DONOR] donation row: ${donorRowText?.replace(/\s+/g, ' ').trim()}`)
  await donor.getByText('Food saved', { exact: false }).first().waitFor({ timeout: 30_000 })
  const donorSaved = await donor.getByText('Food saved', { exact: false }).first().locator('..').textContent()
  const donorSavedNum = Number((donorSaved ?? '').replace(/[^\d.]/g, ''))
  results.push(['DONOR food saved > 0', donorSavedNum > 0])
  console.log(`[DONOR] food saved value: ${donorSavedNum} kg`)

  // ── Backend state via API ───────────────────────────────────────────────
  const volToken = await supabaseLogin(EMAILS.volunteer)
  const donorToken = await supabaseLogin(EMAILS.donor)

  const trackingAfter = await apiGet('/deliveries/tracking', volToken)
  results.push(['tracking endpoint empty after completion', trackingAfter.deliveries.length === 0])
  console.log(`[API] deliveries/tracking (volunteer): ${trackingAfter.deliveries.length} active`)

  const donation = (await apiGet(`/donations/${DONATION_ID}`, donorToken)).donation
  results.push(['donation status = DELIVERED', donation.status === 'DELIVERED'])
  console.log(`[API] donation status: ${donation.status}`)
  const gpsSamples = donation.assignments?.[0]?.delivery?.locations?.length ?? 0
  results.push(['GPS samples persisted during tracking', gpsSamples >= 1])
  console.log(`[API] persisted GPS samples: ${gpsSamples}`)

  const ngoNotifs = await apiGet('/notifications?limit=20', ngoToken)
  const donorNotifs = await apiGet('/notifications?limit=20', donorToken)
  results.push(['NGO notifications contain "Delivery completed"', ngoNotifs.notifications.some((n) => n.title.includes(NOTIF_TITLE))])
  results.push(['DONOR notifications contain "Delivery completed"', donorNotifs.notifications.some((n) => n.title.includes(NOTIF_TITLE))])
  console.log(`[API] NGO has notification: ${ngoNotifs.notifications.some((n) => n.title.includes(NOTIF_TITLE))}, unread ${ngoNotifs.unreadCount}`)
  console.log(`[API] DONOR has notification: ${donorNotifs.notifications.some((n) => n.title.includes(NOTIF_TITLE))}, unread ${donorNotifs.unreadCount}`)

  const donorAnalytics = await apiGet('/analytics/donor', donorToken)
  const ngoAnalytics = await apiGet('/analytics/ngo', ngoToken)
  const volAnalytics = await apiGet('/analytics/volunteer', volToken)
  const checks = [
    ['donor analytics totalDonations ≥ 1', donorAnalytics.summary.totalDonations >= 1],
    ['donor analytics foodSavedKg > 0', donorAnalytics.summary.foodSavedKg > 0],
    ['NGO analytics foodReceivedKg > 0', ngoAnalytics.summary.foodReceivedKg > 0],
    ['volunteer analytics mealsDelivered ≥ 1', volAnalytics.summary.mealsDelivered >= 1],
  ]
  for (const [label, ok] of checks) results.push([label, ok])
  console.log(`[API] donor analytics: ${JSON.stringify(donorAnalytics.summary)}`)
  console.log(`[API] NGO analytics: ${JSON.stringify(ngoAnalytics.summary)}`)
  console.log(`[API] volunteer analytics: ${JSON.stringify(volAnalytics.summary)}`)
} finally {
  await browser.close()
}

// ── Report ────────────────────────────────────────────────────────────────
console.log('\n══════════════ DELIVERY COMPLETION RESULT ══════════════')
let pass = true
for (const [label, ok] of results) {
  if (!ok) pass = false
  console.log(`${ok ? '✅' : '❌'} ${label}`)
}
if (consoleErrors.length) {
  console.log('\nconsole errors (first 5):')
  for (const e of consoleErrors.slice(0, 5)) console.log(`  ${e}`)
} else {
  console.log('\nconsole errors: none')
}
console.log(pass ? '\n✅ PASS — delivery completion flow verified end-to-end' : '\n❌ FAIL — some checks did not pass')
process.exit(pass ? 0 : 1)

/** Closes an open dropdown by pressing Escape. */
async function pageClickAway(page) {
  await page.keyboard.press('Escape').catch(() => {})
}
