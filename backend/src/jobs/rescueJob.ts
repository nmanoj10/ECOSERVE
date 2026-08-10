import { env } from '../config/env.js'
import { runRescueCheck } from '../services/rescueService.js'

let timer: NodeJS.Timeout | null = null

/** Runs one rescue sweep now — also the admin manual trigger endpoint. */
export async function runRescueNow() {
  return runRescueCheck()
}

async function sweep(): Promise<void> {
  try {
    const summary = await runRescueNow()
    if (summary.rescued > 0) {
      console.log(
        `[rescue] ${summary.rescued}/${summary.scanned} donations alerted · ${summary.notificationsSent} notifications sent`,
      )
    }
  } catch (err) {
    console.error('[rescue] sweep failed:', err)
  }
}

/**
 * Phase 19 — starts the periodic rescue sweep (every `RESCUE_INTERVAL_MS`).
 * Runs one sweep immediately on boot to catch anything that crossed the window
 * while the server was down. Skipped in test so unit tests never fire network
 * calls or notifications.
 */
export function startRescueJob(): void {
  if (env.NODE_ENV === 'test' || timer) return

  void sweep()
  timer = setInterval(() => void sweep(), env.RESCUE_INTERVAL_MS)
  timer.unref()
}
