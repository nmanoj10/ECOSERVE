import type { NextFunction, Request, Response } from 'express'
import { rateLimit, type Options } from 'express-rate-limit'

import { HttpError } from '../utils/HttpError.js'

/**
 * Shared 429 handler (Phase 34, Step 87). Instead of the limiter writing its
 * own response body, it throws through the centralized error middleware so
 * rate-limit rejections keep the exact same `{ error: { code, message } }`
 * contract (and log line) as every other error.
 */
function tooManyRequests(_req: Request, res: Response, next: NextFunction, options: Options): void {
  res.setHeader('Retry-After', String(Math.ceil(options.windowMs / 1000)))
  next(new HttpError(429, 'RATE_LIMITED', 'Too many requests, please try again later.'))
}

/** Global limiter applied to all /api/v1 routes. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests,
})

/** Stricter limiter for authentication endpoints (brute-force protection). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests,
})
