-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "dropLatitude" DOUBLE PRECISION,
ADD COLUMN     "dropLongitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "rescuePriorityLevel" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locationAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;
