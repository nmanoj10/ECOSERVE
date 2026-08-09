import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'

/** Platform-wide overview for admins. Guarded by authorize('ADMIN'). */
export async function overview(_req: Request, res: Response): Promise<void> {
  const [usersByRole, donationsByStatus, volunteersAvailable, verifiedNgos, activeSessions] =
    await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.donation.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.volunteer.count({ where: { availability: 'AVAILABLE' } }),
      prisma.ngo.count({ where: { verificationStatus: 'VERIFIED' } }),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    ])

  res.json({
    users: Object.fromEntries(usersByRole.map((row) => [row.role, row._count._all])),
    donations: Object.fromEntries(donationsByStatus.map((row) => [row.status, row._count._all])),
    volunteersAvailable,
    verifiedNgos,
    activeSessions,
  })
}
