import type { Server } from 'socket.io'

/**
 * Shared Socket.IO reference. Set once at boot (server.ts), then any service
 * (rescue sweep, assignment creation, …) can push realtime events to a user's
 * `user:{id}` room without threading `io` through every call site.
 */
let ioRef: Server | null = null

export function setRealtime(io: Server): void {
  ioRef = io
}

export function getRealtime(): Server | null {
  return ioRef
}

/** Emits `payload` to every socket of a signed-in user. No-op when unset. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  ioRef?.to(`user:${userId}`).emit(event, payload)
}
