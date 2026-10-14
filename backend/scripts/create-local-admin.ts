/**
 * Creates or updates a local admin user with email admin@ecoserve.com and password "admin".
 * Run from backend/:  npx tsx scripts/create-local-admin.ts
 *
 * Uses raw pg to avoid Prisma import issues in scripts folder.
 */
import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcrypt'

const ADMIN_EMAIL = 'admin@ecoserve.com'
const ADMIN_PASSWORD = 'admin'
const ADMIN_NAME = 'Admin User'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in backend/.env')
  process.exit(1)
}

async function main() {
  console.log(`Creating/updating admin user: ${ADMIN_EMAIL}`)

  // Hash the password
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  // Connect to PostgreSQL
  const pool = new pg.Pool({
    connectionString: DATABASE_URL.replace(/([?&])sslmode=[^&#]*/i, '$1').replace(/[?&]$/, ''),
    ssl: false,
  })

  try {
    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL])

    if (existing.rows.length > 0) {
      // Update existing user - using camelCase column names as they exist in DB
      await pool.query(
        `UPDATE users SET "passwordHash" = $1, "fullName" = $2, role = $3, status = $4, "updatedAt" = NOW() WHERE email = $5`,
        [passwordHash, ADMIN_NAME, 'ADMIN', 'ACTIVE', ADMIN_EMAIL]
      )
      console.log('✅ Updated existing admin user')
    } else {
      // Insert new user
      const id = crypto.randomUUID()
      await pool.query(
        `INSERT INTO users (id, email, "passwordHash", "fullName", phone, role, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [id, ADMIN_EMAIL, passwordHash, ADMIN_NAME, null, 'ADMIN', 'ACTIVE']
      )
      console.log('✅ Created new admin user')
    }

    console.log('\n🎉 Admin user ready!')
    console.log(`   Email: ${ADMIN_EMAIL}`)
    console.log(`   Password: ${ADMIN_PASSWORD}`)
    console.log(`   Role: ADMIN`)
    console.log(`   Status: ACTIVE`)
    console.log('\nYou can now log in at POST /api/v1/auth/login with:')
    console.log(`   { "email": "${ADMIN_EMAIL}", "password": "${ADMIN_PASSWORD}" }`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err)
  process.exit(1)
})