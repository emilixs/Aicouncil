-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DriverType" AS ENUM ('OPENAI', 'ANTHROPIC');

-- CreateTable
CREATE TABLE "Expert" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "driverType" "DriverType" NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
    "maxMessages" INTEGER NOT NULL DEFAULT 20,
    "consensusReached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expertId" TEXT,
    "content" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "isIntervention" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExpert" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionExpert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expert_driverType_idx" ON "Expert"("driverType");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Message_sessionId_idx" ON "Message"("sessionId");

-- CreateIndex
CREATE INDEX "Message_expertId_idx" ON "Message"("expertId");

-- CreateIndex
CREATE INDEX "Message_timestamp_idx" ON "Message"("timestamp");

-- CreateIndex
CREATE INDEX "SessionExpert_sessionId_idx" ON "SessionExpert"("sessionId");

-- CreateIndex
CREATE INDEX "SessionExpert_expertId_idx" ON "SessionExpert"("expertId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionExpert_sessionId_expertId_key" ON "SessionExpert"("sessionId", "expertId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExpert" ADD CONSTRAINT "SessionExpert_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExpert" ADD CONSTRAINT "SessionExpert_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
