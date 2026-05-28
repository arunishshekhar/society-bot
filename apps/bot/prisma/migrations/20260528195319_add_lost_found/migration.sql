-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "FoundItem" (
    "id" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "originalDescription" TEXT NOT NULL,
    "aiDescription" TEXT NOT NULL,
    "imageFileId" TEXT NOT NULL,
    "collectionLocation" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoundItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostItem" (
    "id" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "originalDescription" TEXT NOT NULL,
    "aiDescription" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostFoundMatch" (
    "id" TEXT NOT NULL,
    "foundItemId" TEXT NOT NULL,
    "lostItemId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LostFoundMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoundItem_status_idx" ON "FoundItem"("status");

-- CreateIndex
CREATE INDEX "LostItem_status_idx" ON "LostItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LostFoundMatch_foundItemId_lostItemId_key" ON "LostFoundMatch"("foundItemId", "lostItemId");

-- AddForeignKey
ALTER TABLE "FoundItem" ADD CONSTRAINT "FoundItem_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundItem" ADD CONSTRAINT "FoundItem_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostItem" ADD CONSTRAINT "LostItem_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostItem" ADD CONSTRAINT "LostItem_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundMatch" ADD CONSTRAINT "LostFoundMatch_foundItemId_fkey" FOREIGN KEY ("foundItemId") REFERENCES "FoundItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundMatch" ADD CONSTRAINT "LostFoundMatch_lostItemId_fkey" FOREIGN KEY ("lostItemId") REFERENCES "LostItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
