import { createServer } from 'node:http'

import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './config/prisma.js'
import { startAnalyticsJob } from './jobs/analyticsJob.js'
import { startExpiryJob } from './jobs/expiryJob.js'
import { startReminderJob } from './jobs/reminderJob.js'
import { startRescueJob } from './jobs/rescueJob.js'
import { setRealtime } from './services/realtime.js'
import { attachSocketServer } from './sockets/index.js'

const app = createApp()
const httpServer = createServer(app)
const io = attachSocketServer(httpServer)

// Shared realtime handle for in-app notifications (rescue, assignments, …).
setRealtime(io)

// Phase 19 — periodic rescue sweep for unclaimed expiring food.
startRescueJob()
// Phase 37 — expiry, reminder, and daily analytics background jobs.
startExpiryJob()
startReminderJob()
startAnalyticsJob()

httpServer.listen(env.PORT, () => {
  console.log(`🚀 Ecoserve backend listening on http://localhost:${env.PORT}`)
})

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[server] received ${signal}, shutting down…`)

  io.close()

  const timeout = setTimeout(() => process.exit(1), 10_000)
  timeout.unref()

  httpServer.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
