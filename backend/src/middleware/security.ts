import cors from 'cors'
import helmet from 'helmet'

import { env } from '../config/env.js'
import { HttpError } from '../utils/HttpError.js'

/**
 * Phase 35, Step 89 — centralized security middleware.
 *
 * Helmet: safe browser-facing headers on every response. CSP and COEP are
 * disabled deliberately — this server only returns JSON (no HTML to protect),
 * and disabling avoids misleading policy headers that could break the frontend
 * when it embeds images from ImageKit. HSTS, nosniff, frame denial, and the
 * other default protections stay on.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

/**
 * The configured CORS allowlist (defaults to CLIENT_URL, override with the
 * comma-separated CORS_ORIGINS env var). Shared with Socket.IO so the realtime
 * layer honors exactly the same origins as the REST API.
 */
export const allowedOrigins = (env.CORS_ORIGINS ?? env.CLIENT_URL)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

/**
 * CORS middleware: allow only the configured origins and only the
 * methods/headers the API actually uses. Preflight (OPTIONS) is cached for 10
 * minutes. Disallowed origins get a 403 through the centralized error handler
 * instead of a silent missing header.
 */
export const corsMiddleware = cors({
  origin(origin, callback) {
    // No Origin header = same-origin or non-browser request — always allowed.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new HttpError(403, 'FORBIDDEN', 'Origin is not allowed by the CORS policy'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
})
