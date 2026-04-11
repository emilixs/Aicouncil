# Async Discussion Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the synchronous discussion loop to async with pause/resume/stop controls and DB-checkpointed crash recovery.

**Architecture:** The blocking `while` loop in `CouncilService.startDiscussion()` becomes a fire-and-forget async state machine that persists progress to PostgreSQL between expert turns. A new `DiscussionStatus` enum (separate from `SessionStatus`) tracks orchestration state. Pause/stop signals are written to DB by REST/WebSocket endpoints; the loop reads them at each turn boundary. On server restart, orphaned sessions are marked FAILED.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Socket.IO, React (Vite frontend)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `DiscussionStatus` enum, checkpoint fields on `Session`, `Intervention` model, `turnOrder` on `SessionExpert` |
| `src/council/events/discussion.events.ts` | Modify | Add `PAUSED`, `STOPPED`, `RESUMED`, `PROGRESS` event constants and interfaces |
| `src/council/council.service.ts` | Modify | Refactor loop to checkpointed state machine; add `pauseDiscussion()`, `stopDiscussion()`, `resumeDiscussion()`, `getProgress()` |
| `src/council/council.controller.ts` | Modify | Change `start` to 202; add `pause`, `resume`, `stop`, `progress` endpoints |
| `src/council/gateways/discussion.gateway.ts` | Modify | Add `pause-discussion`, `stop-discussion` socket handlers; listen for new events |
| `src/session/session.service.ts` | Modify | No changes needed — `SessionStatus` stays the same; `DiscussionStatus` lives on the `Session` model directly |
| `src/session/dto/session-response.dto.ts` | Modify | Expose new `discussionStatus`, `currentRound`, `currentTurnIndex` fields |
| `src/session/dto/update-session.dto.ts` | Modify | Allow `discussionStatus` updates |
| `src/app.module.ts` | Modify | Add `OnApplicationBootstrap` lifecycle hook for crash recovery |
| `frontend/src/types/session.ts` | Modify | Add `DiscussionStatus` enum and new fields to `SessionResponse` |
| `frontend/src/hooks/use-websocket.ts` | Modify | Wire up `discussion-paused`, `discussion-stopped`, `discussion-resumed` events; add `resumeDiscussion` |
| `frontend/src/components/sessions/SessionControls.tsx` | Modify | Add PAUSING/PAUSED/STOPPING/STOPPED/FAILED states; add Resume button |

---

## State Machine Reference

```
         start
idle ──────────► running ──────► completed
                  │    ▲
       (PAUSING)  │    │  resume
                  ▼    │
                 paused
                  │
   (STOPPING)     │  (also from running via STOPPING)
                  ▼
                stopped

         (any state) ──► failed (on unrecoverable error or crash recovery)
```

Intermediate states (`PAUSING`, `STOPPING`) signal intent. The loop transitions to `PAUSED`/`STOPPED` at the next turn boundary.

---

## Task 1: Prisma Schema — DiscussionStatus Enum and Session Fields

**Files:**
- Modify: `prisma/schema.prisma:13-62` (enums and Session model)

- [ ] **Step 1: Add the DiscussionStatus enum after the existing enums (line 31)**

Add this after the `DriverType` enum closing brace:

```prisma
enum DiscussionStatus {
  IDLE
  RUNNING
  PAUSING
  PAUSED
  STOPPING
  STOPPED
  COMPLETED
  FAILED
}
```

- [ ] **Step 2: Add checkpoint fields to the Session model**

Add these fields inside the `Session` model, after `updatedAt` (line 56) and before the relations:

```prisma
  discussionStatus    DiscussionStatus @default(IDLE)
  currentRound        Int              @default(0)
  currentTurnIndex    Int              @default(0)
  totalRounds         Int?
  discussionError     String?          @db.Text
  discussionStartedAt DateTime?
  discussionPausedAt  DateTime?
```

- [ ] **Step 3: Add an index on discussionStatus**

Add this inside the Session model, next to the existing `@@index([status])`:

```prisma
  @@index([discussionStatus])
```

- [ ] **Step 4: Verify schema syntax**

Run: `cd /path/to/Aicouncil && npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "[schema] add DiscussionStatus enum and checkpoint fields to Session"
```

---

## Task 2: Prisma Schema — Intervention Model and SessionExpert turnOrder

**Files:**
- Modify: `prisma/schema.prisma:81-93` (SessionExpert model) and append new model

- [ ] **Step 1: Add turnOrder to SessionExpert**

Add this field inside the `SessionExpert` model, after `joinedAt` (line 85):

```prisma
  turnOrder Int      @default(0)
```

- [ ] **Step 2: Add the Intervention model**

Append this new model at the end of the schema file (after `SessionExpert`):

```prisma
model Intervention {
  id        String   @id @default(cuid())
  sessionId String
  content   String   @db.Text
  userId    String?
  processed Boolean  @default(false)
  createdAt DateTime @default(now())

  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, processed])
}
```

- [ ] **Step 3: Add the interventions relation to the Session model**

Inside the `Session` model, after the `messages` relation, add:

```prisma
  interventions Intervention[]
```

- [ ] **Step 4: Validate and generate migration**

Run:
```bash
npx prisma validate
npx prisma migrate dev --name async-discussion-orchestration
```
Expected: Migration created successfully, Prisma Client generated.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "[schema] add Intervention model and turnOrder to SessionExpert"
```

---

## Task 3: Discussion Events — Add Pause/Stop/Resume Events

**Files:**
- Modify: `src/council/events/discussion.events.ts`

- [ ] **Step 1: Add new event constants to DISCUSSION_EVENTS**

Replace the existing `DISCUSSION_EVENTS` object (lines 6-12) with:

```typescript
export const DISCUSSION_EVENTS = {
  MESSAGE_CREATED: 'discussion.message.created',
  CONSENSUS_REACHED: 'discussion.consensus.reached',
  SESSION_ENDED: 'discussion.session.ended',
  ERROR: 'discussion.error',
  EXPERT_TURN_START: 'discussion.expert.turn.start',
  PAUSED: 'discussion.paused',
  STOPPED: 'discussion.stopped',
  RESUMED: 'discussion.resumed',
  PROGRESS: 'discussion.progress',
} as const;
```

- [ ] **Step 2: Add new event interfaces**

Append these interfaces after the existing `ExpertTurnStartEvent` interface:

```typescript
/**
 * Event emitted when a discussion is paused
 */
