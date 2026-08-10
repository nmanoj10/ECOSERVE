-- Phase 22 — Delivery state machine (Steps 61–62).
-- Rename COMPLETED → DELIVERED, then add the intermediate journey states.
-- CANCELLED is retained as a terminal state, reachable from any active state.

-- RenameEnumValue
ALTER TYPE "DeliveryStatus" RENAME VALUE 'COMPLETED' TO 'DELIVERED';

-- AddEnumValue
ALTER TYPE "DeliveryStatus" ADD VALUE 'AVAILABLE';
ALTER TYPE "DeliveryStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "DeliveryStatus" ADD VALUE 'VOLUNTEER_ASSIGNED';
ALTER TYPE "DeliveryStatus" ADD VALUE 'PICKED_UP';