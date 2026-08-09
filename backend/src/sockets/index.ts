import type { Server as HttpServer } from 'node:http'

import { Server } from 'socket.io'

import { env } from '../config/env.js'

/** Attaches Socket.IO to the HTTP server. Realtime features (delivery tracking, notifications) will live here. */
export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`)

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`)
    })
  })

  return io
}
