import { env } from '../config/env.js'

/**
 * Emergency-redistribution priority tiers (spec §6).
 *
 * Donations are prioritised by the time left until expiry at the moment each
 * sweep runs. The tiers are driven entirely by env so deployments can tune
 * them (`RESCUE_PRIORITY_*_HOURS`) without a code change:
 *
 *   More than INCREASED_HOURS (default 6 h) → NORMAL
 *   INCREASED_HOURS…URGENT_HOURS           → INCREASED
 *   URGENT_HOURS…EMERGENCY_HOURS           → URGENT
 *   Less than EMERGENCY_HOURS (default 1 h)→ EMERGENCY
 */

export const RESCUE_PRIORITY_LEVELS = ['NORMAL', 'INCREASED', 'URGENT', 'EMERGENCY'] as const
export type RescuePriorityLevel = (typeof RESCUE_PRIORITY_LEVELS)[number]

/** 0 = NORMAL … 3 = EMERGENCY. Used to detect urgency escalation between sweeps. */
export const RESCUE_PRIORITY_RANK: Record<RescuePriorityLevel, number> = {
  NORMAL: 0,
  INCREASED: 1,
  URGENT: 2,
  EMERGENCY: 3,
}

export interface RescuePriorityInfo {
  level: RescuePriorityLevel
  /** Human label for notification copy, e.g. "urgent". */
  label: string
  /** Short emphasis marker used in titles, e.g. "🚨". */
  emoji: string
}

const INFO: Record<RescuePriorityLevel, Omit<RescuePriorityInfo, 'level'>> = {
  NORMAL: { label: 'normal', emoji: 'ℹ️' },
  INCREASED: { label: 'increased priority', emoji: '⚡' },
  URGENT: { label: 'urgent', emoji: '🚨' },
  EMERGENCY: { label: 'emergency', emoji: '⛔' },
}

/** Computes the tier for a donation with `hoursLeft` until expiry. */
export function rescuePriority(hoursLeft: number): RescuePriorityInfo {
  let level: RescuePriorityLevel = 'NORMAL'
  if (hoursLeft < env.RESCUE_PRIORITY_EMERGENCY_HOURS) level = 'EMERGENCY'
  else if (hoursLeft < env.RESCUE_PRIORITY_URGENT_HOURS) level = 'URGENT'
  else if (hoursLeft < env.RESCUE_PRIORITY_INCREASED_HOURS) level = 'INCREASED'

  return { level, ...INFO[level] }
}