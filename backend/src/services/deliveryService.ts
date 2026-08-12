import { prisma } from '../config/prisma.js'
import { notifyUsers, NOTIFICATION_TYPES } from './notificationService.js'
import { emitToDeliveryRoom } from './realtime.js'
import { haversineKm } from '../utils/geo.js'

/** Within this distance of the drop point, the NGO + donor are told the volunteer is arriving. */
const APPROACH_RADIUS_KM = 0.5

/** The delivery + assignment data both GPS entry points need for the approaching check. */
export interface ApproachingCandidate {
  id: string
  approachingNotifiedAt: Date | null
  assignment: {
    volunteer: { user: { fullName: string } }
    donation: {
      id: string
      foodName: string
      donor: { userId: string }
      requests: Array<{
        ngo: { userId: string; ngoName: string; latitude: number | null; longitude: number | null }
      }>
    }
  }
}

/**
 * Once-only "Volunteer approaching" alert (notification + realtime event).
 *
 * Shared by both GPS entry points — the REST `submitLocation` controller and
 * the Socket.IO `delivery:gps` handler — so the volunteer's live position is
 * treated identically no matter which channel it arrived on. Fires exactly
 * once per delivery: the first GPS sample within `APPROACH_RADIUS_KM` of the
 * drop point flips `approachingNotifiedAt` (atomic guarded update), so later
 * pings never spam the NGO or donor.
 */
export async function maybeNotifyApproaching(
  delivery: ApproachingCandidate,
  latitude: number,
  longitude: number,
): Promise<void> {
  const ngo = delivery.assignment.donation.requests[0]?.ngo
  if (
    delivery.approachingNotifiedAt == null &&
    ngo?.latitude != null &&
    ngo.longitude != null &&
    haversineKm(latitude, longitude, ngo.latitude, ngo.longitude) <= APPROACH_RADIUS_KM
  ) {
    const claimed = await prisma.delivery.updateMany({
      where: { id: delivery.id, approachingNotifiedAt: null },
      data: { approachingNotifiedAt: new Date() },
    })

    if (claimed.count === 1) {
      const recipients: string[] = [delivery.assignment.donation.donor.userId]
      if (ngo.userId) recipients.push(ngo.userId)

      await notifyUsers(recipients, {
        title: `${delivery.assignment.volunteer.user.fullName} is almost there`,
        message:
          `${delivery.assignment.volunteer.user.fullName} is within ${Math.round(APPROACH_RADIUS_KM * 1000)} m of ` +
          `${ngo.ngoName} with ${delivery.assignment.donation.foodName}.`,
        type: NOTIFICATION_TYPES.VOLUNTEER_APPROACHING,
        donationId: delivery.assignment.donation.id,
      })

      // Realtime: watchers' live-tracking maps flip to "volunteer approaching".
      emitToDeliveryRoom(delivery.id, 'delivery:approaching', {
        deliveryId: delivery.id,
        ngoName: ngo.ngoName,
      })
    }
  }
}