export interface DiscussionPausedEvent {
  sessionId: string;
  currentRound: number;
  currentTurnIndex: number;
}

/**
 * Event emitted when a discussion is stopped
 */
export interface DiscussionStoppedEvent {
  sessionId: string;
  currentRound: number;
  currentTurnIndex: number;
  messageCount: number;
}

/**
 * Event emitted when a discussion is resumed
 */
export interface DiscussionResumedEvent {
  sessionId: string;
  currentRound: number;
  currentTurnIndex: number;
}

/**
 * Event emitted for progress updates
 */
export interface DiscussionProgressEvent {
  sessionId: string;
  discussionStatus: string;
  currentRound: number;
  currentTurnIndex: number;
  totalRounds: number | null;
  messageCount: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/council/events/discussion.events.ts
git commit -m "[events] add pause/stop/resume/progress discussion events"
```

---

## Task 4: SessionResponseDto — Expose New Fields

**Files:**
- Modify: `src/session/dto/session-response.dto.ts`
- Modify: `src/session/dto/update-session.dto.ts`

- [ ] **Step 1: Add DiscussionStatus import and new fields to SessionResponseDto**

In `src/session/dto/session-response.dto.ts`, update the Prisma import (line 2) to include `DiscussionStatus`:

```typescript
import { SessionStatus, DiscussionStatus, Session, SessionExpert, Expert } from '@prisma/client';
```

Add these fields after `statusDisplay` (after line 33):

```typescript
  /**
   * Current discussion orchestration status
   */
  @Expose()
  discussionStatus: DiscussionStatus;

  /**
   * Current discussion round (0-indexed)
   */
  @Expose()
  currentRound: number;

  /**
   * Current turn index within the discussion
   */
  @Expose()
  currentTurnIndex: number;

  /**
   * Total planned rounds (null if not set)
   */
  @Expose()
  totalRounds: number | null;

  /**
   * Error message if discussion failed
   */
  @Expose()
  discussionError: string | null;
```

- [ ] **Step 2: Update the fromPrisma factory to include new fields**

In the `fromPrisma` method, add the new fields to the returned object (inside the `new SessionResponseDto({...})` at line 96):

```typescript
      discussionStatus: session.discussionStatus,
      currentRound: session.currentRound,
      currentTurnIndex: session.currentTurnIndex,
      totalRounds: session.totalRounds,
      discussionError: session.discussionError,
```

- [ ] **Step 3: Update the statusDisplayMap for DiscussionStatus-aware display**

In the `fromPrisma` method, after the existing `statusDisplayMap`, add mapping logic so that if `discussionStatus` is `PAUSED`, `statusDisplay` reflects that:

```typescript
    // Override display when discussion has specific state
    let displayStatus = statusDisplayMap[session.status];
    if (session.discussionStatus === 'PAUSED') {
      displayStatus = 'paused';
    } else if (session.discussionStatus === 'STOPPED') {
      displayStatus = 'stopped';
    } else if (session.discussionStatus === 'FAILED') {
      displayStatus = 'failed';
    }
```

Then use `displayStatus` instead of `statusDisplayMap[session.status]` when setting `statusDisplay`.

- [ ] **Step 4: Update UpdateSessionDto to allow discussionStatus**

In `src/session/dto/update-session.dto.ts`, add the import and field:

```typescript
import { IsOptional, IsEnum, IsBoolean, IsString, IsInt } from 'class-validator';
import { SessionStatus, DiscussionStatus } from '@prisma/client';
```

Add these fields after `consensusReached`:

```typescript
  @IsOptional()
  @IsEnum(DiscussionStatus)
  discussionStatus?: DiscussionStatus;

  @IsOptional()
  @IsInt()
  currentRound?: number;

  @IsOptional()
  @IsInt()
  currentTurnIndex?: number;

  @IsOptional()
  @IsInt()
  totalRounds?: number;

  @IsOptional()
  @IsString()
  discussionError?: string;
```

- [ ] **Step 5: Commit**

```bash
git add src/session/dto/session-response.dto.ts src/session/dto/update-session.dto.ts
git commit -m "[dto] expose discussionStatus and checkpoint fields in session DTOs"
```

---

## Task 5: CouncilService — Refactor to Async State Machine

This is the largest task. The blocking `while` loop in `startDiscussion()` becomes a fire-and-forget `runDiscussionLoop()` that checkpoints to DB between turns and checks for pause/stop signals.

**Files:**
- Modify: `src/council/council.service.ts`

- [ ] **Step 1: Update imports**

Replace the import on line 2:

```typescript
import { SessionStatus, MessageRole, DiscussionStatus } from '@prisma/client';
```

Add `PrismaService` import:

```typescript
import { PrismaService } from '../common/prisma.service';
```

- [ ] **Step 2: Add PrismaService to constructor and add active loops tracker**

Update the constructor (lines 33-38) to inject PrismaService:

```typescript
  private activeLoops: Map<string, boolean> = new Map();

  constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly driverFactory: DriverFactory,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}
