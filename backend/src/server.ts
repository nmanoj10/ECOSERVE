import { createServer } from 'node:http'

import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './config/prisma.js'
import { attachSocketServer } from './sockets/index.js'

const app = createApp()
const httpServer = createServer(app)
const io = attachSocketServer(httpServer)

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
