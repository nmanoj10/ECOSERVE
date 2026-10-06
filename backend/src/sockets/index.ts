import type { Server as HttpServer } from 'node:http'

import { Server } from 'socket.io'
import type { Socket } from 'socket.io'

import { prisma } from '../config/prisma.js'
import { verifyLocalToken } from '../config/supabase.js'
import { allowedOrigins } from '../middleware/security.js'
import { haversineKm } from '../utils/geo.js'
import { submitLocationSchema } from '../validators/location.js'
import { maybeNotifyApproaching } from '../services/deliveryService.js'

/**
 * Phase 27, Step 71 — persistence throttle knobs.
 * GPS events still broadcast to the delivery room in real time, but we only
 * write a row to `delivery_locations` every SAVE_INTERVAL_MS or when the
 * volunteer has moved more than MOVE_THRESHOLD_KM (meaningful movement).
 */
const SAVE_INTERVAL_MS = 15_000
const MOVE_THRESHOLD_KM = 0.05 // ~50 m

/** Last persisted sample per delivery: { timestamp, latitude, longitude }. */
const lastSaved = new Map<string, { timestamp: number; latitude: number; longitude: number }>()

/**
 * Checks whether `userId` is allowed to observe a delivery room. The
 * authorised participants are:
 *   - the assigned volunteer
 *   - the donor who posted the donation
 *   - the NGO that accepted the donation
 */
async function canAccessDelivery(userId: string, deliveryId: string): Promise<boolean> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      assignment: {
        include: {
          volunteer: { select: { userId: true } },
          donation: {
            include: {
              donor: { select: { userId: true } },
              requests: {
                where: { status: 'ACCEPTED' },
                take: 1,
                include: { ngo: { select: { userId: true } } },
              },
            },
          },
        },
      },
    },
  })

  if (!delivery) return false

  const { assignment } = delivery
  if (assignment.volunteer.userId === userId) return true
  if (assignment.donation.donor.userId === userId) return true
  if (assignment.donation.requests[0]?.ngo.userId === userId) return true

  return false
}

/**
 * Attaches Socket.IO to the HTTP server (Step 67).
 *
 * Every socket authenticates with the same Supabase JWT the REST API uses and
 * joins a `user:{id}` room so server jobs (rescue notifications, assignment
 * events) can push straight to the right person.
 *
 * Phase 26, Step 68 — delivery-specific rooms (`delivery:{id}`) let the
 * volunteer, donor and NGO share real-time GPS data without polling.
 */
export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    // Phase 35, Step 89 — reuse the same CORS allowlist as the REST API so the
    // realtime handshake honors exactly the same origins.
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined
      if (!token) throw new Error('Missing token')
      const payload = await verifyLocalToken(token)
      socket.data.userId = payload.sub
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string
    socket.join(`user:${userId}`)

    // ── Phase 26, Step 68 — delivery rooms ──────────────────────────────

    /** Join a delivery room. Only authorised participants may join. */
    socket.on('delivery:join', async (deliveryId: string) => {
      const allowed = await canAccessDelivery(userId, deliveryId)
      if (!allowed) {
        socket.emit('delivery:error', { message: 'You are not authorised to observe this delivery' })
        return
      }
      socket.join(`delivery:${deliveryId}`)
    })

    /** Leave a delivery room. */
    socket.on('delivery:leave', async (deliveryId: string) => {
      socket.leave(`delivery:${deliveryId}`)
    })

    // ── Phase 26, Step 69 — GPS via Socket.IO ───────────────────────────

    /**
     * The volunteer emits their current GPS position. The server validates
     * the data, persists it to `delivery_locations`, and broadcasts it to
     * every socket in the `delivery:{id}` room (NGO + donor).
     */
    socket.on('delivery:gps', async (raw: unknown) => {
      const parsed = submitLocationSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit('delivery:error', { message: 'Invalid GPS data', errors: parsed.error.flatten().fieldErrors })
        return
      }

      const data = parsed.data
      const deliveryId: string | undefined = (raw as Record<string, unknown>).deliveryId as string | undefined
      if (!deliveryId) {
        socket.emit('delivery:error', { message: 'deliveryId is required' })
        return
      }

      // Only the assigned volunteer may send GPS for this delivery. The
      // include also carries the full assignment shape needed by the shared
      // approaching alert (donor + accepted NGO + volunteer name).
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          assignment: {
            include: {
              volunteer: { include: { user: { select: { fullName: true } } } },
              donation: {
                include: {
                  donor: { select: { userId: true } },
                  requests: {
                    where: { status: 'ACCEPTED' },
                    take: 1,
                    include: { ngo: { select: { userId: true, ngoName: true, latitude: true, longitude: true } } },
                  },
                },
              },
            },
          },
        },
      })
      if (!delivery || delivery.assignment.volunteer.userId !== userId) {
        socket.emit('delivery:error', { message: 'Only the assigned volunteer can send GPS data' })
        return
      }
      if (delivery.status !== 'IN_TRANSIT') {
        socket.emit('delivery:error', { message: 'GPS tracking is only active while the delivery is in transit' })
        return
      }

      // Phase 27, Step 71 — persist periodically or after meaningful movement.
      // The event still broadcasts to the room immediately; only the DB write
      // is throttled so `delivery_locations` doesn't grow with every fix.
      const previous = lastSaved.get(deliveryId)
      const now = Date.now()
      const moved =
        previous == null ||
        haversineKm(previous.latitude, previous.longitude, data.latitude, data.longitude) > MOVE_THRESHOLD_KM
      const due = previous == null || now - previous.timestamp >= SAVE_INTERVAL_MS

      let recordTimestamp = data.timestamp ? new Date(data.timestamp) : new Date()

      if (moved && due) {
        const record = await prisma.deliveryLocation.create({
          data: {
            deliveryId,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy ?? null,
            speed: data.speed ?? null,
            heading: data.heading ?? null,
            timestamp: recordTimestamp,
          },
        })
        lastSaved.set(deliveryId, {
          timestamp: now,
          latitude: data.latitude,
          longitude: data.longitude,
        })
        recordTimestamp = record.timestamp
      }

      // Broadcast to everyone in the delivery room (volunteer included).
      io.to(`delivery:${deliveryId}`).emit('delivery:location', {
        deliveryId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy ?? null,
        speed: data.speed ?? null,
        heading: data.heading ?? null,
        timestamp: recordTimestamp.toISOString(),
      })

      // Phase 29, Step 75 — the same once-only approaching alert the REST GPS
      // endpoint fires, so the realtime channel behaves identically (this is
      // the path the volunteer app actually uses).
      await maybeNotifyApproaching(delivery, data.latitude, data.longitude)
    })

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`)
    })
  })

  return io
}