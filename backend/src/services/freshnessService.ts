/**
 * Freshness scoring — the "Trigger AI" step of the donation flow (Step 47).
 *
 * This module is the seam where the Python `ai-service` (planned) will plug in.
 * Today it's a deterministic, category-aware rule model: cheap, local, and it
 * never fails the request — the prediction is advisory and the listing stands
 * on its own. When the real model ships, replace `scoreDonation` with an HTTP
 * call that returns the same shape.
 */

export interface FreshnessInput {
  category: string
  /** Bulk listings are more urgent to place. */
  quantity: number
  expiryTime?: Date | null
  pickupTime?: Date | null
}

export interface FreshnessPrediction {
  /** 0–100. */
  freshnessScore: number
  /** Hours the food is safe to travel, capped at the category shelf life. */
  safeHours: number
  spoilageRisk: 'LOW' | 'MEDIUM' | 'HIGH'
  /** 1–5 urgency. */
  priority: number
  /** 0–1. */
  confidence: number
  modelVersion: string
}

/** Base shelf life (hours) by category — the model's prior. */
const BASE_SHELF_HOURS: Record<string, number> = {
  'Cooked Meals': 4,
  Dairy: 6,
  Bakery: 8,
  'Fresh Produce': 12,
  Grains: 72,
  'Packaged & Sealed': 240,
  Other: 12,
}

export function scoreDonation(input: FreshnessInput): FreshnessPrediction {
  const base = BASE_SHELF_HOURS[input.category] ?? 12
  const now = Date.now()

  let safeHours: number
  if (input.expiryTime) {
    // Count from the scheduled pickup (if it's still in the future) so the
    // estimate reflects the food's usable window for the trip.
    const from =
      input.pickupTime && input.pickupTime.getTime() > now ? input.pickupTime.getTime() : now
    safeHours = Math.max(0, Math.round(((input.expiryTime.getTime() - from) / 3_600_000) * 10) / 10)
    safeHours = Math.min(safeHours, base)
  } else {
    safeHours = base
  }

  const freshnessScore = Math.max(0, Math.min(100, Math.round((100 * safeHours) / base)))
  const spoilageRisk = safeHours > 12 ? 'LOW' : safeHours > 4 ? 'MEDIUM' : 'HIGH'
  // Bulk quantities (≥50 units) bump urgency by one step, capped at 5.
  const priority = Math.min(5, (spoilageRisk === 'HIGH' ? 5 : spoilageRisk === 'MEDIUM' ? 3 : 1) + (input.quantity >= 50 ? 1 : 0))

  return {
    freshnessScore,
    safeHours,
    spoilageRisk,
    priority,
    confidence: 0.9,
    modelVersion: 'rule-based-v1',
  }
}
