/*
  Warnings:

  - You are about to drop the column `days` on the `CarpoolRoute` table. All the data in the column will be lost.
  - You are about to drop the column `destination` on the `CarpoolRoute` table. All the data in the column will be lost.
  - You are about to drop the column `startPoint` on the `CarpoolRoute` table. All the data in the column will be lost.
  - Added the required column `destinationAddress` to the `CarpoolRoute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destinationLat` to the `CarpoolRoute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destinationLng` to the `CarpoolRoute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `morningDistanceKm` to the `CarpoolRoute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `morningDurationMin` to the `CarpoolRoute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `morningPolyline` to the `CarpoolRoute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `CarpoolRoute` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RouteType" AS ENUM ('RECURRING', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('MORNING', 'RETURN');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');

-- AlterTable
ALTER TABLE "CarpoolRoute" DROP COLUMN "days",
DROP COLUMN "destination",
DROP COLUMN "startPoint",
ADD COLUMN     "destinationAddress" TEXT NOT NULL,
ADD COLUMN     "destinationLat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "destinationLng" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "hasReturn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "morningDistanceKm" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "morningDurationMin" INTEGER NOT NULL,
ADD COLUMN     "morningPolyline" TEXT NOT NULL,
ADD COLUMN     "oneTimeDate" TIMESTAMP(3),
ADD COLUMN     "recurringDays" TEXT[],
ADD COLUMN     "returnPolyline" TEXT,
ADD COLUMN     "returnSeatsAvailable" INTEGER,
ADD COLUMN     "type" "RouteType" NOT NULL;

-- CreateTable
CREATE TABLE "CarpoolRequest" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "seekerId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "pickupLat" DOUBLE PRECISION NOT NULL,
    "pickupLng" DOUBLE PRECISION NOT NULL,
    "distanceFromRoute" DOUBLE PRECISION NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CarpoolRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideSession" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "offererTelegramId" BIGINT NOT NULL,
    "direction" "Direction" NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "RideSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideSessionMember" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "riderTelegramId" BIGINT NOT NULL,
    "riderName" TEXT NOT NULL,
    "riderFlat" TEXT NOT NULL,
    "locationMessageId" INTEGER NOT NULL,

    CONSTRAINT "RideSessionMember_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CarpoolRequest" ADD CONSTRAINT "CarpoolRequest_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CarpoolRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpoolRequest" ADD CONSTRAINT "CarpoolRequest_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideSession" ADD CONSTRAINT "RideSession_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CarpoolRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideSessionMember" ADD CONSTRAINT "RideSessionMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RideSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
