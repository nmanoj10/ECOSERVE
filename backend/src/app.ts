import express from 'express'
import morgan from 'morgan'

import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFoundHandler } from './middleware/notFound.js'
import { corsMiddleware, securityHeaders } from './middleware/security.js'
import { rootRouter } from './routes/index.js'

export function createApp(): express.Express {
  const app = express()

  // Phase 35, Step 89 — trust the first hop only when TRUST_PROXY=true (the
  // app sits behind Render/Railway/nginx). Express-rate-limit then reads real
  // client IPs from X-Forwarded-For; on a direct deployment the header stays
  // untrusted so it can't be spoofed to bypass rate limits.
  if (env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1)
  }

  // Security: hardened headers + CORS allowlist (Phase 35, Step 89).
  app.use(securityHeaders)
  app.use(corsMiddleware)

  // Body parsing with explicit request limits (Phase 35, Step 89). `strict`
  // accepts only objects/arrays; the 1 MB cap bounds memory per request.
  app.use(express.json({ limit: '1mb', strict: true }))
  app.use(express.urlencoded({ extended: true, limit: '100kb' }))

  // Logging
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  // Routes
  app.use(rootRouter)

  // 404 + centralized error handling
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
