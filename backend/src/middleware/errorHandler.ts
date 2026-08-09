import type { ErrorRequestHandler } from 'express'

import { env } from '../config/env.js'
import { HttpError } from '../utils/HttpError.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500
  const code = err instanceof HttpError ? err.code : 'INTERNAL_ERROR'
  const message = err instanceof HttpError ? err.message : 'Something went wrong'

  if (env.NODE_ENV !== 'test') {
    if (err instanceof HttpError) {
      console.error(`[error] ${status} ${code} — ${message}`)
    } else {
      console.error('[error] 500 INTERNAL_ERROR', err)
    }
  }

  res.status(status).json({
    error: { code, message },
  })
}
