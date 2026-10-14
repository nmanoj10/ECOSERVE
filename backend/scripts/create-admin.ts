/**
 * Creates or updates an admin user with email admin@ecoserve.com and password "admin".
 * Run from backend/:  npx tsx scripts/create-admin.ts
 *
 * Requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY in backend/.env
 */
import 'dotenv/config'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
const SECRET = process.env.SUPABASE_SECRET_KEY ?? ''

if (!SUPABASE_URL || !PUBLISHABLE || !SECRET) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY in backend/.env')
  process.exit(1)
}

const ADMIN_EMAIL = 'admin@ecoserve.com'
const ADMIN_PASSWORD = 'admin'

async function main() {
  // 1. Create or update the auth user (auto-confirmed)
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true }),
  })

  if (!createRes.ok && createRes.status !== 400) {
    const body = await createRes.json().catch(() => ({}))
    throw new Error(`Create failed (${createRes.status}): ${JSON.stringify(body)}`)
  }

  // 2. Find the auth user ID
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  })
  const listData = await listRes.json()
  const authUser = listData.users?.find((u: any) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())

  if (!authUser?.id) {
    throw new Error('Admin auth user not found after create')
  }

  // 3. Ensure password is set (handles re-runs where user already existed)
  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, {
    method: 'PUT',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD, email_confirm: true }),
  })
  if (!updateRes.ok) {
    const body = await updateRes.json().catch(() => ({}))
    throw new Error(`Password set failed (${updateRes.status}): ${JSON.stringify(body)}`)
  }

  // 4. Update role to ADMIN in the platform users table (Prisma)
  //    We'll use a direct SQL call via fetch to the backend API if running,
  //    but here we'll just print the SQL you can run in Supabase SQL editor:
  console.log('\n✅ Auth user ready. Now run this SQL in Supabase SQL Editor to set the role:')
  console.log(`UPDATE users SET role = 'ADMIN' WHERE email = '${ADMIN_EMAIL}';`)
  console.log('\nOr if you have the backend running, call:')
  console.log(`PATCH http://localhost:3001/api/v1/admin/users/${authUser.id}`)
  console.log('  Header: Authorization: Bearer <YOUR_ADMIN_JWT>')
  console.log('  Body: { "role": "ADMIN" }')
  console.log('\n(You need an existing admin JWT to call the API. First admin must be set via SQL.)')

  console.log(`\n🎉 Admin credentials:`)
  console.log(`   Email: ${ADMIN_EMAIL}`)
  console.log(`   Password: ${ADMIN_PASSWORD}`)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})