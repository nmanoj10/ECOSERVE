/* Temporary diagnostic — auth users without platform rows. Delete after use. */
import { env } from '../src/config/env.js'
import { prisma } from '../src/config/prisma.js'

const headers = {
  apikey: env.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
}

const all: Array<{ id: string; email: string; created_at: string; email_confirmed_at: string | null }> = []
let page = 1
for (;;) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers })
  const body = (await res.json()) as { users?: Array<{ id: string; email: string; created_at: string; email_confirmed_at: string | null }> }
  const users = body.users ?? []
  all.push(...users)
  if (users.length < 200) break
  page += 1
}

console.log(`RESULT auth users total: ${all.length}`)
const platformEmails = new Set((await prisma.user.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()))
for (const u of all) {
  const confirmed = u.email_confirmed_at ? 'confirmed' : 'UNCONFIRMED'
  const hasRow = platformEmails.has(u.email.toLowerCase())
  console.log(
    'RESULT',
    u.email,
    '|',
    confirmed,
    '| platform row:',
    hasRow ? 'yes' : 'NO ROW',
    '| created:',
    u.created_at.slice(0, 19),
  )
}

await prisma.$disconnect()