```

- [ ] **Step 3: Refactor startDiscussion to be non-blocking**

Replace the existing `startDiscussion` method (lines 130-364) with:

```typescript
  /**
   * Start a discussion — validates, transitions to RUNNING, and launches
   * the loop as a fire-and-forget async task.
   *
   * @returns Immediately with the session in RUNNING state (202 semantics)
   */
  async startDiscussion(sessionId: string): Promise<SessionResponseDto> {
    const session = await this.sessionService.findOne(sessionId);

    if (session.status !== SessionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot start discussion for session with status ${session.statusDisplay}. Session must be in pending status.`,
      );
    }

    const experts = session.experts;

    if (experts.length === 0) {
      throw new BadRequestException(
        'Cannot start discussion for session with no experts. Session must have at least one expert.',
      );
    }

    // Pre-validate expert configs and API keys before any state change
    this.logger.log(`Validating ${experts.length} expert configurations...`);
    for (const expert of experts) {
      const expertConfig = plainToInstance(LLMConfig, expert.config);
      const validationErrors = await validate(expertConfig);

      if (validationErrors.length > 0 || !expertConfig.model) {
        throw new BadRequestException(
          `Expert "${expert.name}" (${expert.id}) has invalid config. Missing or invalid required field: model`,
        );
      }

      try {
        this.driverFactory.createDriver(expert.driverType);
      } catch (error) {
        throw new BadRequestException(
          `Expert "${expert.name}" (${expert.id}) cannot be initialized: ${error.message}`,
        );
      }
    }
    this.logger.log('All expert configurations validated successfully');

    // Transition session to ACTIVE and RUNNING
    await this.sessionService.update(sessionId, { status: SessionStatus.ACTIVE });
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        discussionStatus: DiscussionStatus.RUNNING,
        currentRound: 0,
        currentTurnIndex: 0,
        totalRounds: Math.ceil(session.maxMessages / experts.length),
        discussionStartedAt: new Date(),
        discussionError: null,
      },
    });
    this.logger.log(`Session ${sessionId} transitioned to ACTIVE/RUNNING`);

    // Fire-and-forget the loop
    this.runDiscussionLoop(sessionId).catch((error) => {
      this.logger.error(`Discussion loop failed for session ${sessionId}: ${error.message}`, error.stack);
    });

    return this.sessionService.findOne(sessionId);
  }
```

- [ ] **Step 4: Implement the runDiscussionLoop method**

Add this new method after `startDiscussion`:

```typescript
  /**
   * The core discussion loop. Runs as a detached async task.
   * Checkpoints to DB after each turn and checks for pause/stop signals.
   */
  private async runDiscussionLoop(sessionId: string): Promise<void> {
    this.activeLoops.set(sessionId, true);

    try {
      while (true) {
        // CHECKPOINT: reload session state from DB
        const session = await this.prisma.session.findUnique({
          where: { id: sessionId },
          include: {
            experts: {
              include: { expert: true },
              orderBy: { turnOrder: 'asc' },
            },
          },
        });

        if (!session) {
          this.logger.error(`Session ${sessionId} not found during loop`);
          return;
        }

        // Check for pause/stop signals
        if (session.discussionStatus === DiscussionStatus.PAUSING) {
          await this.prisma.session.update({
            where: { id: sessionId },
            data: {
              discussionStatus: DiscussionStatus.PAUSED,
              discussionPausedAt: new Date(),
            },
          });
          this.eventEmitter.emit(DISCUSSION_EVENTS.PAUSED, {
            sessionId,
            currentRound: session.currentRound,
            currentTurnIndex: session.currentTurnIndex,
          } as DiscussionPausedEvent);
          this.logger.log(`Session ${sessionId} paused at turn ${session.currentTurnIndex}`);
          return;
        }

        if (session.discussionStatus === DiscussionStatus.STOPPING) {
          const messageCount = await this.messageService.countBySession(sessionId);
          await this.prisma.session.update({
            where: { id: sessionId },
            data: { discussionStatus: DiscussionStatus.STOPPED },
          });
          this.eventEmitter.emit(DISCUSSION_EVENTS.STOPPED, {
            sessionId,
            currentRound: session.currentRound,
            currentTurnIndex: session.currentTurnIndex,
            messageCount,
          } as DiscussionStoppedEvent);
          this.logger.log(`Session ${sessionId} stopped at turn ${session.currentTurnIndex}`);
          return;
        }

        if (session.discussionStatus !== DiscussionStatus.RUNNING) {
          this.logger.warn(`Session ${sessionId} in unexpected state: ${session.discussionStatus}`);
          return;
        }

        // Check message count limit
        const messageCount = await this.messageService.countBySession(sessionId);
        if (messageCount >= session.maxMessages) {
          this.logger.log(`Session ${sessionId} reached max messages limit (${session.maxMessages})`);
          await this.concludeDiscussion(sessionId, false);
          return;
        }

        // Process DB-backed interventions
        await this.processInterventions(sessionId);

        // Select next expert using round-robin via turnIndex
        const experts = session.experts.map((se) => ({
          ...se.expert,
          driverType: se.expert.driverType,
        }));
        const currentExpert = experts[session.currentTurnIndex % experts.length];
        const currentRound = Math.floor(session.currentTurnIndex / experts.length);

        this.logger.log(`Expert turn: ${currentExpert.name} (${currentExpert.specialty})`);

        // Emit expert turn start
        this.eventEmitter.emit(DISCUSSION_EVENTS.EXPERT_TURN_START, {
          sessionId,
          expertId: currentExpert.id,
          expertName: currentExpert.name,
          turnNumber: session.currentTurnIndex + 1,
        } as ExpertTurnStartEvent);

        // Retrieve recent messages for context
        const recentMessages = await this.messageService.findLatestBySession(sessionId, 10);

        // Build the session response for buildExpertContext
        const sessionDto = await this.sessionService.findOne(sessionId);
        const expertDto = sessionDto.experts.find((e) => e.id === currentExpert.id);

        if (!expertDto) {
          this.logger.error(`Expert ${currentExpert.id} not found in session DTO`);
          break;
        }

        const contextMessages = this.buildExpertContext(
          sessionDto,
          expertDto,
          sessionDto.experts,
          recentMessages,
        );

        try {
          const driver = this.driverFactory.createDriver(currentExpert.driverType);
          const expertConfig = plainToInstance(LLMConfig, currentExpert.config);
          const response = await driver.chat(contextMessages, expertConfig);
          this.logger.log(
            `Received response from ${currentExpert.name}: ${response.content.substring(0, 100)}...`,
          );

          const trimmedContent = response.content.trim();
          if (!trimmedContent) {
            this.logger.warn(`Expert ${currentExpert.name} returned empty response, skipping`);
            // Still advance turn index
            await this.prisma.session.update({
              where: { id: sessionId },
              data: {
                currentTurnIndex: session.currentTurnIndex + 1,
                currentRound: Math.floor((session.currentTurnIndex + 1) / experts.length),
              },
            });
            await this.sleep(200);
            continue;
          }

          const message = await this.messageService.create({
            sessionId,
            expertId: currentExpert.id,
            content: trimmedContent,
            role: MessageRole.ASSISTANT,
          });

          this.eventEmitter.emit(DISCUSSION_EVENTS.MESSAGE_CREATED, {
            sessionId,
            message,
          } as DiscussionMessageEvent);

          const consensusReached = this.detectConsensus(trimmedContent);

          if (consensusReached) {
            this.logger.log(`Consensus detected in session ${sessionId}`);
            this.eventEmitter.emit(DISCUSSION_EVENTS.CONSENSUS_REACHED, {
              sessionId,
              consensusReached: true,
              finalMessage: message,
            } as DiscussionConsensusEvent);
            await this.concludeDiscussion(sessionId, true);
            return;
          }
        } catch (error) {
          this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
            sessionId,
            error: error.message,
            expertId: currentExpert.id,
          } as DiscussionErrorEvent);

          const isTransientError =
            error.name === 'LLMRateLimitException' ||
            error.name === 'LLMTimeoutException' ||
            error.name === 'LLMServiceException';

          if (isTransientError) {
            this.logger.warn(
              `Transient error for expert ${currentExpert.name}: ${error.message}. Continuing.`,
            );
          } else {
            this.logger.error(`Fatal error for expert ${currentExpert.name}: ${error.message}`, error.stack);
            await this.failDiscussion(sessionId, error.message);
            return;
          }
        }

        // Persist checkpoint — advance turn index
        await this.prisma.session.update({
          where: { id: sessionId },
          data: {
            currentTurnIndex: session.currentTurnIndex + 1,
            currentRound: Math.floor((session.currentTurnIndex + 1) / experts.length),
          },
        });

        await this.sleep(200);
      }
    } finally {
      this.activeLoops.delete(sessionId);
    }
  }
```

- [ ] **Step 5: Add concludeDiscussion and failDiscussion helper methods**

Replace the existing `concludeSession` method (lines 461-480) and add `failDiscussion`:

```typescript
  /**
   * Conclude a discussion successfully
   */
  private async concludeDiscussion(sessionId: string, consensusReached: boolean): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          discussionStatus: DiscussionStatus.COMPLETED,
          status: SessionStatus.COMPLETED,
          consensusReached,
        },
      });

      const finalMessageCount = await this.messageService.countBySession(sessionId);

      const endReason = consensusReached ? 'consensus' : 'max_messages';
      this.eventEmitter.emit(DISCUSSION_EVENTS.SESSION_ENDED, {
        sessionId,
        consensusReached,
        reason: endReason,
        messageCount: finalMessageCount,
      } as DiscussionEndedEvent);

      this.logger.log(`Session ${sessionId} concluded. Consensus: ${consensusReached}`);
    } catch (error) {
      this.logger.error(`Error concluding session ${sessionId}: ${error.message}`, error.stack);
      this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
        sessionId,
        error: error.message,
      } as DiscussionErrorEvent);
    }
  }

  /**
   * Mark a discussion as FAILED
   */
  private async failDiscussion(sessionId: string, errorMessage: string): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          discussionStatus: DiscussionStatus.FAILED,
          discussionError: errorMessage,
        },
      });

      // Also cancel the session
      await this.sessionService.update(sessionId, { status: SessionStatus.CANCELLED });

      this.eventEmitter.emit(DISCUSSION_EVENTS.SESSION_ENDED, {
        sessionId,
        consensusReached: false,
        reason: 'cancelled',
        messageCount: await this.messageService.countBySession(sessionId),
      } as DiscussionEndedEvent);

      this.logger.log(`Session ${sessionId} failed: ${errorMessage}`);
    } catch (error) {
      this.logger.error(`Error failing session ${sessionId}: ${error.message}`, error.stack);
    }
  }
```

- [ ] **Step 6: Add pauseDiscussion, stopDiscussion, resumeDiscussion, and getProgress methods**

Add these new public methods:

```typescript
  /**
   * Signal the discussion loop to pause at the next turn boundary.
   */
  async pauseDiscussion(sessionId: string): Promise<SessionResponseDto> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });

    if (!session) {
      throw new BadRequestException(`Session ${sessionId} not found`);
    }

    if (session.discussionStatus === DiscussionStatus.PAUSED) {
      return this.sessionService.findOne(sessionId); // Already paused — idempotent
    }

    if (session.discussionStatus !== DiscussionStatus.RUNNING) {
      throw new BadRequestException(
        `Cannot pause discussion in status ${session.discussionStatus}. Must be RUNNING.`,
      );
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { discussionStatus: DiscussionStatus.PAUSING },
    });

    this.logger.log(`Pause signal sent for session ${sessionId}`);
    return this.sessionService.findOne(sessionId);
  }

  /**
   * Signal the discussion loop to stop at the next turn boundary.
   */
  async stopDiscussion(sessionId: string): Promise<SessionResponseDto> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });

    if (!session) {
      throw new BadRequestException(`Session ${sessionId} not found`);
    }

    if (session.discussionStatus === DiscussionStatus.STOPPED) {
      return this.sessionService.findOne(sessionId); // Already stopped — idempotent
    }

    if (
      session.discussionStatus !== DiscussionStatus.RUNNING &&
      session.discussionStatus !== DiscussionStatus.PAUSED
    ) {
      throw new BadRequestException(
        `Cannot stop discussion in status ${session.discussionStatus}. Must be RUNNING or PAUSED.`,
      );
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { discussionStatus: DiscussionStatus.STOPPING },
    });

    // If paused, the loop isn't running — transition immediately
    if (session.discussionStatus === DiscussionStatus.PAUSED) {
      const messageCount = await this.messageService.countBySession(sessionId);
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { discussionStatus: DiscussionStatus.STOPPED },
      });
      this.eventEmitter.emit(DISCUSSION_EVENTS.STOPPED, {
        sessionId,
        currentRound: session.currentRound,
        currentTurnIndex: session.currentTurnIndex,
        messageCount,
      } as DiscussionStoppedEvent);
    }

    this.logger.log(`Stop signal sent for session ${sessionId}`);
    return this.sessionService.findOne(sessionId);
  }

  /**
   * Resume a paused discussion from the last checkpoint.
   */
  async resumeDiscussion(sessionId: string): Promise<SessionResponseDto> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });

    if (!session) {
      throw new BadRequestException(`Session ${sessionId} not found`);
    }

    if (session.discussionStatus !== DiscussionStatus.PAUSED) {
      throw new BadRequestException(
        `Cannot resume discussion in status ${session.discussionStatus}. Must be PAUSED.`,
      );
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        discussionStatus: DiscussionStatus.RUNNING,
        discussionPausedAt: null,
      },
    });

    this.eventEmitter.emit(DISCUSSION_EVENTS.RESUMED, {
      sessionId,
      currentRound: session.currentRound,
      currentTurnIndex: session.currentTurnIndex,
    } as DiscussionResumedEvent);

    this.logger.log(`Resuming session ${sessionId} from turn ${session.currentTurnIndex}`);

    // Re-enter the loop
    this.runDiscussionLoop(sessionId).catch((error) => {
      this.logger.error(`Discussion loop failed on resume for ${sessionId}: ${error.message}`, error.stack);
    });

    return this.sessionService.findOne(sessionId);
  }

  /**
   * Get current discussion progress.
   */
  async getProgress(sessionId: string): Promise<{
    discussionStatus: DiscussionStatus;
    currentRound: number;
    currentTurnIndex: number;
    totalRounds: number | null;
    messageCount: number;
  }> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });

    if (!session) {
      throw new BadRequestException(`Session ${sessionId} not found`);
    }

    const messageCount = await this.messageService.countBySession(sessionId);

    return {
      discussionStatus: session.discussionStatus,
      currentRound: session.currentRound,
      currentTurnIndex: session.currentTurnIndex,
      totalRounds: session.totalRounds,
      messageCount,
    };
  }
```

- [ ] **Step 7: Refactor processInterventions to use DB-backed interventions**

Replace the existing `processInterventions` method (lines 86-121) and `queueIntervention` (lines 55-80). Remove the in-memory `interventionQueues` map (line 31).

```typescript
  /**
   * Queue a user intervention in the database
   */
  async queueIntervention(sessionId: string, content: string, userId?: string): Promise<boolean> {
    try {
      const session = await this.prisma.session.findUnique({ where: { id: sessionId } });

      if (!session || (session.discussionStatus !== DiscussionStatus.RUNNING && session.discussionStatus !== DiscussionStatus.PAUSED)) {
        this.logger.warn(`Cannot queue intervention for session ${sessionId}: not in RUNNING/PAUSED state`);
        return false;
      }

      await this.prisma.intervention.create({
        data: { sessionId, content, userId },
      });

      this.logger.log(`Queued intervention for session ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to queue intervention for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Process unprocessed interventions from the database
   */
  private async processInterventions(sessionId: string): Promise<void> {
    const interventions = await this.prisma.intervention.findMany({
      where: { sessionId, processed: false },
      orderBy: { createdAt: 'asc' },
    });

    if (interventions.length === 0) return;

    this.logger.log(`Processing ${interventions.length} interventions for session ${sessionId}`);

    for (const intervention of interventions) {
      try {
        const message = await this.messageService.create({
          sessionId,
          content: intervention.content,
          role: MessageRole.USER,
          isIntervention: true,
        });

        this.eventEmitter.emit(DISCUSSION_EVENTS.MESSAGE_CREATED, {
          sessionId,
          message,
        } as DiscussionMessageEvent);

        await this.prisma.intervention.update({
          where: { id: intervention.id },
          data: { processed: true },
        });
      } catch (error) {
        this.logger.error(`Failed to process intervention ${intervention.id}: ${error.message}`);
        this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
          sessionId,
          error: error.message,
        } as DiscussionErrorEvent);
      }
    }
  }
