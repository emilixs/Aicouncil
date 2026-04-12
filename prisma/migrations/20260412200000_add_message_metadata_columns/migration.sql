-- AlterTable
ALTER TABLE "Message" ADD COLUMN "roundNumber" INTEGER,
ADD COLUMN "promptTokens" INTEGER,
ADD COLUMN "completionTokens" INTEGER,
ADD COLUMN "totalTokens" INTEGER,
ADD COLUMN "model" TEXT,
ADD COLUMN "responseTimeMs" INTEGER,
ADD COLUMN "finishReason" TEXT;
