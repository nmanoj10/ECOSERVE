/**
 * Phase 38 cleanup — removes ALL test data created by the testing steps:
 *
 *   - Step 97 (Postman collection):   *.api@ecoserve.test  users + their data
 *   - Step 99 (Playwright E2E):       e2e.*@gmail.com       users + their data
 *   - Supabase auth users for those accounts (listed from the Admin API, so
 *     orphaned auth rows are caught even when the platform row is gone)
 *   - ImageKit test uploads (everything under the `donations/` folder)
 *   - Recomputes the daily Analytics rollup from the remaining real data
 *
 * Run with DRY_RUN=1 (default) to preview, then DRY_RUN=0 to execute:
 *
 *   npx tsx scripts/cleanup-test-data.ts           # dry run (safe)
 *   DRY_RUN=0 npx tsx scripts/cleanup-test-data.ts # delete for real
 *
 * Only rows owned by test users are touched — real accounts are never
 * modified. The script prints every email it considers test data.
 */
import { env } from '../src/config/env.js'
import { prisma } from '../src/config/prisma.js'
import { runAnalyticsNow } from '../src/jobs/analyticsJob.js'

const DRY_RUN = process.env.DRY_RUN !== '0'

/** Emails created for testing by Steps 97/99, 116 (and ad-hoc probes). */
const TEST_EMAIL_PATTERNS = [
  '%@ecoserve.test', // Step 97: donor.api / ngo.api / volunteer.api / admin.api
  'e2e.%', // Step 99: e2e.<role>.<timestamp>@gmail.com + e2e.probe.*@gmail.com
  'e2e-probe-%',
]

function matchesTestEmail(email: string): boolean {
  const lower = email.toLowerCase()
  return (
    lower.endsWith('@ecoserve.test') ||
    lower.startsWith('e2e.') ||
    lower.startsWith('e2e-probe-') ||
    lower.startsWith('live.') // Step 116: live.<role>.<timestamp>@gmail.com (setup-live-tracking.ts)
  )
}

function log(message: string): void {
  console.log(DRY_RUN ? `[dry-run] ${message}` : `[clean] ${message}`)
}

// ── Supabase Admin API (service-role) ──────────────────────────────────────

async function supabaseAdmin(
  method: string,
  path: string,
): Promise<{ status: number; json: () => Promise<unknown> }> {
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    },
  })
  return { status: res.status, json: () => res.json().catch(() => null) }
}

async function cleanupSupabaseUsers(): Promise<void> {
  console.log('\n── Supabase auth users ──')
  const { status, json } = await supabaseAdmin('GET', '/auth/v1/admin/users?per_page=1000')
  if (status !== 200) {
    console.warn(`  ⚠️  Could not list Supabase users (${status}) — skipping.`)
    return
  }
  const page = (await json()) as { users?: Array<{ id: string; email: string }> } | null
  const testAccounts = (page?.users ?? []).filter((u) => matchesTestEmail(u.email ?? ''))

  if (testAccounts.length === 0) {
    console.log('  No test accounts in Supabase Auth.')
    return
  }
  for (const account of testAccounts) console.log(`  - ${account.email}`)

  if (DRY_RUN) return
  let deleted = 0
  for (const account of testAccounts) {
    const { status: delStatus } = await supabaseAdmin('DELETE', `/auth/v1/admin/users/${account.id}`)
    if (delStatus === 200 || delStatus === 204 || delStatus === 404) deleted++
    else console.warn(`  ⚠️  Delete failed for ${account.email} (${delStatus})`)
  }
  log(`Supabase auth users: ${deleted}/${testAccounts.length} removed`)
}

// ── ImageKit Management API ────────────────────────────────────────────────

