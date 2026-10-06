import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { HttpError } from '../utils/HttpError.js'

/**
 * Phase 46 — user preference endpoints (privacy, spec §9).
 *
 * `locationAlertsEnabled` is the rescue notification opt-out: when false, the
 * rescue sweep never sends location-based "food needs rescue" alerts to this
 * user (as a donor or as a volunteer). It does not affect ordinary,
 * non-location notifications (NGO claims, delivery updates, admin).
 */

/** GET /api/v1/users/preferences — current notification preferences. */
export async function getPreferences(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user?.userId },
    select: { locationAlertsEnabled: true },
  })
  if (!user) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found')
  }
  res.json({ preferences: user })
}

/** PATCH /api/v1/users/preferences — update notification preferences. */
export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const value = (req.body ?? {}).locationAlertsEnabled
  if (typeof value !== 'boolean') {
    throw new HttpError(400, 'VALIDATION', 'locationAlertsEnabled must be a boolean')
  }

  const user = await prisma.user.update({
    where: { id: req.user?.userId },
    data: { locationAlertsEnabled: value },
    select: { locationAlertsEnabled: true },
  })

  res.json({ preferences: user })
}