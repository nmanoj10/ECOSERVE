-- Phase 29 — "Volunteer approaching" notification dedupe (Step 75).
-- Set once per delivery when the approaching alert fires, so repeated GPS
-- pings never spam the NGO/donor.

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN "approachingNotifiedAt" TIMESTAMP(3);