```

- [ ] **Step 8: Update the imports at the top of the file**

Add the new event type imports:

```typescript
import {
  DISCUSSION_EVENTS,
  DiscussionMessageEvent,
  DiscussionConsensusEvent,
  DiscussionEndedEvent,
  DiscussionErrorEvent,
  ExpertTurnStartEvent,
  DiscussionPausedEvent,
  DiscussionStoppedEvent,
  DiscussionResumedEvent,
} from './events/discussion.events';
```

- [ ] **Step 9: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `council.service.ts`

- [ ] **Step 10: Commit**

```bash
git add src/council/council.service.ts
git commit -m "[council] refactor discussion loop to async checkpointed state machine"
```

---

## Task 6: CouncilController — Async Endpoints

**Files:**
- Modify: `src/council/council.controller.ts`

- [ ] **Step 1: Replace the entire controller file**

```typescript
import { Controller, Post, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CouncilService } from './council.service';
import { SessionResponseDto } from '../session/dto/session-response.dto';

@Controller('sessions')
export class CouncilController {
  constructor(private readonly councilService: CouncilService) {}

  /**
   * Start a discussion. Returns 202 Accepted immediately;
   * the discussion runs asynchronously.
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.ACCEPTED)
  async startDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    return this.councilService.startDiscussion(id);
  }

  /**
   * Pause a running discussion. Takes effect at the next turn boundary.
   */
  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  async pauseDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    return this.councilService.pauseDiscussion(id);
  }

  /**
   * Resume a paused discussion from the last checkpoint.
   */
  @Post(':id/resume')
  @HttpCode(HttpStatus.ACCEPTED)
  async resumeDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    return this.councilService.resumeDiscussion(id);
  }

  /**
   * Stop a running or paused discussion. Takes effect at the next turn boundary.
   */
  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  async stopDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    return this.councilService.stopDiscussion(id);
  }

  /**
   * Get current discussion progress (polling endpoint for non-WebSocket clients).
   */
  @Get(':id/progress')
  @HttpCode(HttpStatus.OK)
  async getProgress(@Param('id') id: string) {
    return this.councilService.getProgress(id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/council/council.controller.ts
git commit -m "[controller] add pause/resume/stop/progress endpoints, start returns 202"
```

---

## Task 7: DiscussionGateway — Pause/Stop Socket Handlers

**Files:**
- Modify: `src/council/gateways/discussion.gateway.ts`

- [ ] **Step 1: Add imports for new event types**

Update the events import (lines 17-24):

```typescript
import {
  DISCUSSION_EVENTS,
  DiscussionMessageEvent,
  DiscussionConsensusEvent,
  DiscussionEndedEvent,
  DiscussionErrorEvent,
  ExpertTurnStartEvent,
  DiscussionPausedEvent,
  DiscussionStoppedEvent,
  DiscussionResumedEvent,
} from '../events/discussion.events';
```

- [ ] **Step 2: Add event listeners in onModuleInit**

After the existing `EXPERT_TURN_START` listener (line 193), add:

```typescript
    this.eventEmitter.on(DISCUSSION_EVENTS.PAUSED, (event: DiscussionPausedEvent) => {
      const roomName = `session:${event.sessionId}`;
      this.server.to(roomName).emit('discussion-paused', {
        currentRound: event.currentRound,
        currentTurnIndex: event.currentTurnIndex,
      });
    });

    this.eventEmitter.on(DISCUSSION_EVENTS.STOPPED, (event: DiscussionStoppedEvent) => {
      const roomName = `session:${event.sessionId}`;
      this.server.to(roomName).emit('discussion-stopped', {
        currentRound: event.currentRound,
        currentTurnIndex: event.currentTurnIndex,
        messageCount: event.messageCount,
      });
    });

    this.eventEmitter.on(DISCUSSION_EVENTS.RESUMED, (event: DiscussionResumedEvent) => {
      const roomName = `session:${event.sessionId}`;
      this.server.to(roomName).emit('discussion-resumed', {
        currentRound: event.currentRound,
        currentTurnIndex: event.currentTurnIndex,
      });
    });
```

- [ ] **Step 3: Add pause-discussion socket handler**

After the `handleIntervention` method, add:

```typescript
  @SubscribeMessage('pause-discussion')
  @UseGuards(WsAuthGuard)
  async handlePauseDiscussion(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { sessionId } = data;
      const userSessionId = client.data.user?.sessionId;

      if (sessionId !== userSessionId) {
        client.emit('error', { error: 'Session ID mismatch' });
        return;
      }

      await this.councilService.pauseDiscussion(sessionId);
    } catch (error) {
      console.error('Error in handlePauseDiscussion:', error);
      client.emit('error', {
        error: error.message || 'Failed to pause discussion',
      });
    }
  }
```

- [ ] **Step 4: Add stop-discussion socket handler**

```typescript
  @SubscribeMessage('stop-discussion')
  @UseGuards(WsAuthGuard)
  async handleStopDiscussion(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { sessionId } = data;
      const userSessionId = client.data.user?.sessionId;

      if (sessionId !== userSessionId) {
        client.emit('error', { error: 'Session ID mismatch' });
        return;
      }

      await this.councilService.stopDiscussion(sessionId);
    } catch (error) {
      console.error('Error in handleStopDiscussion:', error);
      client.emit('error', {
        error: error.message || 'Failed to stop discussion',
      });
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/council/gateways/discussion.gateway.ts
git commit -m "[gateway] add pause/stop socket handlers and new event listeners"
```

---

## Task 8: Crash Recovery — AppModule Bootstrap

**Files:**
- Modify: `src/app.module.ts`

- [ ] **Step 1: Add OnApplicationBootstrap lifecycle hook**

Replace the entire file:

```typescript
import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DiscussionStatus } from '@prisma/client';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { LlmModule } from './llm/llm.module';
import { ExpertModule } from './expert/expert.module';
import { SessionModule } from './session/session.module';
import { MessageModule } from './message/message.module';
import { CouncilModule } from './council/council.module';
import { PrismaService } from './common/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    CommonModule,
    LlmModule,
    ExpertModule,
    SessionModule,
    MessageModule,
    CouncilModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    // Mark any sessions that were mid-discussion when the server crashed as FAILED
    const orphanedStatuses = [
      DiscussionStatus.RUNNING,
      DiscussionStatus.PAUSING,
      DiscussionStatus.STOPPING,
    ];

    const result = await this.prisma.session.updateMany({
      where: { discussionStatus: { in: orphanedStatuses } },
      data: {
        discussionStatus: DiscussionStatus.FAILED,
        discussionError: 'Server restarted during discussion',
      },
    });

    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} orphaned discussion(s) as FAILED on startup`);
    }
  }
}
```

