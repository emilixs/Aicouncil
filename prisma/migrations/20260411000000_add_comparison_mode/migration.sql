-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('DISCUSSION', 'COMPARISON');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "type" "SessionType" NOT NULL DEFAULT 'DISCUSSION';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "durationMs" INTEGER,
ADD COLUMN "tokenCount" INTEGER,
ADD COLUMN "modelUsed" TEXT;

-- CreateIndex
CREATE INDEX "Session_type_idx" ON "Session"("type");
