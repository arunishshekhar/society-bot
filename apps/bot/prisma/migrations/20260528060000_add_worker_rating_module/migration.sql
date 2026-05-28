-- Step 1: Add workerCode as nullable first so existing rows don't fail
ALTER TABLE "WorkerRecommendation" ADD COLUMN "workerCode" TEXT;

-- Step 2: Backfill existing rows with unique random 3-char codes
UPDATE "WorkerRecommendation"
SET "workerCode" = upper(
  chr(65 + floor(random()*26)::int) ||
  chr(48 + floor(random()*10)::int) ||
  chr(65 + floor(random()*26)::int)
)
WHERE "workerCode" IS NULL;

-- Step 3: Make it required and unique
ALTER TABLE "WorkerRecommendation" ALTER COLUMN "workerCode" SET NOT NULL;
CREATE UNIQUE INDEX "WorkerRecommendation_workerCode_key" ON "WorkerRecommendation"("workerCode");

-- Step 4: Rename rating → avgRating (Float)
ALTER TABLE "WorkerRecommendation" RENAME COLUMN "rating" TO "avgRating";
ALTER TABLE "WorkerRecommendation" ALTER COLUMN "avgRating" TYPE DOUBLE PRECISION USING "avgRating"::DOUBLE PRECISION;

-- Step 5: Create WorkerRating table
CREATE TABLE "WorkerRating" (
    "id"         TEXT NOT NULL,
    "workerId"   TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "stars"      INTEGER NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerRating_pkey" PRIMARY KEY ("id")
);

-- Step 6: Unique constraint (one rating per resident per worker)
CREATE UNIQUE INDEX "WorkerRating_workerId_residentId_key" ON "WorkerRating"("workerId", "residentId");

-- Step 7: Foreign keys
ALTER TABLE "WorkerRating" ADD CONSTRAINT "WorkerRating_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "WorkerRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerRating" ADD CONSTRAINT "WorkerRating_residentId_fkey"
    FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
