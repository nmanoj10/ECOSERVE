import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { HttpError } from '../utils/HttpError.js'
import type { UpdateDonorProfileBody } from '../validators/donor.js'

/**
 * PATCH /api/v1/donor/profile — updates the donor's own profile. The location
 * fields (address/city/state + lat/lng pin) back the nearby-donations search
 * when a listing has no pin of its own; sending `null` clears the pin.
 * `logoUrl` stores a public image URL (e.g. from ImageKit) for the donor showcase.
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const body = req.body as UpdateDonorProfileBody

  const donor = await prisma.donor.findUnique({ where: { userId: user.userId } })
  if (!donor) {
    throw new HttpError(404, 'NOT_FOUND', 'Donor profile not found')
  }

  const updated = await prisma.donor.update({
    where: { id: donor.id },
    data: {
      ...(body.organizationName !== undefined && { organizationName: body.organizationName }),
      ...(body.organizationType !== undefined && { organizationType: body.organizationType }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.state !== undefined && { state: body.state }),
      ...(body.latitude !== undefined && { latitude: body.latitude }),
      ...(body.longitude !== undefined && { longitude: body.longitude }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
    },
  })

  await prisma.auditLog.create({
    data: { userId: user.userId, action: 'donor.profile.updated', entity: 'donor', entityId: donor.id },
  })

  res.json({ donor: updated })
}

/**
 * GET /api/v1/public/donors — returns all verified donors with logos for the public showcase.
 * Public endpoint (no auth required). Used for the moving marquee on the homepage.
 */
export async function listPublicDonors(_req: Request, res: Response): Promise<void> {
  const donors = await prisma.donor.findMany({
    where: {
      logoUrl: { not: null },
      user: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      organizationName: true,
      organizationType: true,
      city: true,
      state: true,
      logoUrl: true,
      description: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  res.json({ donors })
}
