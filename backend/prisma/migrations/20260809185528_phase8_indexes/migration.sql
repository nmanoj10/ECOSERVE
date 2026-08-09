-- DropIndex
DROP INDEX "donations_status_idx";

-- CreateIndex
CREATE INDEX "delivery_locations_timestamp_idx" ON "delivery_locations"("timestamp");

-- CreateIndex
CREATE INDEX "donations_status_expiryTime_idx" ON "donations"("status", "expiryTime");

-- CreateIndex
CREATE INDEX "donations_donorId_createdAt_idx" ON "donations"("donorId", "createdAt");

-- CreateIndex
CREATE INDEX "donations_createdAt_idx" ON "donations"("createdAt");

-- CreateIndex
CREATE INDEX "ngos_verificationStatus_idx" ON "ngos"("verificationStatus");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "volunteers_availability_idx" ON "volunteers"("availability");
