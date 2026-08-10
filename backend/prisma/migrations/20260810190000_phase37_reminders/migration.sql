-- Phase 37, Step 94 — reminder job dedupe flags.
-- Set once per donation when each in-app reminder fires (upcoming pickup,
-- pending NGO acceptance, food nearing expiry), so periodic sweeps never
-- re-remind the same people. Mirrors the existing rescueNotifiedAt pattern.

-- AlterTable
ALTER TABLE "donations" ADD COLUMN "pickupReminderSentAt" TIMESTAMP(3),
ADD COLUMN "requestReminderSentAt" TIMESTAMP(3),
ADD COLUMN "expiryReminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "donations_status_pickupTime_idx" ON "donations"("status", "pickupTime");
