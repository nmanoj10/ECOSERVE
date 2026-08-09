-- DropForeignKey
ALTER TABLE "donations" DROP CONSTRAINT "donations_donorId_fkey";

-- DropIndex
DROP INDEX "donation_images_donationId_idx";

-- DropIndex
DROP INDEX "donations_categoryId_idx";

-- DropIndex
DROP INDEX "volunteer_assignments_donationId_idx";

-- DropIndex
DROP INDEX "volunteer_assignments_volunteerId_idx";

-- CreateIndex
CREATE INDEX "donations_categoryId_status_idx" ON "donations"("categoryId", "status");

-- CreateIndex
CREATE INDEX "volunteer_assignments_volunteerId_status_idx" ON "volunteer_assignments"("volunteerId", "status");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
