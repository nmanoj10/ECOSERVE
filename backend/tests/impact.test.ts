/**
 * Phase 38, Step 96 — Carbon & impact calculation tests.
 *
 * The pure math of the analytics module: food→kg conversion, CO₂e avoided,
 * meals served, and the haversine distance used for matching/ETA.
 */
import { describe, expect, it } from 'vitest'

import { CO2_KG_PER_FOOD_KG, estimateCo2, foodKg } from '../src/utils/impact.js'
import { estimateMeals } from '../src/utils/meals.js'
import { haversineKm } from '../src/utils/geo.js'

describe('foodKg', () => {
  it('passes kg quantities through unchanged', () => {
    expect(foodKg(5, 'kg')).toBe(5)
    expect(foodKg(0.5, 'kg')).toBe(0.5)
  })

  it('converts non-kg units at 0.25 kg per unit', () => {
    expect(foodKg(4, 'plate')).toBe(1)
    expect(foodKg(2, 'packet')).toBe(0.5)
    expect(foodKg(8, 'plate')).toBe(2)
  })

  it('handles zero quantities', () => {
    expect(foodKg(0, 'kg')).toBe(0)
    expect(foodKg(0, 'plate')).toBe(0)
  })
})

describe('estimateCo2', () => {
  it('scales linearly with the food weight at 2.5 kg CO₂e per kg', () => {
    expect(estimateCo2(0)).toBe(0)
    expect(estimateCo2(1)).toBe(2.5)
    expect(estimateCo2(10)).toBe(25)
    expect(estimateCo2(0.5)).toBe(1.25)
  })

  it('exports a stable carbon factor', () => {
    expect(CO2_KG_PER_FOOD_KG).toBe(2.5)
  })

  it('stays consistent across the unit conversion', () => {
    // 4 plates = 1 kg → identical CO₂e as 1 kg of food.
    expect(estimateCo2(foodKg(4, 'plate'))).toBe(estimateCo2(foodKg(1, 'kg')))
  })
})

describe('estimateMeals', () => {
  it('assumes 4 meals per kg', () => {
    expect(estimateMeals(1, 'kg')).toBe(4)
    expect(estimateMeals(2.5, 'kg')).toBe(10)
  })

  it('counts non-kg units one-to-one', () => {
    expect(estimateMeals(3, 'plate')).toBe(3)
    expect(estimateMeals(12, 'packet')).toBe(12)
  })

  it('rounds fractional results', () => {
    expect(estimateMeals(0.5, 'kg')).toBe(2)
    expect(estimateMeals(1.2, 'kg')).toBe(5)
  })

  it('returns zero for a zero quantity', () => {
    expect(estimateMeals(0, 'kg')).toBe(0)
  })
})

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0)
  })

  it('computes a realistic Delhi → Mumbai distance', () => {
    const km = haversineKm(28.6139, 77.209, 19.076, 72.8777)
    expect(km).toBeGreaterThan(1100)
    expect(km).toBeLessThan(1200)
  })

  it('is symmetric', () => {
    const a = haversineKm(28.6139, 77.209, 19.076, 72.8777)
    const b = haversineKm(19.076, 72.8777, 28.6139, 77.209)
    expect(Math.abs(a - b)).toBeLessThan(1e-9)
  })

  it('grows with separation', () => {
    const near = haversineKm(12.9716, 77.5946, 12.99, 77.6)
    const far = haversineKm(12.9716, 77.5946, 13.1, 77.9)
    expect(far).toBeGreaterThan(near)
  })
})
