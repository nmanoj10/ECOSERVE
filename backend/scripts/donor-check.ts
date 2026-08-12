/* Temporary diagnostic — donor users and profile completeness. Delete after use. */
import { prisma } from '../src/config/prisma.js'

const donors = await prisma.user.findMany({
  where: { role: 'DONOR' },
  select: {
    id: true,
    email: true,
    fullName: true,
    status: true,
    createdAt: true,
    donor: {
      select: { organizationName: true, organizationType: true, address: true, city: true, state: true, latitude: true, longitude: true },
    },
  },
  orderBy: { createdAt: 'desc' },
})

console.log(`RESULT donor users: ${donors.length}`)
for (const d of donors) {
  console.log(
    'RESULT',
    d.email,
    '| id:',
    d.id,
    '| profile:',
    d.donor ? 'yes' : 'NO PROFILE',
    '| org:',
    d.donor?.organizationName ?? '-',
    '| city:',
    d.donor?.city ?? '-',
    '| created:',
    d.createdAt.toISOString(),
  )
}

await prisma.$disconnect()