async function cleanupImageKit(): Promise<void> {
  console.log('\n── ImageKit test uploads ──')
  if (!env.IMAGEKIT_PRIVATE_KEY) {
    console.warn('  ⚠️  IMAGEKIT_PRIVATE_KEY is not set — skipping cloud deletion.')
    return
  }
  const basic = Buffer.from(`${env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')
  const headers = { Authorization: `Basic ${basic}` }

  // The app uploads donations to the `donations/` folder — every file there is
  // test data (the only writes came from the E2E suite).
  const listRes = await fetch('https://api.imagekit.io/v1/files?path=donations/&includeFolder=false', { headers })
  if (!listRes.ok) {
    console.warn(`  ⚠️  Could not list ImageKit files (${listRes.status}) — skipping.`)
    return
  }
  const files = (await listRes.json()) as Array<{ fileId: string; name: string; url?: string }>

  if (files.length === 0) {
    console.log('  No files under donations/.')
    return
  }
  for (const file of files) console.log(`  - ${file.name}  (${file.fileId})`)

  if (DRY_RUN) return
  let deleted = 0
  for (const file of files) {
    const delRes = await fetch(`https://api.imagekit.io/v1/files/${file.fileId}`, { method: 'DELETE', headers })
    if (delRes.ok || delRes.status === 404) deleted++
    else console.warn(`  ⚠️  Delete failed for ${file.name} (${delRes.status})`)
  }
  log(`ImageKit photos: ${deleted}/${files.length} removed`)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (DRY_RUN) console.log('🔎 DRY RUN — nothing will be deleted. Set DRY_RUN=0 to execute.\n')

  // ── 1. Platform database ──────────────────────────────────────────────────
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        ...TEST_EMAIL_PATTERNS.map((p) => ({ email: { contains: p.slice(1, -1), mode: 'insensitive' as const } })),
        // Step 116 — live-tracking test accounts (setup-live-tracking.ts).
        // startsWith avoids matching real addresses that merely contain
        // "live." (e.g. olive.smith@…), which a contains filter would catch.
        { email: { startsWith: 'live.', mode: 'insensitive' as const } },
      ],
    },
    select: { id: true, email: true, role: true },
  })

  if (testUsers.length > 0) {
    console.log(`Test users (${testUsers.length}):`)
    for (const user of testUsers) console.log(`  - ${user.email}  [${user.role}]`)

    const userIds = testUsers.map((u) => u.id)
    const [donors, ngos, volunteers, donations, assignments, requests] = await Promise.all([
      prisma.donor.findMany({ where: { userId: { in: userIds } }, select: { id: true } }),
      prisma.ngo.findMany({ where: { userId: { in: userIds } }, select: { id: true } }),
      prisma.volunteer.findMany({ where: { userId: { in: userIds } }, select: { id: true } }),
      prisma.donation.findMany({ where: { donor: { userId: { in: userIds } } }, select: { id: true } }),
      prisma.volunteerAssignment.findMany({
        where: { OR: [{ donation: { donor: { userId: { in: userIds } } } }, { volunteer: { userId: { in: userIds } } }] },
        select: { id: true },
      }),
      prisma.ngoRequest.findMany({
        where: { OR: [{ donation: { donor: { userId: { in: userIds } } } }, { ngo: { userId: { in: userIds } } }] },
        select: { id: true },
      }),
    ])

    const donorIds = donors.map((d) => d.id)
    const ngoIds = ngos.map((n) => n.id)
    const volunteerIds = volunteers.map((v) => v.id)
    const donationIds = donations.map((d) => d.id)
    const assignmentIds = assignments.map((a) => a.id)
    const requestIds = requests.map((r) => r.id)
    const deliveryIds = assignmentIds.length
      ? (await prisma.delivery.findMany({ where: { assignmentId: { in: assignmentIds } }, select: { id: true } })).map((d) => d.id)
      : []

    const entityIdSet = new Set([
      ...userIds,
      ...donorIds,
      ...ngoIds,
      ...volunteerIds,
      ...donationIds,
      ...assignmentIds,
      ...requestIds,
      ...deliveryIds,
    ])

    if (DRY_RUN) {
      console.log(
        `\nWould delete ${donationIds.length} donations, ${requestIds.length} requests, ` +
          `${assignmentIds.length} assignments, ${deliveryIds.length} deliveries, ` +
          `${entityIdSet.size} total entity ids.`,
      )
    } else {
      const tally = async (label: string, n: number): Promise<void> => log(`${label}: ${n} removed`)

      await tally('sessions', (await prisma.session.deleteMany({ where: { userId: { in: userIds } } })).count)
      await tally('notifications', (await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })).count)
      if (deliveryIds.length > 0) {
        await tally(
          'reviews',
          (await prisma.review.deleteMany({ where: { OR: [{ deliveryId: { in: deliveryIds } }, { reviewerId: { in: userIds } }, { revieweeId: { in: userIds } }] } })).count,
        )
        await tally('delivery_locations', (await prisma.deliveryLocation.deleteMany({ where: { deliveryId: { in: deliveryIds } } })).count)
        await tally('deliveries', (await prisma.delivery.deleteMany({ where: { id: { in: deliveryIds } } })).count)
      }
      if (assignmentIds.length > 0) {
        await tally('volunteer_assignments', (await prisma.volunteerAssignment.deleteMany({ where: { id: { in: assignmentIds } } })).count)
      }
      if (requestIds.length > 0) {
        await tally('ngo_requests', (await prisma.ngoRequest.deleteMany({ where: { id: { in: requestIds } } })).count)
      }
      if (donationIds.length > 0) {
        await tally('ai_predictions', (await prisma.aiPrediction.deleteMany({ where: { donationId: { in: donationIds } } })).count)
        await tally('donation_images', (await prisma.donationImage.deleteMany({ where: { donationId: { in: donationIds } } })).count)
        await tally('donations', (await prisma.donation.deleteMany({ where: { id: { in: donationIds } } })).count)
      }
      await tally(
        'audit_logs',
        (await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { entityId: { in: [...entityIdSet] } }] } })).count,
      )
      if (donorIds.length > 0) await tally('donors', (await prisma.donor.deleteMany({ where: { id: { in: donorIds } } })).count)
      if (ngoIds.length > 0) await tally('ngos', (await prisma.ngo.deleteMany({ where: { id: { in: ngoIds } } })).count)
      if (volunteerIds.length > 0) {
        await tally('volunteers', (await prisma.volunteer.deleteMany({ where: { id: { in: volunteerIds } } })).count)
      }
      await tally('users', (await prisma.user.deleteMany({ where: { id: { in: userIds } } })).count)
      console.log('\nDatabase cleanup done.')
    }
  } else {
    console.log('No test users found in the platform database.')
  }

  // ── 2. Supabase auth + ImageKit (run unconditionally — they list live) ────
  await cleanupSupabaseUsers()
  await cleanupImageKit()

  // ── 3. Recompute the daily analytics rollup from remaining real data ──────
  if (!DRY_RUN) {
    const summary = await runAnalyticsNow(90)
    log(`Analytics recomputed: ${summary.upserts} daily rows upserted (90-day window)`)
    console.log('\n✅ Cleanup complete.')
  } else {
    console.log('\nDry run complete — nothing was deleted.')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
