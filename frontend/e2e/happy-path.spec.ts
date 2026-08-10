/**
 * Phase 38, Step 99 — End-to-end happy path.
 *
 * Register → Login → Create Donation → Image Upload → AI → NGO Accept →
 * Volunteer Accept → Pickup → Live Tracking → Delivery → Impact
 *
 * The journey drives the REAL stack (frontend → backend → Supabase → ImageKit,
 * with the AI service enriching donation photos). Two notes on what goes
 * through the HTTP API instead of a button click:
 *
 *   1. Role registration — the Supabase project requires email confirmation,
 *      so users are created via the Admin API (email_confirm: true) and their
 *      profiles registered through the backend's real /auth/register with
 *      coordinates (the register UI does not collect lat/lng yet, and the
 *      nearby search depends on them).
 *   2. Volunteer assignment accept + pickup start — backend endpoints exist
 *      (validated in Step 97) but the volunteer dashboard has no buttons for
 *      them yet. The browser still verifies every resulting UI state.
 *
 * Prerequisites: backend (:3001), frontend (:5173) and the AI service (:8000)
 * running. See docs/e2e-testing.md.
 */
import { expect, test, type Browser, type Page } from '@playwright/test'

import { env, TEST_COORDS } from './support/env'
import {
  adminCreateUser,
  apiCall,
  makeTestPng,
  passwordLogin,
  registerProfile,
  type TestUser,
} from './support/api'

test.describe.configure({ mode: 'serial' })

const runId = Date.now()
const password = 'E2eTest123!'
// Unique per run so past runs' listings never collide in nearby searches.
const FOOD = `Biryani ${runId % 100000}`

let donor: TestUser
let ngo: TestUser
let volunteer: TestUser
let donationId = ''
let deliveryId = ''
// Pages persist across the serial tests (one worker) so each role logs in once.
let donorPage: Page
let ngoPage: Page
let volunteerPage: Page

const name = (role: string) => `E2E ${role} ${runId % 100000}`

/** Logs a user in through the real LoginPage and waits for their dashboard. */
async function loginAs(browser: Browser, user: TestUser, dashboardPath: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: env.frontendUrl })
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(new RegExp(dashboardPath), { timeout: 45_000 })
  return page
}

/** YYYY-MM-DDTHH:mm for the datetime-local inputs. */
function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ── 1. Register ─────────────────────────────────────────────────────────────

test('register: create confirmed test users and register role profiles', async ({ request }) => {
  test.setTimeout(120_000)

  donor = { email: `e2e.donor.${runId}@gmail.com`, password, accessToken: '', refreshToken: '' }
  ngo = { email: `e2e.ngo.${runId}@gmail.com`, password, accessToken: '', refreshToken: '' }
  volunteer = { email: `e2e.volunteer.${runId}@gmail.com`, password, accessToken: '', refreshToken: '' }

  for (const user of [donor, ngo, volunteer]) {
    await adminCreateUser(request, user.email, password)
    const loggedIn = await passwordLogin(request, user.email, password)
    user.accessToken = loggedIn.accessToken
    user.refreshToken = loggedIn.refreshToken
  }

  await registerProfile(request, donor, 'DONOR', name('Donor'))
  await registerProfile(request, ngo, 'NGO', name('NGO'))
  await registerProfile(request, volunteer, 'VOLUNTEER', name('Volunteer'))

  // Profiles are live — /auth/me resolves with the role profile + coords.
  const me = await apiCall(request, 'get', '/auth/me', ngo)
  expect(me.status()).toBe(200)
  const { user } = await me.json()
  expect(user.role).toBe('NGO')
  expect(user.ngo.latitude).toBe(TEST_COORDS.ngo.latitude)
})

// ── 2. Login + Create Donation + Image Upload + AI ─────────────────────────

