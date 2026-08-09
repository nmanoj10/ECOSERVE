import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFoundHandler } from './middleware/notFound.js'
import { rootRouter } from './routes/index.js'

export function createApp(): express.Express {
  const app = express()

  // Security
  app.use(helmet())
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  )

  // Body parsing
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  // Logging
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  // Routes
  app.use(rootRouter)

  // 404 + centralized error handling
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
