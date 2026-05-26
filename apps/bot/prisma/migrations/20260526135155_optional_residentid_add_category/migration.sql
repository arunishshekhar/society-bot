-- DropForeignKey
ALTER TABLE "CarpoolRoute" DROP CONSTRAINT "CarpoolRoute_residentId_fkey";

-- DropForeignKey
ALTER TABLE "MicroService" DROP CONSTRAINT "MicroService_residentId_fkey";

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_residentId_fkey";

-- DropForeignKey
ALTER TABLE "WorkerRecommendation" DROP CONSTRAINT "WorkerRecommendation_residentId_fkey";

-- AlterTable
ALTER TABLE "MicroService" ALTER COLUMN "residentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkerRecommendation" ALTER COLUMN "residentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_type_key" ON "Category"("name", "type");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRecommendation" ADD CONSTRAINT "WorkerRecommendation_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroService" ADD CONSTRAINT "MicroService_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpoolRoute" ADD CONSTRAINT "CarpoolRoute_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
