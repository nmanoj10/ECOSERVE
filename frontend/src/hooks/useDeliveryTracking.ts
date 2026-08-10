import { useCallback, useEffect, useRef, useState } from 'react'

import type { GpsSample } from '@/api/volunteer'
import {
  connectSocket,
  disconnectSocket,
  joinDeliveryRoom,
  leaveDeliveryRoom,
  sendGpsPosition,
} from '@/services/socket'

export interface TrackingState {
  /** Whether the GPS watcher is currently active. */
  isTracking: boolean
  /** The most recent position received from the browser (or null). */
  position: GpsSample | null
  /** Human-readable error string if geolocation failed, or null. */
  error: string | null
}

/**
 * Phase 25 & 26 — Tracks the volunteer's GPS position during an active
 * delivery and broadcasts it in real time via Socket.IO.
 *
 * Starts `navigator.geolocation.watchPosition` only when `isActive` becomes
 * `true` (typically when the delivery reaches `IN_TRANSIT`). Each position
 * is throttled and emitted on the socket (→ server persists + broadcasts to
 * the `delivery:{id}` room).  The watcher is torn down on unmount or when
 * `isActive` becomes `false`.
 */
export function useDeliveryTracking(
  deliveryId: string | null | undefined,
  isActive: boolean,
): TrackingState {
  const [position, setPosition] = useState<GpsSample | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)

  // Ref to the last-time we sent so we can throttle.
  const lastSentRef = useRef(0)
  // Ref to the latest position so the throttle closure always has fresh data.
  const latestRef = useRef<GpsSample | null>(null)

  const sendPosition = useCallback(async (sample: GpsSample) => {
    if (!deliveryId) return
    sendGpsPosition(deliveryId, sample)
  }, [deliveryId])

  useEffect(() => {
    if (!deliveryId || !isActive) {
      setIsTracking(false)
      return
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser')
      return
    }

    let cleanup: (() => void) | undefined

    const init = async () => {
      // Phase 26, Step 68 — connect socket + join the delivery room for
      // real-time broadcasting so the donor and NGO receive updates.
      await connectSocket()
      joinDeliveryRoom(deliveryId)

      setIsTracking(true)
      setError(null)

      const onSuccess = (pos: GeolocationPosition) => {
        const sample: GpsSample = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed ?? undefined,
          heading: pos.coords.heading ?? undefined,
          timestamp: new Date(pos.timestamp).toISOString(),
        }

        setPosition(sample)
        latestRef.current = sample

        // Throttle: send at most once every 10 seconds.
        const now = Date.now()
        if (now - lastSentRef.current >= 10_000) {
          lastSentRef.current = now
          sendPosition(sample)
        }
      }

      const onError = (err: GeolocationPositionError) => {
        setError(err.message ?? 'Failed to get location')
      }

      const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      })

      cleanup = () => {
        navigator.geolocation.clearWatch(watchId)
        leaveDeliveryRoom(deliveryId)
        disconnectSocket()
        setIsTracking(false)
      }
    }

    void init()

    return () => {
      cleanup?.()
    }
  }, [deliveryId, isActive, sendPosition])

  // Flush the last sample on deactivation so the final GPS position is stored.
  useEffect(() => {
    if (!isActive && latestRef.current) {
      const sample = latestRef.current
      lastSentRef.current = 0
      sendGpsPosition(deliveryId ?? '', sample)
    }
  }, [isActive, deliveryId])

  return { isTracking, position, error }
}