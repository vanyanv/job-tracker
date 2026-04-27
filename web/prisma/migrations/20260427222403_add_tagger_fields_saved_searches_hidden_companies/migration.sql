-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "level" TEXT,
ADD COLUMN     "locationCity" TEXT,
ADD COLUMN     "locationCountry" TEXT,
ADD COLUMN     "minYoE" INTEGER,
ADD COLUMN     "salaryMax" INTEGER,
ADD COLUMN     "salaryMin" INTEGER,
ADD COLUMN     "stackTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tagModel" TEXT,
ADD COLUMN     "taggedAt" TIMESTAMP(3),
ADD COLUMN     "workMode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hiddenCompanies" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "UserJob" ADD COLUMN     "autoSkippedReason" TEXT;

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSearch_userId_sortIndex_idx" ON "SavedSearch"("userId", "sortIndex");

-- CreateIndex
CREATE INDEX "Job_postedAt_idx" ON "Job"("postedAt");

-- CreateIndex
CREATE INDEX "Job_level_idx" ON "Job"("level");

-- CreateIndex
CREATE INDEX "Job_workMode_idx" ON "Job"("workMode");

-- CreateIndex
CREATE INDEX "Job_locationCountry_idx" ON "Job"("locationCountry");

-- CreateIndex
CREATE INDEX "Job_level_workMode_postedAt_idx" ON "Job"("level", "workMode", "postedAt");

-- CreateIndex
CREATE INDEX "Job_stackTags_idx" ON "Job" USING GIN ("stackTags");

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
