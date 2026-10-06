-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "donationId" TEXT;

-- CreateIndex
CREATE INDEX "notifications_donationId_idx" ON "notifications"("donationId");
