-- CreateTable
CREATE TABLE "Resident" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "telegramUsername" TEXT,
    "name" TEXT NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT,
    "model" TEXT,
    "parkingSlot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRecommendation" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "rating" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicroService" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicroService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarpoolRoute" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startPoint" TEXT,
    "departureTime" TEXT NOT NULL,
    "returnTime" TEXT,
    "seatsAvailable" INTEGER NOT NULL,
    "days" TEXT[],
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarpoolRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSession" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "sessionData" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Resident_telegramId_key" ON "Resident"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_number_key" ON "Vehicle"("number");

-- CreateIndex
CREATE UNIQUE INDEX "MicroService_residentId_key" ON "MicroService"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "BotSession_telegramId_key" ON "BotSession"("telegramId");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRecommendation" ADD CONSTRAINT "WorkerRecommendation_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroService" ADD CONSTRAINT "MicroService_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpoolRoute" ADD CONSTRAINT "CarpoolRoute_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSession" ADD CONSTRAINT "BotSession_telegramId_fkey" FOREIGN KEY ("telegramId") REFERENCES "Resident"("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE;
