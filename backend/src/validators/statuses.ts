/** Lifecycle of a food donation listing — mirrors the Prisma DonationStatus enum. */
export const donationStatuses = ['AVAILABLE', 'RESERVED', 'PICKED_UP', 'DELIVERED', 'EXPIRED', 'CANCELLED'] as const

/** Phase 22 — lifecycle of a delivery run, mirrors the updated DeliveryStatus enum. */
export const deliveryStatuses = [
  'PENDING',
  'AVAILABLE',
  'ACCEPTED',
  'VOLUNTEER_ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
] as const

/** Discriminated-union type for the delivery state machine values. */
export type DeliveryStatus = (typeof deliveryStatuses)[number]

/**
 * Forward-only ordered flow (Step 62). CANCELLED is excluded from the flow
 * chain — it is a terminal state reachable from any non-terminal state.
 */
const DELIVERY_FLOW: ['PENDING', 'AVAILABLE', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'] = [
  'PENDING',
  'AVAILABLE',
  'ACCEPTED',
  'VOLUNTEER_ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
]

/**
 * Step 62 — validates a transition in the delivery state machine.
 *
 * - Forward moves (single- or multi-step) along the flow chain are allowed.
 * - CANCELLED is allowed from any non-terminal, non-cancelled state.
 * - Backward moves (e.g. DELIVERED → PENDING) are rejected.
 * - Staying in the same state is allowed (idempotent call).
 */
export function canTransitionDelivery(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (from === to) return true
  if (to === 'CANCELLED') return from !== 'CANCELLED' && from !== 'DELIVERED'

  const fromIndex = DELIVERY_FLOW.indexOf(from as (typeof DELIVERY_FLOW)[number])
  const toIndex = DELIVERY_FLOW.indexOf(to as (typeof DELIVERY_FLOW)[number])
  return fromIndex >= 0 && toIndex > fromIndex
}
