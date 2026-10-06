/* Temporary diagnostic — lists platform users from local PostgreSQL. Delete after use. */
import { env } from '../src/config/env.js'
import { prisma } from '../src/config/prisma.js'

const all: Array<{ id: string; email: string; created_at: string; status: string }> = []

const users = await prisma.user.findMany({
  select: { id: true, email: true, createdAt: true, status: true },
  orderBy: { createdAt: 'asc' },
})

for (const u of users) {
  const confirmed = u.status === 'ACTIVE' ? 'confirmed' : 'other status'
  console.log(
    'RESULT',
    u.role ?? 'NO ROLE',
    '|',
    u.email,
    '|',
    confirmed,
    '| created:',
    u.createdAt.toISOString().slice(0, 19),
  )
}

console.log(`\nRESULT platform users total: ${users.length}`)
await prisma.$disconnect()