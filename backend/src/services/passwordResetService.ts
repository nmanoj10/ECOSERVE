import { createHash, randomInt, timingSafeEqual } from 'node:crypto'

import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'

/** A reset code stays valid for this long before it expires. */
export const OTP_TTL_MINUTES = 10
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000

/** A single code is rejected after this many wrong guesses (then deleted). */
const MAX_OTP_ATTEMPTS = 5

/** A user can be issued at most this many codes per rolling hour. */
export const MAX_OTP_CODES_PER_HOUR = 3

const HOUR_MS = 60 * 60 * 1000

/** Cryptographically-random 6-digit numeric code (e.g. "047213"). */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

/**
 * SHA-256 hex digest of the code, peppered with JWT_SECRET so a database leak
 * alone never reveals codes (and codes can't be brute-forced offline).
 */
export function hashOtpCode(code: string): string {
  return createHash('sha256').update(`${env.JWT_SECRET}:${code}`).digest('hex')
}

/** Constant-time comparison of the raw code against a stored hash. */
function codesMatch(rawCode: string, storedHash: string): boolean {
  const a = createHash('sha256').update(`${env.JWT_SECRET}:${rawCode}`).digest()
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Issues a fresh reset code for a user.
 *
 * Expired/used codes are pruned first, then a rolling per-hour cap is checked.
 * Returns `null` when the cap is hit — callers should respond exactly as if a
 * code was sent (anti-enumeration), while logging for their own observability.
 */
export async function issuePasswordResetOtp(userId: string): Promise<string | null> {
  const now = new Date()

  await prisma.passwordReset.deleteMany({
    where: { userId, OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] },
  })

  const sentThisHour = await prisma.passwordReset.count({
    where: { userId, createdAt: { gt: new Date(now.getTime() - HOUR_MS) } },
  })
  if (sentThisHour >= MAX_OTP_CODES_PER_HOUR) return null

  const code = generateOtpCode()
  await prisma.passwordReset.create({
    data: {
      userId,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    },
  })

  return code
}

/**
 * Validates a raw code against the user's most recent unused, unexpired code.
 * Wrong guesses increment `attempts`; after `MAX_OTP_ATTEMPTS` the row is
 * destroyed. Returns `true` and marks the code used on success.
 */
export async function consumePasswordResetOtp(userId: string, rawCode: string): Promise<boolean> {
  const reset = await prisma.passwordReset.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!reset) return false

  const valid = codesMatch(rawCode, reset.codeHash)
  if (!valid) {
    // Destroy the code once the guess budget is spent.
    if (reset.attempts + 1 >= MAX_OTP_ATTEMPTS) {
      await prisma.passwordReset.delete({ where: { id: reset.id } })
    } else {
      await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: reset.attempts + 1 } })
    }
    return false
  }

  await prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } })
  return true
}