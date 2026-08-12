/* Temporary diagnostic — compare DB users.id vs Supabase auth user id. Delete after use. */
import { env } from '../src/config/env.js'
import { prisma } from '../src/config/prisma.js'

const EMAIL = 'donor.dash.1786538978@gmail.com'

const dbUser = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, email: true, createdAt: true } })
console.log('RESULT DB users.id:', dbUser?.id ?? 'NOT FOUND', '| created:', dbUser?.createdAt?.toISOString())

const headers = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` }
const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?email=${EMAIL}`, { headers })
const body = (await res.json()) as { users?: Array<{ id: string; created_at: string }> }
console.log('RESULT auth users:', JSON.stringify(body.users?.map((u) => ({ id: u.id, created_at: u.created_at }))))

await prisma.$disconnect()
