import type { ErrorRequestHandler } from 'express'

import { env } from '../config/env.js'
import { HttpError } from '../utils/HttpError.js'

/**
 * The HTTP error contract the platform guarantees (Phase 34, Step 87).
 * Every error response is `{ error: { code, message } }` — the `code` is a
 * stable machine-readable token, the `message` is safe to show to clients.
 *
 * App code throws `HttpError(status, code, message)` for expected failures
 * (400 validation, 401 auth, 403 roles, 404 missing, 409 conflicts, 422
 * unprocessable). The middleware below maps anything else to one of these
 * classes with a safe fallback message.
 */
const STATUS_FALLBACKS: Record<number, { code: string; message: string }> = {
  400: { code: 'BAD_REQUEST', message: 'The request was malformed or invalid.' },
  401: { code: 'UNAUTHORIZED', message: 'Authentication is required to access this resource.' },
  403: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource.' },
  404: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  409: { code: 'CONFLICT', message: 'The request conflicts with the current state of the resource.' },
  422: { code: 'UNPROCESSABLE_ENTITY', message: 'The request could not be processed.' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
  500: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our end. Please try again.' },
}

/** A body-parser / JSON failure (malformed JSON, oversized payload, …). */
interface BodyParserError {
  type?: string
  status?: number
  expose?: boolean
}

function logError(status: number, code: string, message: string, method: string, path: string): void {
  if (env.NODE_ENV === 'test') return
  console.error(`[error] ${status} ${code} — ${message} (${method} ${path})`)
}

/**
 * Centralized error middleware (Phase 34, Step 87).
 *
 * Order of resolution:
 *   1. `HttpError` — the app's expected failures, passed through untouched.
 *   2. Body-parser failures — malformed JSON → 400 INVALID_JSON, oversized
 *      bodies → 413 PAYLOAD_TOO_LARGE.
 *   3. Everything else — an unexpected 500. The real error (with stack) is
 *      logged server-side; the client only ever sees the generic fallback.
 * Internal details are never leaked to the client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    // Headers are already out — nothing left to do but hand off.
    next(err)
    return
  }

  // 1. App-level expected errors.
  if (err instanceof HttpError) {
    logError(err.status, err.code, err.message, req.method, req.originalUrl)
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }

  // 2. Body-parser failures.
  if (err && typeof err === 'object') {
    const bodyError = err as BodyParserError
    if (bodyError.type === 'entity.parse.failed') {
      logError(400, 'INVALID_JSON', 'Malformed JSON in request body', req.method, req.originalUrl)
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } })
      return
    }
    if (bodyError.type === 'entity.too.large') {
      logError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the size limit', req.method, req.originalUrl)
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } })
      return
    }
  }

  // 2b. Any other library error that explicitly asks to be exposed (body-parser
  // sets `expose` on its 4xx failures) is mapped to a documented fallback so a
  // future parser can't silently turn into a 500.
  if (err && typeof err === 'object') {
    const bodyError = err as BodyParserError
    if (bodyError.expose && bodyError.status && bodyError.status >= 400 && bodyError.status < 500) {
      const fallback =
        STATUS_FALLBACKS[bodyError.status] ?? { code: 'BAD_REQUEST', message: 'The request could not be processed.' }
      logError(bodyError.status, fallback.code, fallback.message, req.method, req.originalUrl)
      res.status(bodyError.status).json({ error: fallback })
      return
    }
  }

  // 3. Unexpected — 500 with a safe, generic client message.
  if (env.NODE_ENV !== 'test') {
    console.error(`[error] 500 INTERNAL_ERROR — ${req.method} ${req.originalUrl}`, err)
  }
  res.status(500).json({ error: STATUS_FALLBACKS[500] })
}
