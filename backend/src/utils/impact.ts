/**
 * Impact conversions for the analytics module (Phase 30). Documented estimates —
 * swap for a real serving-size / carbon model when one ships.
 *
 * - 1 kg of food ≈ 4 meals (matches `utils/meals.ts`), so a non-kg unit
 *   (plate, packet) counts as 0.25 kg — this keeps the two conversions
 *   consistent: 1 kg ≈ 4 plates ≈ 4 meals.
 * - Saving 1 kg of food avoids ~2.5 kg CO₂e (common food-waste carbon factor).
 */

/** Weight of one non-kg unit, in kg. */
const KG_PER_UNIT = 0.25

/** kg CO₂e avoided per kg of food saved. */
export const CO2_KG_PER_FOOD_KG = 2.5

/** Converts a donation's quantity + unit into kilograms of food. */
export function foodKg(quantity: number, unit: string): number {
  return unit === 'kg' ? quantity : quantity * KG_PER_UNIT
}

/** CO₂e (kg) avoided by saving the given amount of food (in kg). */
export function estimateCo2(foodKgAmount: number): number {
  return foodKgAmount * CO2_KG_PER_FOOD_KG
}
