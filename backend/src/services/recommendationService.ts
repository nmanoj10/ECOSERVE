import type { AssignmentStatus } from '../generated/prisma/client.js'

import { prisma } from '../config/prisma.js'
import { haversineKm } from '../utils/geo.js'

export interface RecommendationBreakdown {
  distance: number
  availability: number
  vehicle: number
  workload: number
  eta: number
  rating: number
}

export interface VolunteerRecommendation {
  volunteerId: string
  fullName: string
  vehicleType: string | null
  rating: number
  activeAssignments: number
  distanceKm: number
  etaMinutes: number
  /** Final 0–100 match score. */
  score: number
  breakdown: RecommendationBreakdown
}

/** Pickup coordinates for a donation, falling back to the donor's profile. */
export interface DonationForRecommendation {
  latitude: number | null
  longitude: number | null
  unit: string
  quantity: number
  donor: { latitude: number | null; longitude: number | null }
}

/** Sub-scores are normalized to 0–100 then blended with these weights. */
const WEIGHTS = {
  distance: 0.3,
  availability: 0.1,
  vehicle: 0.15,
  workload: 0.15,
  eta: 0.1,
  rating: 0.2,
}

/** Distance at which the distance sub-score reaches zero (km). */
const DISTANCE_DECAY_KM = 15
/** ETA at which the eta sub-score reaches zero (minutes). */
const ETA_DECAY_MIN = 60
/** Straight-line → road distance estimate. */
export const ROAD_FACTOR = 1.3
/** Assumed urban average speed for the ETA estimate (km/h). */
export const AVG_SPEED_KMH = 25

const VEHICLE_CAPACITY_KG: Record<string, number> = {
  truck: 1000,
  van: 500,
  car: 120,
  auto: 100,
  tuktuk: 100,
  bike: 30,
  scooter: 30,
  motorcycle: 30,
}
const DEFAULT_CAPACITY_KG = 10

const ACTIVE_STATUSES: AssignmentStatus[] = ['PENDING', 'ACCEPTED', 'IN_TRANSIT']

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function vehicleCapacityKg(vehicleType: string | null): number {
  if (!vehicleType) return DEFAULT_CAPACITY_KG
  const key = vehicleType.toLowerCase()
  for (const [name, capacity] of Object.entries(VEHICLE_CAPACITY_KG)) {
    if (key.includes(name)) return capacity
  }
  return DEFAULT_CAPACITY_KG
}

function vehicleBaseScore(vehicleType: string | null): number {
  if (!vehicleType) return 40
  const key = vehicleType.toLowerCase()
  if (key.includes('truck') || key.includes('van')) return 100
  if (key.includes('car')) return 85
  if (key.includes('auto') || key.includes('tuk')) return 80
  if (key.includes('bike') || key.includes('scooter') || key.includes('motor')) return 60
  return 40
}

/**
 * Phase 21, Step 59 — volunteer recommendation.
 *
 * Scores AVAILABLE volunteers for a claimed donation on: distance to pickup,
 * availability (hard filter — only AVAILABLE volunteers qualify), vehicle
 * capacity vs the quantity, current workload (fewer active runs = better),
 * estimated ETA, and rating. Volunteers without a current location are
 * excluded (distance and ETA can't be computed).
 */
export async function recommendVolunteers(donation: DonationForRecommendation): Promise<VolunteerRecommendation[]> {
  const pickupLat = donation.latitude ?? donation.donor.latitude
  const pickupLng = donation.longitude ?? donation.donor.longitude
  const quantityKg = donation.unit === 'kg' ? donation.quantity : null

  const volunteers = await prisma.volunteer.findMany({
    where: { availability: 'AVAILABLE' },
    include: {
      user: { select: { fullName: true } },
      assignments: { where: { status: { in: ACTIVE_STATUSES } }, select: { id: true } },
    },
  })

  const results: VolunteerRecommendation[] = []

  for (const volunteer of volunteers) {
    const { currentLatitude, currentLongitude } = volunteer
    if (currentLatitude == null || currentLongitude == null || pickupLat == null || pickupLng == null) continue

    const distanceKm = haversineKm(pickupLat, pickupLng, currentLatitude, currentLongitude)
    const capacity = vehicleCapacityKg(volunteer.vehicleType)
    if (quantityKg != null && quantityKg > capacity) continue // can't carry the load

    const etaMinutes = (distanceKm * ROAD_FACTOR * 60) / AVG_SPEED_KMH
    const activeAssignments = volunteer.assignments.length

    const distance = Math.max(0, 1 - distanceKm / DISTANCE_DECAY_KM) * 100
    const availability = 100 // hard-filtered above
    const vehicle = quantityKg != null ? Math.min(1, capacity / quantityKg) * 100 : vehicleBaseScore(volunteer.vehicleType)
    const workload = 100 / (1 + activeAssignments)
    const eta = Math.max(0, 1 - etaMinutes / ETA_DECAY_MIN) * 100
    const rating = (volunteer.rating / 5) * 100

    const score =
      WEIGHTS.distance * distance +
      WEIGHTS.availability * availability +
      WEIGHTS.vehicle * vehicle +
      WEIGHTS.workload * workload +
      WEIGHTS.eta * eta +
      WEIGHTS.rating * rating

    results.push({
      volunteerId: volunteer.userId,
      fullName: volunteer.user.fullName,
      vehicleType: volunteer.vehicleType,
      rating: volunteer.rating,
      activeAssignments,
      distanceKm: round1(distanceKm),
      etaMinutes: Math.round(etaMinutes),
      score: round1(score),
      breakdown: {
        distance: round1(distance),
        availability,
        vehicle: round1(vehicle),
        workload: round1(workload),
        eta: round1(eta),
        rating: round1(rating),
      },
    })
  }

  return results.sort((a, b) => b.score - a.score)
}
