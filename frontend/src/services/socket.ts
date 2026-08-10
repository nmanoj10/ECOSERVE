import { io, type Socket } from 'socket.io-client'

import type { GpsSample } from '@/api/volunteer'
import { supabase } from './supabase'

let socket: Socket | null = null

function baseUrl(): string {
  const socketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined
  if (socketUrl) return socketUrl

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined
  if (apiUrl) return apiUrl.replace(/\/api\/?$/, '')

  return window.location.origin
}

/**
 * Connects the authenticated socket (idempotent). The backend requires the
 * same Supabase JWT the REST API uses, so we attach it in the handshake.
 * Returns `null` when there is no active session.
 */
export async function connectSocket(): Promise<Socket | null> {
  if (socket?.connected) return socket

  // Reuse the instance when one exists (e.g. a failed first attempt) instead
  // of leaking a new Socket on every call.
  if (socket) {
    socket.connect()
    return socket
  }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null

  // Note: the token is attached at connect time; a long-lived tab reconnects
  // on refresh-token rotation via the REST interceptor, but the socket won't
  // re-auth until the next connect — acceptable for now.
  socket = io(baseUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
  })
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}

/**
 * Returns the current socket instance, or `null` if not connected.
 * Useful for ad-hoc calls outside the hook lifecycle.
 */
export function getSocket(): Socket | null {
  return socket?.connected ? socket : null
}

// ── Phase 26, Step 68 — Delivery room helpers ─────────────────────────────

/**
 * Joins the `delivery:{id}` room so the user receives real-time location
 * updates (and can send GPS if they are the assigned volunteer).
 * Connects the socket first if needed.
 */
export async function joinDeliveryRoom(deliveryId: string): Promise<void> {
  const s = await connectSocket()
  s?.emit('delivery:join', deliveryId)
}

/** Leaves the `delivery:{id}` room. */
export function leaveDeliveryRoom(deliveryId: string): void {
  socket?.emit('delivery:leave', deliveryId)
}

// ── Phase 26, Step 69 — GPS emission via Socket.IO ────────────────────────

/**
 * Sends the volunteer's GPS sample through the socket to the server, which
 * persists it and broadcasts it to everyone in `delivery:{id}`.
 */
export function sendGpsPosition(deliveryId: string, sample: GpsSample): void {
  if (!socket?.connected) return
  socket.emit('delivery:gps', {
    deliveryId,
    ...sample,
    timestamp: sample.timestamp ?? new Date().toISOString(),
  })
}