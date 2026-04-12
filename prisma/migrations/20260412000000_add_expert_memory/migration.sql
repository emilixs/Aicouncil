-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('SESSION_SUMMARY', 'KEY_INSIGHT', 'USER_NOTE');

-- AlterTable
ALTER TABLE "Expert" ADD COLUMN "memoryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "memoryMaxEntries" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "memoryMaxInject" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "ExpertMemory" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "sessionId" TEXT,
    "type" "MemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpertMemory_expertId_idx" ON "ExpertMemory"("expertId");

-- CreateIndex
CREATE INDEX "ExpertMemory_expertId_relevance_idx" ON "ExpertMemory"("expertId", "relevance");

-- CreateIndex
CREATE INDEX "ExpertMemory_sessionId_idx" ON "ExpertMemory"("sessionId");

-- AddForeignKey
ALTER TABLE "ExpertMemory" ADD CONSTRAINT "ExpertMemory_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertMemory" ADD CONSTRAINT "ExpertMemory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
