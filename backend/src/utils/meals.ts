/**
 * Rough meals estimate for dashboard KPIs: 1 kg of cooked food feeds about 4
 * people. Non-kg units (plates, packets) count 1:1. Documented as an estimate —
 * swap for a real serving-size model when one ships.
 */
export function estimateMeals(quantity: number, unit: string): number {
  return unit === 'kg' ? Math.round(quantity * 4) : Math.round(quantity)
}