- [ ] **Step 2: Verify PrismaService is available via CommonModule**

Check that `CommonModule` exports `PrismaService`. If it does (which it should since other modules use it), this will work. If not, add `PrismaService` to the AppModule providers.

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app.module.ts
git commit -m "[app] add crash recovery for orphaned discussions on startup"
```

---

## Task 9: Frontend Types — DiscussionStatus and New Fields

**Files:**
- Modify: `frontend/src/types/session.ts`

- [ ] **Step 1: Add DiscussionStatus enum and update SessionResponse**

Replace the entire file:

```typescript
import type { ExpertResponse } from './expert';

export enum SessionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum DiscussionStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSING = 'PAUSING',
  PAUSED = 'PAUSED',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
}

export interface CreateSessionDto {
  problemStatement: string;
  expertIds: string[];
  maxMessages?: number;
}

export interface SessionResponse {
  id: string;
  problemStatement: string;
  status?: SessionStatus;
  statusDisplay?: string;
  discussionStatus?: DiscussionStatus;
  currentRound?: number;
  currentTurnIndex?: number;
  totalRounds?: number | null;
  discussionError?: string | null;
  maxMessages: number;
  consensusReached: boolean;
  createdAt: string;
  updatedAt: string;
  experts: ExpertResponse[];
  messageCount?: number;
}

