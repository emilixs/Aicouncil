-- AlterTable
ALTER TABLE "Session" ADD COLUMN "consensusThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8;

-- CreateTable
CREATE TABLE "DiscussionOutcome" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "decisions" JSONB NOT NULL,
    "actionItems" JSONB NOT NULL,
    "keyArguments" JSONB NOT NULL,
    "openQuestions" JSONB NOT NULL,
    "finalEvaluation" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,

    CONSTRAINT "DiscussionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsensusEvaluation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "convergenceScore" DOUBLE PRECISION NOT NULL,
    "consensusReached" BOOLEAN NOT NULL,
    "areasOfAgreement" JSONB NOT NULL,
    "areasOfDisagreement" JSONB NOT NULL,
    "progressAssessment" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsensusEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "proposal" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionOutcome_sessionId_key" ON "DiscussionOutcome"("sessionId");

-- CreateIndex
CREATE INDEX "ConsensusEvaluation_sessionId_idx" ON "ConsensusEvaluation"("sessionId");

-- CreateIndex
CREATE INDEX "ConsensusEvaluation_sessionId_roundNumber_idx" ON "ConsensusEvaluation"("sessionId", "roundNumber");

-- CreateIndex
CREATE INDEX "Poll_sessionId_idx" ON "Poll"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_expertId_key" ON "PollVote"("pollId", "expertId");

-- CreateIndex
CREATE INDEX "PollVote_pollId_idx" ON "PollVote"("pollId");

-- AddForeignKey
ALTER TABLE "DiscussionOutcome" ADD CONSTRAINT "DiscussionOutcome_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsensusEvaluation" ADD CONSTRAINT "ConsensusEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
