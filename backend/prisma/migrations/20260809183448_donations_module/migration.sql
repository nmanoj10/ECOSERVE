-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'PICKED_UP', 'DELIVERED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "food_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "preparedAt" TIMESTAMP(3),
    "expiryTime" TIMESTAMP(3),
    "pickupTime" TIMESTAMP(3),
    "pickupAddress" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "freshnessScore" DOUBLE PRECISION,
    "safeHours" DOUBLE PRECISION,
    "spoilageRisk" TEXT,
    "priority" INTEGER,
    "status" "DonationStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_images" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "fileId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ngo_requests" (
    "id" TEXT NOT NULL,
    "ngoId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "ngo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_assignments" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "pickupTime" TIMESTAMP(3),
    "deliveryTime" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "volunteer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "food_categories_name_key" ON "food_categories"("name");

-- CreateIndex
CREATE INDEX "donations_status_idx" ON "donations"("status");

-- CreateIndex
CREATE INDEX "donations_categoryId_idx" ON "donations"("categoryId");

-- CreateIndex
CREATE INDEX "donation_images_donationId_idx" ON "donation_images"("donationId");

-- CreateIndex
CREATE INDEX "ngo_requests_donationId_status_idx" ON "ngo_requests"("donationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ngo_requests_ngoId_donationId_key" ON "ngo_requests"("ngoId", "donationId");

-- CreateIndex
CREATE INDEX "volunteer_assignments_donationId_idx" ON "volunteer_assignments"("donationId");

-- CreateIndex
CREATE INDEX "volunteer_assignments_volunteerId_idx" ON "volunteer_assignments"("volunteerId");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "food_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_images" ADD CONSTRAINT "donation_images_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "donations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ngo_requests" ADD CONSTRAINT "ngo_requests_ngoId_fkey" FOREIGN KEY ("ngoId") REFERENCES "ngos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ngo_requests" ADD CONSTRAINT "ngo_requests_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "donations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "donations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