export interface MessageResponse {
  id: string;
  sessionId: string;
  expertId: string | null;
  content: string;
  role: MessageRole;
  isIntervention: boolean;
  timestamp: string;
  expertName: string | null;
  expertSpecialty: string | null;
}

export interface TokenResponse {
  token: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/session.ts
git commit -m "[frontend] add DiscussionStatus enum and new session fields"
```

---

## Task 10: Frontend WebSocket Hook — Wire Up New Events

**Files:**
- Modify: `frontend/src/hooks/use-websocket.ts`

- [ ] **Step 1: Add discussionStatus state and resumeDiscussion function**

After the `isDiscussionActive` state (line 34), add:

```typescript
  const [discussionStatus, setDiscussionStatus] = useState<string>('IDLE');
```

- [ ] **Step 2: Add new socket event listeners in the initializeSocket function**

After the `"session-ended"` listener (around line 112), add:

```typescript
        newSocket.on("discussion-paused", () => {
          if (isMounted) {
            setIsDiscussionActive(false);
            setDiscussionStatus('PAUSED');
          }
        });

        newSocket.on("discussion-stopped", () => {
          if (isMounted) {
            setIsDiscussionActive(false);
            setDiscussionStatus('STOPPED');
          }
        });

        newSocket.on("discussion-resumed", () => {
          if (isMounted) {
            setIsDiscussionActive(true);
            setDiscussionStatus('RUNNING');
          }
        });
```

- [ ] **Step 3: Update the discussion-started handler to set discussionStatus**

In the `"discussion-started"` handler (line 81), add `setDiscussionStatus('RUNNING')` alongside the existing `setIsDiscussionActive(true)`.

- [ ] **Step 4: Add resumeDiscussion callback**

After the `stopDiscussion` callback (line 192), add:

```typescript
  const resumeDiscussion = useCallback(() => {
    if (socket?.connected) {
      socket.emit("resume-discussion", { sessionId });
    }
  }, [socket, sessionId]);
```

- [ ] **Step 5: Update the UseWebSocketReturn interface and return statement**

Add `discussionStatus: string` and `resumeDiscussion: () => void` to the interface (lines 13-26).

Add `discussionStatus` and `resumeDiscussion` to the return object (lines 211-224).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/use-websocket.ts
git commit -m "[frontend] wire up pause/stop/resume socket events in useWebSocket hook"
```

---

## Task 11: Frontend SessionControls — New Button States

**Files:**
- Modify: `frontend/src/components/sessions/SessionControls.tsx`

- [ ] **Step 1: Import DiscussionStatus and add it to props**

Add `DiscussionStatus` to the import from `@/types` (line 1):

```typescript
import { SessionResponse, SessionStatus, DiscussionStatus } from "@/types";
```

Update the `SessionControlsProps` interface to add:

```typescript
  discussionStatus?: DiscussionStatus;
  onResumeDiscussion: () => void;
```

Add `discussionStatus` and `onResumeDiscussion` to the destructured props.

- [ ] **Step 2: Update the statusColor and statusIcon maps**

Replace the maps (lines 69-79) with:

```typescript
  const statusColor: Record<string, string> = {
    [SessionStatus.PENDING]: "bg-yellow-100 text-yellow-800",
    [SessionStatus.ACTIVE]: "bg-blue-100 text-blue-800",
    [SessionStatus.COMPLETED]: "bg-green-100 text-green-800",
    PAUSING: "bg-orange-100 text-orange-800",
    PAUSED: "bg-orange-100 text-orange-800",
    STOPPING: "bg-red-100 text-red-800",
    STOPPED: "bg-gray-100 text-gray-800",
    FAILED: "bg-red-100 text-red-800",
  };

  const statusIcon: Record<string, React.ReactNode> = {
    [SessionStatus.PENDING]: <Clock className="h-4 w-4" />,
    [SessionStatus.ACTIVE]: <Play className="h-4 w-4" />,
    [SessionStatus.COMPLETED]: <CheckCircle2 className="h-4 w-4" />,
    PAUSING: <Pause className="h-4 w-4" />,
    PAUSED: <Pause className="h-4 w-4" />,
    STOPPING: <Square className="h-4 w-4" />,
    STOPPED: <Square className="h-4 w-4" />,
    FAILED: <Square className="h-4 w-4" />,
  };
```

Use `discussionStatus || sessionStatus` as the key when looking up color/icon in the badge.

- [ ] **Step 3: Update the CardFooter buttons**

Replace the `CardFooter` content (lines 188-229) with:

```tsx
      <CardFooter className="flex gap-2">
        {sessionStatus === SessionStatus.PENDING && (
          <Button
            onClick={onStartDiscussion}
            disabled={!isConnected}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Discussion
          </Button>
        )}

        {sessionStatus === SessionStatus.ACTIVE && discussionStatus === DiscussionStatus.RUNNING && (
          <>
            <Button
              onClick={onPauseDiscussion}
              disabled={!isConnected}
              variant="outline"
              className="flex-1"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
            <Button
              onClick={onStopDiscussion}
              disabled={!isConnected}
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          </>
        )}

        {discussionStatus === DiscussionStatus.PAUSING && (
          <Button disabled className="w-full" variant="outline">
            <Pause className="h-4 w-4 mr-2" />
            Pausing...
          </Button>
        )}

        {discussionStatus === DiscussionStatus.PAUSED && (
          <>
            <Button
              onClick={onResumeDiscussion}
              disabled={!isConnected}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
            <Button
              onClick={onStopDiscussion}
              disabled={!isConnected}
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          </>
        )}

        {discussionStatus === DiscussionStatus.STOPPING && (
          <Button disabled className="w-full" variant="outline">
            <Square className="h-4 w-4 mr-2" />
            Stopping...
          </Button>
        )}

        {(discussionStatus === DiscussionStatus.STOPPED || discussionStatus === DiscussionStatus.FAILED) && (
          <Button disabled className="w-full" variant="outline">
            <Square className="h-4 w-4 mr-2" />
            {discussionStatus === DiscussionStatus.FAILED ? 'Discussion Failed' : 'Discussion Stopped'}
          </Button>
        )}

        {sessionStatus === SessionStatus.COMPLETED && (
          <Button disabled className="w-full" variant="outline">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Discussion Completed
          </Button>
        )}
      </CardFooter>
```

- [ ] **Step 4: Update the status alerts section**

Add alerts for PAUSED and FAILED states in the alerts section (after the `isDiscussionActive` alert around line 174):

```tsx
          {discussionStatus === DiscussionStatus.PAUSED && (
            <Alert className="border-orange-200 bg-orange-50">
              <Pause className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Discussion is paused
              </AlertDescription>
            </Alert>
          )}

          {discussionStatus === DiscussionStatus.FAILED && session.discussionError && (
            <Alert variant="destructive">
              <AlertDescription>
                Discussion failed: {session.discussionError}
              </AlertDescription>
            </Alert>
          )}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/sessions/SessionControls.tsx
git commit -m "[frontend] update SessionControls for pause/resume/stop/failed states"
```

---

## Task 12: Wire SessionControls Props in Parent Component

**Files:**
- Find the parent that renders `SessionControls` and pass the new props

- [ ] **Step 1: Find the parent component**

Search for `<SessionControls` usage in the frontend codebase to identify the parent page/component. It will need to pass `discussionStatus` and `onResumeDiscussion` from the `useWebSocket` hook.

- [ ] **Step 2: Add the new props**

In the parent component, add:
- `discussionStatus={discussionStatus}` (from the `useWebSocket` return)
- `onResumeDiscussion={resumeDiscussion}` (from the `useWebSocket` return)

Where `discussionStatus` and `resumeDiscussion` are destructured from the `useWebSocket` hook.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/
git commit -m "[frontend] wire new discussion props to SessionControls parent"
```

---

## Task 13: Set turnOrder on SessionExpert During Session Creation

**Files:**
- Modify: `src/session/session.service.ts:59-75` (the `create` method's transaction)

- [ ] **Step 1: Update the createMany call to include turnOrder**

In the `create` method, replace the `createMany` call (lines 70-75):

```typescript
        await tx.sessionExpert.createMany({
          data: expertIds.map((expertId, index) => ({
            sessionId: newSession.id,
            expertId,
            turnOrder: index,
          })),
        });
```

This preserves the order that experts were specified when creating the session.

- [ ] **Step 2: Update findOne to order by turnOrder**

In `findOne` (lines 140-162), add ordering to the experts include:

```typescript
      include: {
        experts: {
          include: {
            expert: true,
          },
          orderBy: {
            turnOrder: 'asc',
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
```

Apply the same `orderBy` to `findAll` (lines 111-131) for consistency.

- [ ] **Step 3: Commit**

```bash
git add src/session/session.service.ts
git commit -m "[session] set turnOrder on session creation, order experts by turnOrder"
```

---

## Task 14: CouncilModule — Ensure PrismaService is Available

**Files:**
- Modify: `src/council/council.module.ts`

- [ ] **Step 1: Verify PrismaService injection works**

The `CouncilService` now injects `PrismaService`. Check if `CommonModule` (which provides `PrismaService`) is imported by `CouncilModule`. Currently it is NOT — `CouncilModule` only imports `SessionModule`, `MessageModule`, `LlmModule`.

Add `CommonModule` to the imports:

```typescript
import { Module } from '@nestjs/common';
import { CouncilController } from './council.controller';
import { CouncilService } from './council.service';
import { SessionModule } from '../session/session.module';
import { MessageModule } from '../message/message.module';
import { LlmModule } from '../llm/llm.module';
import { CommonModule } from '../common/common.module';
import { DiscussionGateway } from './gateways/discussion.gateway';

@Module({
  imports: [SessionModule, MessageModule, LlmModule, CommonModule],
  controllers: [CouncilController],
  providers: [CouncilService, DiscussionGateway],
  exports: [CouncilService],
})
export class CouncilModule {}
```

- [ ] **Step 2: Run compilation check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/council/council.module.ts
git commit -m "[council] import CommonModule for PrismaService access"
```

---

## Task 15: End-to-End Verification

- [ ] **Step 1: Run the full build**

```bash
cd /path/to/Aicouncil
npm run build
```

Expected: Successful build with no errors.

- [ ] **Step 2: Run the migration against a test database**

```bash
npx prisma migrate dev --name async-discussion-orchestration
```

Expected: Migration applies cleanly.

- [ ] **Step 3: Start the backend and verify the new endpoints exist**

```bash
npm run start:dev
```

In another terminal:
```bash
# These should return proper error responses (not 404)
curl -X POST http://localhost:3000/sessions/nonexistent/pause
curl -X POST http://localhost:3000/sessions/nonexistent/resume
curl -X POST http://localhost:3000/sessions/nonexistent/stop
curl -X GET http://localhost:3000/sessions/nonexistent/progress
```

Expected: 400 Bad Request (session not found), NOT 404 (route not found).

- [ ] **Step 4: Build the frontend**

```bash
cd frontend
npm run build
```

Expected: Successful build with no type errors.

- [ ] **Step 5: Final commit if any remaining changes**

```bash
git add .
git commit -m "[verify] end-to-end build verification"
```

---

## Dependency Graph

```
Task 1 (schema: enum + session fields)
  └─► Task 2 (schema: Intervention + turnOrder)
        └─► Task 3 (events)
              └─► Task 4 (DTOs)
                    └─► Task 5 (CouncilService refactor) ◄── Task 14 (module fix)
                          ├─► Task 6 (Controller)
                          ├─► Task 7 (Gateway)
                          └─► Task 8 (Crash recovery)
Task 9 (frontend types) ──► Task 10 (useWebSocket hook) ──► Task 11 (SessionControls)
                                                               └─► Task 12 (parent wiring)
Task 2 ──► Task 13 (turnOrder in session creation)
All tasks ──► Task 15 (E2E verification)
```

Tasks 1-8 (backend) and Tasks 9-12 (frontend) can proceed in parallel once their respective dependencies are met. Task 13 can run in parallel with Tasks 5-8. Task 14 should be done before or alongside Task 5. Task 15 runs last.

---

## Test Strategy

The codebase currently has **zero tests**. The TDD Engineer should create tests for the following critical paths:

1. **State machine transitions** — Unit tests for `pauseDiscussion`, `stopDiscussion`, `resumeDiscussion` validating which source states are allowed
2. **Discussion loop checkpointing** — Integration test: start discussion, verify `currentTurnIndex` increments in DB after each turn
3. **Pause signal** — Integration test: start discussion, call pause, verify loop stops and `discussionStatus` is `PAUSED`
4. **Stop signal** — Integration test: start discussion, call stop, verify loop stops and `discussionStatus` is `STOPPED`
5. **Resume from checkpoint** — Integration test: start, pause, resume, verify loop continues from `currentTurnIndex`
6. **Crash recovery** — Test: insert a session with `discussionStatus: RUNNING`, call `onApplicationBootstrap`, verify it becomes `FAILED`
7. **DB-backed interventions** — Test: queue intervention, run `processInterventions`, verify message created and intervention marked processed
8. **Idempotency** — Test: call pause twice, verify no error; call stop on already stopped, verify no error
9. **Controller HTTP codes** — Test: start returns 202, pause returns 200, resume returns 202, stop returns 200
10. **Gateway event forwarding** — Test: emit `DISCUSSION_EVENTS.PAUSED`, verify socket room receives `discussion-paused`

---

## Known Frontend Issues to Fix Opportunistically

These pre-existing bugs were found during codebase exploration. They are NOT blockers for this plan but should be noted:

1. **`consensus-reached` event mismatch** — Frontend reads `data.consensus` (line 88 of `use-websocket.ts`) but backend sends `{ finalMessage }`. Fix: read `data.finalMessage.content` instead.
2. **`error` event field mismatch** — Frontend reads `errorData.message` (line 122) but backend sends `{ error }`. Fix: read `errorData.error`.
3. **`sendIntervention` ack callback** — Frontend expects ack callback (line 168) but backend never calls it, causing Promise to hang. Fix: remove ack callback or add it to backend handler.
4. **Missing `CANCELLED` in frontend `SessionStatus`** — The enum (line 3-7 of `session.ts`) lacks `CANCELLED`. The `statusColor`/`statusIcon` maps also lack it.
