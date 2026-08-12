/* Temporary diagnostic — all platform users + admin API filter test. Delete after use. */
import { env } from '../src/config/env.js'
import { prisma } from '../src/config/prisma.js'

const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
console.log(`RESULT platform users: ${users.length}`)
for (const u of users) console.log('RESULT', u.role, '|', u.email, '|', u.id.slice(0, 8), '|', u.createdAt.toISOString())

// Test whether the Admin API respects ?email=
const headers = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` }
const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent('nagenahallimanoj@gmail.com')}`, { headers })
const body = (await res.json()) as { users?: Array<{ id: string; email: string }> }
console.log('RESULT email-filter test returned', body.users?.length ?? 0, 'users:')
for (const u of body.users ?? []) console.log('RESULT   filter hit:', u.email)

await prisma.$disconnect()