test('donor logs in, lists a donation with a photo, and AI freshness is computed', async ({
  browser,
  request,
}) => {
  test.setTimeout(150_000)
  donorPage = await loginAs(browser, donor, '/donor')
  await expect(donorPage.getByRole('heading', { name: /welcome back/i })).toBeVisible()

  // Create the donation through the real form.
  await donorPage.getByRole('button', { name: /new donation/i }).click()
  await expect(donorPage).toHaveURL(/\/donor\/new/)

  await donorPage.getByLabel(/food name/i).fill(FOOD)
  await donorPage.getByLabel(/quantity/i).fill('12')
  // Category + unit keep their defaults (Grains / kg).

  const now = Date.now()
  await donorPage.getByLabel(/^expiry/i).fill(localInput(new Date(now + 5 * 3_600_000)))
  await donorPage.getByLabel(/pickup time/i).fill(localInput(new Date(now + 2 * 3_600_000)))
  await donorPage.getByLabel(/pickup address/i).fill('12 MG Road, Bengaluru')

  // Real image upload: the hidden input → client-side ImageKit upload.
  await donorPage.locator('input[type="file"]').setInputFiles({
    name: 'biryani.png',
    mimeType: 'image/png',
    buffer: makeTestPng(),
  })
  // The local blob preview is swapped for the remote ImageKit URL when done.
  await expect(donorPage.locator('img[src^="blob:"]')).toHaveCount(0, { timeout: 60_000 })
  await expect(donorPage.locator('img[src^="https://ik.imagekit.io/"]')).toHaveCount(1)

  await donorPage.getByRole('button', { name: /list donation/i }).click()
  await expect(donorPage).toHaveURL(/\/donor$/, { timeout: 45_000 })
  await expect(donorPage.getByText('Donation listed')).toBeVisible()
  await expect(donorPage.getByText(FOOD).first()).toBeVisible({ timeout: 30_000 })

  // The photo + AI freshness prediction persisted server-side.
  const listRes = await apiCall(request, 'get', '/donations?limit=20', donor)
  expect(listRes.status()).toBe(200)
  const { donations } = await listRes.json()
  const mine = donations.find((d: { foodName: string }) => d.foodName === FOOD)
  expect(mine, 'donation should be listed').toBeTruthy()
  donationId = mine.id as string

  const detailRes = await apiCall(request, 'get', `/donations/${donationId}`, donor)
  const detailPayload = await detailRes.json()
  const detail = detailPayload.donation ?? detailPayload
  expect(detail.images?.[0]?.imageUrl ?? '').toMatch(/^https:\/\/ik\.imagekit\.io\//)
  const prediction = (detail.predictions ?? [])[0]
  expect(prediction?.freshnessScore).toBeGreaterThanOrEqual(0)
})

// ── 3. NGO → Accept ─────────────────────────────────────────────────────────

test('NGO accepts the donation from the dashboard', async ({ browser, request }) => {
  test.setTimeout(90_000)
  ngoPage = await loginAs(browser, ngo, '/ngo')

  // The listing appears in "Nearby donations" (coords match within 25 km).
  const listing = ngoPage.locator('li').filter({ hasText: FOOD })
  await expect(listing).toBeVisible({ timeout: 45_000 })
  await listing.getByRole('button', { name: /accept food/i }).click()
  await expect(ngoPage.getByText('Donation accepted')).toBeVisible()

  // One-step claim reserves the donation.
  const detailRes = await apiCall(request, 'get', `/donations/${donationId}`, donor)
  const { donation } = await detailRes.json()
  expect(donation.status).toBe('RESERVED')
})

// ── 4. Volunteer → Accept (assigned) ───────────────────────────────────────

test('volunteer sets availability and is assigned the delivery', async ({ browser, request }) => {
  test.setTimeout(90_000)
  volunteerPage = await loginAs(browser, volunteer, '/volunteer')

  // Availability toggle through the UI.
  await volunteerPage.getByRole('button', { name: /^available$/i }).click()
  await expect(volunteerPage.getByText('Availability updated')).toBeVisible()

  // Accept via the API — no UI button exists yet for assignments.
  const assignRes = await apiCall(request, 'post', '/assignments', volunteer, { donationId })
  expect(assignRes.status()).toBe(201)
  const assign = await assignRes.json()
  deliveryId = assign.delivery.id as string

  // The dashboard reflects the assignment after a refresh.
  await volunteerPage.reload()
  await expect(volunteerPage.getByText('Current assignment')).toBeVisible()
  await expect(volunteerPage.getByText(FOOD).first()).toBeVisible({ timeout: 30_000 })
})

// ── 5. Pickup → Live Tracking ──────────────────────────────────────────────

test('pickup starts, GPS streams, and live tracking is visible', async ({ request }) => {
  test.setTimeout(90_000)

  // Pickup start via the API — no UI button exists yet.
  const startRes = await apiCall(request, 'post', `/deliveries/${deliveryId}/start`, volunteer)
  expect(startRes.status()).toBe(200)

  // The volunteer's GPS stream (real tracking samples).
  const gps = await apiCall(request, 'post', `/deliveries/${deliveryId}/location`, volunteer, {
    latitude: 12.98,
    longitude: 77.6,
    accuracy: 8,
    speed: 12,
  })
  expect(gps.status()).toBe(201)
  // Approaching the NGO (< 500 m) fires the once-only "almost there" alert.
  const approaching = await apiCall(request, 'post', `/deliveries/${deliveryId}/location`, volunteer, {
    latitude: TEST_COORDS.ngo.latitude,
    longitude: TEST_COORDS.ngo.longitude,
    accuracy: 5,
  })
  expect(approaching.status()).toBe(201)

  // Volunteer UI: in-transit state + live-tracking badge + complete button.
  await volunteerPage.reload()
  await expect(volunteerPage.getByText('Live tracking').first()).toBeVisible()
  await expect(volunteerPage.getByRole('button', { name: /mark as delivered/i })).toBeVisible()

  // Donor UI: the "Live deliveries" card shows the in-transit delivery.
  await donorPage.reload()
  await expect(donorPage.getByText('Live deliveries')).toBeVisible({ timeout: 45_000 })
  await expect(donorPage.getByText(FOOD).first()).toBeVisible()
})

// ── 6. Delivery → Impact ───────────────────────────────────────────────────

test('delivery completes and impact is reflected on every dashboard', async ({ request }) => {
  test.setTimeout(120_000)

  // The volunteer finishes the run through the UI button.
  await volunteerPage.getByRole('button', { name: /mark as delivered/i }).click()
  await expect(volunteerPage.getByText('Delivery completed')).toBeVisible()
  await expect(volunteerPage.getByText('No active delivery')).toBeVisible({ timeout: 45_000 })
  await expect(volunteerPage.getByText(FOOD).first()).toBeVisible() // recent deliveries

  // The delivery state machine ended where it should.
  const trackRes = await apiCall(request, 'get', '/deliveries/tracking', donor)
  const { deliveries } = await trackRes.json()
  expect(deliveries.some((d: { id: string }) => d.id === deliveryId)).toBe(false)

  // ── Impact: donor dashboard ──
  await donorPage.reload()
  await expect(donorPage.getByText('Total donations', { exact: true })).toBeVisible()
  const donorTotalKpi = donorPage.getByText('Total donations', { exact: true }).locator('..')
  await expect(donorTotalKpi).toContainText('1', { timeout: 30_000 })
  await expect(donorPage.getByText('Food saved').first()).toBeVisible()

  // ── Impact: NGO dashboard ──
  await ngoPage.reload()
  await expect(ngoPage.getByText('Accepted food', { exact: true })).toBeVisible()
  const ngoAcceptedKpi = ngoPage.getByText('Accepted food', { exact: true }).locator('..')
  await expect(ngoAcceptedKpi).toContainText('1', { timeout: 30_000 })
  await expect(ngoPage.getByText('Meals distributed', { exact: true })).toBeVisible()

  // ── Impact: volunteer dashboard ──
  await volunteerPage.reload()
  await expect(volunteerPage.getByText('Meals delivered', { exact: true })).toBeVisible()
  const mealsKpi = volunteerPage.getByText('Meals delivered', { exact: true }).locator('..')
  await expect(mealsKpi).toContainText(/[1-9][0-9]*/, { timeout: 30_000 })

  // The donor analytics API agrees (impact numbers persist).
  const analyticsRes = await apiCall(request, 'get', '/analytics/donor', donor)
  expect(analyticsRes.status()).toBe(200)
  const analytics = await analyticsRes.json()
  expect(analytics.summary.totalDonations).toBeGreaterThanOrEqual(1)
  expect(analytics.summary.foodSavedKg).toBeGreaterThan(0)
})
