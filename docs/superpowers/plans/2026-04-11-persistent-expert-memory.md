# Persistent Expert Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow AIcouncil experts to remember past discussions and reference them in new sessions, enabling multi-session workflows where experts build on prior knowledge.

**Architecture:** Summary-based memory with relevance scoring. After each session concludes, an LLM summarization call generates per-expert memory entries (SESSION_SUMMARY + KEY_INSIGHTs). On each new session turn, relevant memories are selected by a score combining recency decay and topic overlap, then injected into the expert's system message. A new `MemoryModule` provides CRUD API and the generation/injection logic.

**Tech Stack:** NestJS, Prisma (PostgreSQL), React, Socket.IO, class-validator, class-transformer, Zod (frontend validation), shadcn/ui

**Design Spec:** `docs/specs/2026-04-11-persistent-expert-memory-design.md` (branch `agent/brainstormer/f78c70f0`)

---

## File Structure

### New Files (Backend)

| File | Responsibility |
|------|---------------|
| `prisma/migrations/<timestamp>_add_expert_memory/migration.sql` | DB migration for ExpertMemory table + Expert model additions |
| `src/memory/memory.module.ts` | NestJS module definition |
| `src/memory/memory.service.ts` | Core logic: generateSessionMemory, getRelevantMemories, CRUD |
| `src/memory/memory.controller.ts` | REST endpoints under `/experts/:id/memories` |
| `src/memory/dto/create-memory.dto.ts` | Validation for user-created memories |
| `src/memory/dto/update-memory.dto.ts` | Validation for memory updates |
| `src/memory/dto/memory-response.dto.ts` | Response transformation |
| `src/memory/dto/index.ts` | Barrel export |
| `src/memory/utils/relevance.ts` | Scoring functions: recencyBoost, topicOverlap, effectiveRelevance |
| `src/memory/utils/keywords.ts` | Keyword extraction: tokenize, lowercase, stopword removal |
| `src/memory/memory.service.spec.ts` | Unit tests for MemoryService |
| `src/memory/memory.controller.spec.ts` | Unit tests for MemoryController |
| `src/memory/utils/relevance.spec.ts` | Unit tests for scoring functions |
| `src/memory/utils/keywords.spec.ts` | Unit tests for keyword extraction |

### New Files (Frontend)

| File | Responsibility |
|------|---------------|
| `frontend/src/lib/api/memories.ts` | API client for memory CRUD |
| `frontend/src/types/memory.ts` | TypeScript types for memory entities |
| `frontend/src/components/experts/MemoryTab.tsx` | Memory list/management UI on expert page |
| `frontend/src/components/experts/MemoryCard.tsx` | Individual memory entry display |
| `frontend/src/components/experts/AddNoteDialog.tsx` | Dialog for creating USER_NOTE memories |
| `frontend/src/components/experts/ClearMemoryDialog.tsx` | Confirmation dialog for clearing all memories |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add ExpertMemory model, MemoryType enum, Expert field additions, Session relation |
| `src/app.module.ts` | Import MemoryModule |
| `src/council/council.module.ts` | Import MemoryModule |
| `src/council/council.service.ts` | Inject MemoryService, call getRelevantMemories in buildExpertContext, call generateSessionMemory after concludeSession |
| `src/council/events/discussion.events.ts` | Add injectedMemoryIds to ExpertTurnStartEvent |
| `src/council/gateways/discussion.gateway.ts` | Forward injectedMemoryIds in expert-turn-start event |
| `src/expert/dto/create-expert.dto.ts` | Add memoryEnabled, memoryMaxEntries, memoryMaxInject fields |
| `src/expert/dto/expert-response.dto.ts` | Expose new memory config fields |
| `frontend/src/types/expert.ts` | Add memory fields to ExpertResponse and CreateExpertDto |
| `frontend/src/types/index.ts` | Re-export memory types |
| `frontend/src/lib/validations/expert.ts` | Add memory fields to expertFormSchema |
| `frontend/src/components/experts/ExpertForm.tsx` | Add memory settings section |
| `frontend/src/pages/ExpertsPage.tsx` | Add memory tab navigation for individual expert view |
| `frontend/src/pages/SessionDetailPage.tsx` | Add memory badge on participating experts card |
| `frontend/src/hooks/use-websocket.ts` | Track injectedMemoryIds from expert-turn-start events |

---

## Task 1: Keyword Extraction Utility

**Files:**
- Create: `src/memory/utils/keywords.ts`
- Test: `src/memory/utils/keywords.spec.ts`

This is a pure utility with no dependencies -- start here for fast TDD feedback.

- [ ] **Step 1: Write the failing test**

Create `src/memory/utils/keywords.spec.ts`:

```typescript
import { extractKeywords } from './keywords';

describe('extractKeywords', () => {
  it('should extract meaningful words and lowercase them', () => {
    const result = extractKeywords('Design API Authentication for Mobile');
    expect(result).toEqual(expect.arrayContaining(['design', 'api', 'authentication', 'mobile']));
  });

  it('should remove common stopwords', () => {
    const result = extractKeywords('the quick brown fox jumps over the lazy dog');
    expect(result).not.toContain('the');
    expect(result).not.toContain('over');
    expect(result).toContain('quick');
    expect(result).toContain('brown');
    expect(result).toContain('fox');
  });

  it('should remove short words (< 3 characters)', () => {
    const result = extractKeywords('we do it on a go');
    expect(result).toHaveLength(0);
  });

  it('should handle empty string', () => {
    const result = extractKeywords('');
    expect(result).toEqual([]);
  });

  it('should deduplicate words', () => {
    const result = extractKeywords('API api Api design design');
    const apiCount = result.filter((w) => w === 'api').length;
    expect(apiCount).toBe(1);
  });

  it('should strip punctuation', () => {
    const result = extractKeywords('authentication, authorization. tokens!');
    expect(result).toContain('authentication');
    expect(result).toContain('authorization');
    expect(result).toContain('tokens');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /path/to/Aicouncil && npx jest src/memory/utils/keywords.spec.ts --no-cache`
Expected: FAIL with "Cannot find module './keywords'"

- [ ] **Step 3: Write minimal implementation**

Create `src/memory/utils/keywords.ts`:

```typescript
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'are',
  'were', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
  'these', 'those', 'not', 'no', 'we', 'you', 'they', 'he', 'she',
  'its', 'his', 'her', 'our', 'your', 'their', 'what', 'which', 'who',
  'when', 'where', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just', 'about',
  'over', 'after', 'before', 'between', 'under', 'again', 'then', 'once',
]);

/**
 * Extract meaningful keywords from text.
 * Tokenizes, lowercases, removes stopwords and short words, deduplicates.
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));

  return [...new Set(words)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/memory/utils/keywords.spec.ts --no-cache`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/memory/utils/keywords.ts src/memory/utils/keywords.spec.ts
git commit -m "[memory] add keyword extraction utility with tests"
```

---

## Task 2: Relevance Scoring Utility

**Files:**
- Create: `src/memory/utils/relevance.ts`
- Test: `src/memory/utils/relevance.spec.ts`

Another pure utility. Depends on keywords.ts from Task 1.

- [ ] **Step 1: Write the failing test**

Create `src/memory/utils/relevance.spec.ts`:

```typescript
import { calculateRecencyBoost, calculateTopicOverlap, calculateEffectiveRelevance, scoreMemory } from './relevance';

describe('calculateRecencyBoost', () => {
  it('should return 1.0 for memories created today', () => {
    const now = new Date();
    expect(calculateRecencyBoost(now)).toBeCloseTo(1.0);
  });

  it('should decay by 0.1 per week', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(calculateRecencyBoost(twoWeeksAgo)).toBeCloseTo(0.8, 1);
  });

  it('should have a floor of 0.3', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    expect(calculateRecencyBoost(oneYearAgo)).toBeCloseTo(0.3);
  });
});

describe('calculateTopicOverlap', () => {
  it('should return 1.0 for identical topic sets', () => {
    expect(calculateTopicOverlap(['api', 'auth'], ['api', 'auth'])).toBeCloseTo(1.0);
  });

  it('should return 0.2 floor for completely disjoint topics', () => {
    expect(calculateTopicOverlap(['api', 'auth'], ['database', 'migration'])).toBeCloseTo(0.2);
  });

  it('should calculate Jaccard similarity correctly', () => {
    // intersection = {api}, union = {api, auth, design} => 1/3 = 0.333
    const result = calculateTopicOverlap(['api', 'auth'], ['api', 'design']);
    expect(result).toBeCloseTo(1 / 3);
  });

  it('should return 0.2 floor when one set is empty', () => {
    expect(calculateTopicOverlap([], ['api', 'auth'])).toBeCloseTo(0.2);
  });
});

describe('calculateEffectiveRelevance', () => {
  it('should apply decay formula to base relevance', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    // 1.0 * 0.95^2 = 0.9025
    expect(calculateEffectiveRelevance(1.0, twoWeeksAgo)).toBeCloseTo(0.9025, 2);
  });

  it('should have a floor of 0.1', () => {
    const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    expect(calculateEffectiveRelevance(1.0, longAgo)).toBeGreaterThanOrEqual(0.1);
  });
});

describe('scoreMemory', () => {
  it('should combine relevance, recency, and topic overlap', () => {
    const now = new Date();
    const score = scoreMemory(1.0, now, ['api', 'auth'], ['api', 'auth']);
    // 1.0 (effective) * 1.0 (recency) * 1.0 (overlap) = 1.0
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('should return lower score for old, off-topic memories', () => {
    const longAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000); // 8 weeks
    const score = scoreMemory(1.0, longAgo, ['database'], ['api', 'auth']);
    expect(score).toBeLessThan(0.3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/memory/utils/relevance.spec.ts --no-cache`
Expected: FAIL with "Cannot find module './relevance'"

- [ ] **Step 3: Write minimal implementation**

Create `src/memory/utils/relevance.ts`:

```typescript
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Recency boost: 1.0 for today, decays 0.1 per week, floor 0.3.
 */
export function calculateRecencyBoost(createdAt: Date): number {
  const weeksSince = (Date.now() - createdAt.getTime()) / MS_PER_WEEK;
  return Math.max(0.3, 1.0 - weeksSince * 0.1);
}

/**
 * Topic overlap: Jaccard similarity with floor of 0.2.
 */
export function calculateTopicOverlap(memoryTopics: string[], queryTopics: string[]): number {
  if (memoryTopics.length === 0 || queryTopics.length === 0) {
    return 0.2;
  }

  const setA = new Set(memoryTopics);
  const setB = new Set(queryTopics);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  const jaccard = intersection.size / union.size;
  return Math.max(0.2, jaccard);
}

/**
 * Effective relevance: base relevance decayed by time.
 * Formula: baseRelevance * 0.95^weeksSinceCreation, floor 0.1.
 */
export function calculateEffectiveRelevance(baseRelevance: number, createdAt: Date): number {
  const weeksSince = (Date.now() - createdAt.getTime()) / MS_PER_WEEK;
  return Math.max(0.1, baseRelevance * Math.pow(0.95, weeksSince));
}

/**
 * Combined memory score: effectiveRelevance * recencyBoost * topicOverlap.
 */
export function scoreMemory(
  baseRelevance: number,
  createdAt: Date,
  memoryTopics: string[],
  queryTopics: string[],
): number {
  const effective = calculateEffectiveRelevance(baseRelevance, createdAt);
  const recency = calculateRecencyBoost(createdAt);
  const overlap = calculateTopicOverlap(memoryTopics, queryTopics);
  return effective * recency * overlap;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/memory/utils/relevance.spec.ts --no-cache`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/memory/utils/relevance.ts src/memory/utils/relevance.spec.ts
git commit -m "[memory] add relevance scoring utility with tests"
```

---

## Task 3: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

Adds the `MemoryType` enum, `ExpertMemory` model, Expert field additions, and Session relation.

- [ ] **Step 1: Add MemoryType enum to schema**

In `prisma/schema.prisma`, after the `DriverType` enum (line 31), add:

```prisma
enum MemoryType {
  SESSION_SUMMARY
  KEY_INSIGHT
  USER_NOTE
}
```

- [ ] **Step 2: Add ExpertMemory model**

At the end of `prisma/schema.prisma`, add:

```prisma
model ExpertMemory {
  id        String     @id @default(cuid())
  expertId  String
  sessionId String?
  type      MemoryType
  content   String     @db.Text
  relevance Float      @default(1.0)
  metadata  Json?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  expert  Expert   @relation(fields: [expertId], references: [id], onDelete: Cascade)
  session Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  @@index([expertId])
  @@index([expertId, relevance])
  @@index([sessionId])
}
```

- [ ] **Step 3: Add memory fields to Expert model**

In the `Expert` model (currently lines 33-47), add these fields before the closing `}`:

```prisma
  memoryEnabled    Boolean  @default(true)
  memoryMaxEntries Int      @default(50)
  memoryMaxInject  Int      @default(5)
  memories         ExpertMemory[]
```

The full Expert model becomes:

```prisma
model Expert {
  id               String     @id @default(cuid())
  name             String
  specialty        String
  systemPrompt     String     @db.Text
  driverType       DriverType
  config           Json
  memoryEnabled    Boolean    @default(true)
  memoryMaxEntries Int        @default(50)
  memoryMaxInject  Int        @default(5)
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  sessions SessionExpert[]
  messages Message[]
  memories ExpertMemory[]

  @@index([driverType])
}
```

- [ ] **Step 4: Add memories relation to Session model**

In the `Session` model (currently lines 49-62), add before the closing `}`:

```prisma
  memories ExpertMemory[]
```

The relations section of Session becomes:

```prisma
  experts  SessionExpert[]
  messages Message[]
  memories ExpertMemory[]
```

- [ ] **Step 5: Generate and apply migration**

Run:
```bash
npx prisma migrate dev --name add_expert_memory
```

Expected: Migration created and applied. Prisma Client regenerated.

- [ ] **Step 6: Verify the generated client**

Run:
```bash
npx prisma generate
```

Expected: Prisma Client generated successfully. You should now see `ExpertMemory` and `MemoryType` available in the client types.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "[memory] add ExpertMemory table and Expert memory config fields"
```

---

## Task 4: Memory DTOs

**Files:**
- Create: `src/memory/dto/create-memory.dto.ts`
- Create: `src/memory/dto/update-memory.dto.ts`
- Create: `src/memory/dto/memory-response.dto.ts`
- Create: `src/memory/dto/index.ts`

- [ ] **Step 1: Create CreateMemoryDto**

Create `src/memory/dto/create-memory.dto.ts`:

```typescript
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MemoryMetadataDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];
}

export class CreateMemoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  relevance?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => MemoryMetadataDto)
  metadata?: MemoryMetadataDto;
}
```

- [ ] **Step 2: Create UpdateMemoryDto**

Create `src/memory/dto/update-memory.dto.ts`:

```typescript
import { IsString, IsOptional, MinLength, MaxLength, IsNumber, Min, Max } from 'class-validator';

export class UpdateMemoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  relevance?: number;
}
```

- [ ] **Step 3: Create MemoryResponseDto**

Create `src/memory/dto/memory-response.dto.ts`:

```typescript
import { Expose } from 'class-transformer';
import { MemoryType, ExpertMemory, Session } from '@prisma/client';
import { calculateEffectiveRelevance } from '../utils/relevance';

export class MemoryResponseDto {
  @Expose()
  id: string;

  @Expose()
  expertId: string;

  @Expose()
  sessionId: string | null;

  @Expose()
  type: MemoryType;

  @Expose()
  content: string;

  @Expose()
  relevance: number;

  @Expose()
  effectiveRelevance: number;

  @Expose()
  metadata: Record<string, unknown> | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<MemoryResponseDto>) {
    Object.assign(this, partial);
  }

  static fromPrisma(memory: ExpertMemory): MemoryResponseDto {
    return new MemoryResponseDto({
      id: memory.id,
      expertId: memory.expertId,
      sessionId: memory.sessionId,
      type: memory.type,
      content: memory.content,
      relevance: memory.relevance,
      effectiveRelevance:
        memory.type === 'USER_NOTE'
          ? memory.relevance
          : calculateEffectiveRelevance(memory.relevance, memory.createdAt),
      metadata: memory.metadata as Record<string, unknown> | null,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    });
  }
}
```

- [ ] **Step 4: Create barrel export**

Create `src/memory/dto/index.ts`:

```typescript
export { CreateMemoryDto } from './create-memory.dto';
export { UpdateMemoryDto } from './update-memory.dto';
export { MemoryResponseDto } from './memory-response.dto';
```

- [ ] **Step 5: Commit**

```bash
git add src/memory/dto/
git commit -m "[memory] add memory DTOs for create, update, and response"
```

---

## Task 5: MemoryService — CRUD Operations

**Files:**
- Create: `src/memory/memory.service.ts`
- Test: `src/memory/memory.service.spec.ts`

This task covers the CRUD methods. Memory generation and injection are separate tasks.

- [ ] **Step 1: Write the failing test for CRUD**

Create `src/memory/memory.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { MemoryService } from './memory.service';
import { PrismaService } from '../common/prisma.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { MessageService } from '../message/message.service';

// Mock PrismaService
const mockPrismaService = {
  expertMemory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  expert: {
    findUnique: jest.fn(),
  },
};

const mockDriverFactory = {
  createDriver: jest.fn(),
};

const mockMessageService = {
  findBySession: jest.fn(),
};

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: DriverFactory, useValue: mockDriverFactory },
        { provide: MessageService, useValue: mockMessageService },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
    jest.clearAllMocks();
  });

  describe('findAllByExpert', () => {
    it('should return memories for an expert', async () => {
      const mockMemories = [
        {
          id: 'mem1',
          expertId: 'exp1',
          sessionId: null,
          type: MemoryType.USER_NOTE,
          content: 'Test note',
          relevance: 1.0,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.expert.findUnique.mockResolvedValue({ id: 'exp1' });
      mockPrismaService.expertMemory.findMany.mockResolvedValue(mockMemories);

      const result = await service.findAllByExpert('exp1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mem1');
    });

    it('should throw NotFoundException for non-existent expert', async () => {
      mockPrismaService.expert.findUnique.mockResolvedValue(null);

      await expect(service.findAllByExpert('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a USER_NOTE memory', async () => {
      const mockExpert = { id: 'exp1', memoryMaxEntries: 50 };
      const mockMemory = {
        id: 'mem1',
        expertId: 'exp1',
        sessionId: null,
        type: MemoryType.USER_NOTE,
        content: 'My note',
        relevance: 1.0,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.expert.findUnique.mockResolvedValue(mockExpert);
      mockPrismaService.expertMemory.create.mockResolvedValue(mockMemory);
      mockPrismaService.expertMemory.count.mockResolvedValue(1);

      const result = await service.create('exp1', { content: 'My note' });
      expect(result.content).toBe('My note');
      expect(result.type).toBe(MemoryType.USER_NOTE);
    });
  });

  describe('update', () => {
    it('should update memory content', async () => {
      const mockMemory = {
        id: 'mem1',
        expertId: 'exp1',
        sessionId: null,
        type: MemoryType.USER_NOTE,
        content: 'Updated note',
        relevance: 0.8,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.expertMemory.findUnique.mockResolvedValue({ ...mockMemory, content: 'Old note' });
      mockPrismaService.expertMemory.update.mockResolvedValue(mockMemory);

      const result = await service.update('exp1', 'mem1', { content: 'Updated note' });
      expect(result.content).toBe('Updated note');
    });

    it('should throw NotFoundException for wrong expertId', async () => {
      mockPrismaService.expertMemory.findUnique.mockResolvedValue({
        id: 'mem1',
        expertId: 'different-expert',
      });

      await expect(service.update('exp1', 'mem1', { content: 'test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a memory', async () => {
      mockPrismaService.expertMemory.findUnique.mockResolvedValue({
        id: 'mem1',
        expertId: 'exp1',
      });
      mockPrismaService.expertMemory.delete.mockResolvedValue(undefined);

      await expect(service.remove('exp1', 'mem1')).resolves.not.toThrow();
    });
  });

  describe('clearAllByExpert', () => {
    it('should delete all memories for an expert', async () => {
      mockPrismaService.expert.findUnique.mockResolvedValue({ id: 'exp1' });
      mockPrismaService.expertMemory.deleteMany.mockResolvedValue({ count: 5 });

      await expect(service.clearAllByExpert('exp1')).resolves.not.toThrow();
      expect(mockPrismaService.expertMemory.deleteMany).toHaveBeenCalledWith({
        where: { expertId: 'exp1' },
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/memory/memory.service.spec.ts --no-cache`
Expected: FAIL with "Cannot find module './memory.service'"

- [ ] **Step 3: Write MemoryService implementation**

Create `src/memory/memory.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { MessageService } from '../message/message.service';
import { CreateMemoryDto, UpdateMemoryDto, MemoryResponseDto } from './dto';
import { extractKeywords } from './utils/keywords';
import { scoreMemory, calculateEffectiveRelevance } from './utils/relevance';
import { LLMConfig } from '../llm/dto';
import { plainToInstance } from 'class-transformer';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const SUMMARIZATION_PROMPT = `You are summarizing your participation in a group discussion.

Problem statement: {problemStatement}

Your messages (chronological):
{expertMessages}

Other experts' messages (chronological):
{otherMessages}

Generate a JSON response with this structure:
{
  "summary": "2-3 paragraph summary of your contributions, positions, and conclusions",
  "insights": [
    { "text": "A specific insight or decision", "topics": ["keyword1", "keyword2"] }
  ],
  "topics": ["keyword1", "keyword2", "keyword3"]
}

Rules:
- Summary should capture your key positions and reasoning, not just what was discussed.
- Insights should be specific, actionable claims — not vague observations.
- Topics should be 5-10 domain-specific keywords (not generic words like "discussion").
- Maximum 5 insights.
- Respond with ONLY the JSON object, no markdown fences or extra text.`;

const MAX_MEMORY_TOKENS = 3000;

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverFactory: DriverFactory,
    private readonly messageService: MessageService,
  ) {}

  // --- CRUD ---

  async findAllByExpert(
    expertId: string,
    options?: { type?: MemoryType; page?: number; limit?: number },
  ): Promise<MemoryResponseDto[]> {
    await this.ensureExpertExists(expertId);

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;

    const where: Record<string, unknown> = { expertId };
    if (options?.type) {
      where.type = options.type;
    }

    const memories = await this.prisma.expertMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return memories.map((m) => MemoryResponseDto.fromPrisma(m));
  }

  async findOne(expertId: string, memoryId: string): Promise<MemoryResponseDto> {
    const memory = await this.findAndValidateOwnership(expertId, memoryId);
    return MemoryResponseDto.fromPrisma(memory);
  }

  async create(expertId: string, dto: CreateMemoryDto): Promise<MemoryResponseDto> {
    const expert = await this.ensureExpertExists(expertId);

    const memory = await this.prisma.expertMemory.create({
      data: {
        expertId,
        type: MemoryType.USER_NOTE,
        content: dto.content,
        relevance: dto.relevance ?? 1.0,
        metadata: dto.metadata ?? null,
      },
    });

    // Prune if over limit
    await this.pruneIfNeeded(expertId, expert.memoryMaxEntries);

    return MemoryResponseDto.fromPrisma(memory);
  }

  async update(
    expertId: string,
    memoryId: string,
    dto: UpdateMemoryDto,
  ): Promise<MemoryResponseDto> {
    await this.findAndValidateOwnership(expertId, memoryId);

    const updated = await this.prisma.expertMemory.update({
      where: { id: memoryId },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.relevance !== undefined && { relevance: dto.relevance }),
      },
    });

    return MemoryResponseDto.fromPrisma(updated);
  }

  async remove(expertId: string, memoryId: string): Promise<void> {
    await this.findAndValidateOwnership(expertId, memoryId);
    await this.prisma.expertMemory.delete({ where: { id: memoryId } });
  }

  async clearAllByExpert(expertId: string): Promise<void> {
    await this.ensureExpertExists(expertId);
    await this.prisma.expertMemory.deleteMany({ where: { expertId } });
  }

  // --- Memory Generation ---

  async generateSessionMemory(expertId: string, sessionId: string): Promise<void> {
    const expert = await this.prisma.expert.findUnique({ where: { id: expertId } });
    if (!expert || !expert.memoryEnabled) return;

    try {
      const allMessages = await this.messageService.findBySession(sessionId);
      const expertMessages = allMessages.filter((m) => m.expertId === expertId);
      const otherMessages = allMessages.filter((m) => m.expertId !== expertId);

      if (expertMessages.length === 0) return;

      // Get session problem statement
      const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
      if (!session) return;

      // Build summarization prompt
      const prompt = SUMMARIZATION_PROMPT
        .replace('{problemStatement}', session.problemStatement)
        .replace(
          '{expertMessages}',
          expertMessages.map((m) => m.content).join('\n\n'),
        )
        .replace(
          '{otherMessages}',
          otherMessages
            .map((m) => `[${m.expertName || 'Unknown'}] ${m.content}`)
            .join('\n\n'),
        );

      // Use expert's own LLM
      const driver = this.driverFactory.createDriver(expert.driverType);
      const config = plainToInstance(LLMConfig, expert.config);

      const response = await driver.chat(
        [{ role: 'user', content: prompt }],
        config,
      );

      // Parse JSON response
      const parsed = this.parseSummarizationResponse(response.content);
      if (!parsed) {
        this.logger.warn(`Failed to parse summarization response for expert ${expertId}`);
        return;
      }

      // Create SESSION_SUMMARY
      await this.prisma.expertMemory.create({
        data: {
          expertId,
          sessionId,
          type: MemoryType.SESSION_SUMMARY,
          content: parsed.summary,
          relevance: 1.0,
          metadata: {
            topics: parsed.topics,
            sessionTitle: session.problemStatement.substring(0, 100),
          },
        },
      });

      // Create KEY_INSIGHT entries (max 5)
      for (const insight of parsed.insights.slice(0, 5)) {
        await this.prisma.expertMemory.create({
          data: {
            expertId,
            sessionId,
            type: MemoryType.KEY_INSIGHT,
            content: insight.text,
            relevance: 1.0,
            metadata: { topics: insight.topics },
          },
        });
      }

      // Prune if needed
      await this.pruneIfNeeded(expertId, expert.memoryMaxEntries);

      this.logger.log(
        `Generated memory for expert ${expertId}: 1 summary + ${parsed.insights.length} insights`,
      );
    } catch (error) {
      // Memory generation failures should not break session flow
      this.logger.error(
        `Failed to generate memory for expert ${expertId}, session ${sessionId}: ${error.message}`,
        error.stack,
      );
    }
  }

  // --- Memory Injection ---

  async getRelevantMemories(
    expertId: string,
    problemStatement: string,
    maxInject: number,
  ): Promise<{ memories: MemoryResponseDto[]; ids: string[] }> {
    const memories = await this.prisma.expertMemory.findMany({
      where: {
        expertId,
        relevance: { gt: 0.1 },
      },
    });

    if (memories.length === 0) return { memories: [], ids: [] };

    const queryTopics = extractKeywords(problemStatement);

    // Score and sort
    const scored = memories.map((m) => {
      const memoryTopics = (m.metadata as { topics?: string[] })?.topics ?? [];
      const score =
        m.type === 'USER_NOTE'
          ? m.relevance * 1.0 * calculateTopicOverlapForScore(memoryTopics, queryTopics)
          : scoreMemory(m.relevance, m.createdAt, memoryTopics, queryTopics);
      return { memory: m, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Take top N
    let selected = scored.slice(0, maxInject);

    // Token budget check (~4 chars per token)
    let totalTokens = selected.reduce((sum, s) => sum + Math.ceil(s.memory.content.length / 4), 0);
    if (totalTokens > MAX_MEMORY_TOKENS && selected.length > 3) {
      selected = selected.slice(0, 3);
    }

    const dtos = selected.map((s) => MemoryResponseDto.fromPrisma(s.memory));
    const ids = selected.map((s) => s.memory.id);

    return { memories: dtos, ids };
  }

  formatMemoriesForInjection(memories: MemoryResponseDto[]): string {
    if (memories.length === 0) return '';

    const lines = memories.map((m) => {
      const meta = m.metadata as { sessionTitle?: string } | null;
      const age = this.formatAge(m.createdAt);

      switch (m.type) {
        case 'SESSION_SUMMARY': {
          const title = meta?.sessionTitle ?? 'Unknown session';
          return `[Session: "${title}" - ${age}]\n${m.content}`;
        }
        case 'KEY_INSIGHT':
          return `[Key Insight - ${age}]\n${m.content}`;
        case 'USER_NOTE':
          return `[Note]\n${m.content}`;
        default:
          return m.content;
      }
    });

    return `Relevant Memory from Past Sessions:\n---\n${lines.join('\n\n')}\n---\nReference these memories naturally when relevant. Prioritize the current problem statement.`;
  }

  // --- Private Helpers ---

  private async ensureExpertExists(expertId: string) {
    const expert = await this.prisma.expert.findUnique({ where: { id: expertId } });
    if (!expert) {
      throw new NotFoundException(`Expert with ID ${expertId} not found`);
    }
    return expert;
  }

  private async findAndValidateOwnership(expertId: string, memoryId: string) {
    const memory = await this.prisma.expertMemory.findUnique({ where: { id: memoryId } });
    if (!memory || memory.expertId !== expertId) {
      throw new NotFoundException(
        `Memory with ID ${memoryId} not found for expert ${expertId}`,
      );
    }
    return memory;
  }

  private async pruneIfNeeded(expertId: string, maxEntries: number): Promise<void> {
    const count = await this.prisma.expertMemory.count({ where: { expertId } });
    if (count <= maxEntries) return;

    // Get lowest-relevance non-USER_NOTE entries
    const toPrune = await this.prisma.expertMemory.findMany({
      where: {
        expertId,
        type: { not: MemoryType.USER_NOTE },
      },
      orderBy: { relevance: 'asc' },
      take: count - maxEntries,
    });

    if (toPrune.length > 0) {
      await this.prisma.expertMemory.deleteMany({
        where: { id: { in: toPrune.map((m) => m.id) } },
      });
    }
  }

  private parseSummarizationResponse(
    content: string,
  ): { summary: string; insights: { text: string; topics: string[] }[]; topics: string[] } | null {
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.summary || typeof parsed.summary !== 'string') return null;

      return {
        summary: parsed.summary,
        insights: Array.isArray(parsed.insights)
          ? parsed.insights.filter(
              (i: unknown) =>
                typeof i === 'object' &&
                i !== null &&
                typeof (i as { text?: unknown }).text === 'string',
            )
          : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      };
    } catch {
      return null;
    }
  }

  private formatAge(date: Date): string {
    const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return '1 week ago';
    return `${weeks} weeks ago`;
  }
}

// Helper to avoid circular import — inline version for scoring USER_NOTEs
function calculateTopicOverlapForScore(memoryTopics: string[], queryTopics: string[]): number {
  if (memoryTopics.length === 0 || queryTopics.length === 0) return 0.2;
  const setA = new Set(memoryTopics);
  const setB = new Set(queryTopics);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return Math.max(0.2, intersection.size / union.size);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/memory/memory.service.spec.ts --no-cache`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/memory/memory.service.ts src/memory/memory.service.spec.ts
git commit -m "[memory] add MemoryService with CRUD, generation, and injection logic"
```

---

## Task 6: MemoryController

**Files:**
- Create: `src/memory/memory.controller.ts`
- Test: `src/memory/memory.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/memory/memory.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { MemoryType } from '@prisma/client';

const mockMemoryService = {
  findAllByExpert: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  clearAllByExpert: jest.fn(),
};

describe('MemoryController', () => {
  let controller: MemoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoryController],
      providers: [{ provide: MemoryService, useValue: mockMemoryService }],
    }).compile();

    controller = module.get<MemoryController>(MemoryController);
    jest.clearAllMocks();
  });

  it('should call findAllByExpert with correct params', async () => {
    mockMemoryService.findAllByExpert.mockResolvedValue([]);
    const result = await controller.findAll('exp1', undefined, '1', '20');
    expect(mockMemoryService.findAllByExpert).toHaveBeenCalledWith('exp1', {
      type: undefined,
      page: 1,
      limit: 20,
    });
    expect(result).toEqual([]);
  });

  it('should call create with USER_NOTE type', async () => {
    const dto = { content: 'A note' };
    mockMemoryService.create.mockResolvedValue({ id: 'mem1', ...dto });
    await controller.create('exp1', dto);
    expect(mockMemoryService.create).toHaveBeenCalledWith('exp1', dto);
  });

  it('should call clearAllByExpert when confirm=true', async () => {
    await controller.clearAll('exp1', 'true');
    expect(mockMemoryService.clearAllByExpert).toHaveBeenCalledWith('exp1');
  });

  it('should throw when confirm is not true for clearAll', async () => {
    await expect(controller.clearAll('exp1', 'false')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/memory/memory.controller.spec.ts --no-cache`
Expected: FAIL with "Cannot find module './memory.controller'"

- [ ] **Step 3: Write MemoryController implementation**

Create `src/memory/memory.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  BadRequestException,
} from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { MemoryService } from './memory.service';
import { CreateMemoryDto, UpdateMemoryDto, MemoryResponseDto } from './dto';

@Controller('experts/:expertId/memories')
@UseInterceptors(ClassSerializerInterceptor)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  findAll(
    @Param('expertId') expertId: string,
    @Query('type') type?: MemoryType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<MemoryResponseDto[]> {
    return this.memoryService.findAllByExpert(expertId, {
      type,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':memoryId')
  findOne(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
  ): Promise<MemoryResponseDto> {
    return this.memoryService.findOne(expertId, memoryId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('expertId') expertId: string,
    @Body() dto: CreateMemoryDto,
  ): Promise<MemoryResponseDto> {
    return this.memoryService.create(expertId, dto);
  }

  @Patch(':memoryId')
  update(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
    @Body() dto: UpdateMemoryDto,
  ): Promise<MemoryResponseDto> {
    return this.memoryService.update(expertId, memoryId, dto);
  }

  @Delete(':memoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
  ): Promise<void> {
    return this.memoryService.remove(expertId, memoryId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearAll(
    @Param('expertId') expertId: string,
    @Query('confirm') confirm?: string,
  ): Promise<void> {
    if (confirm !== 'true') {
      throw new BadRequestException(
        'Pass ?confirm=true to clear all memories for this expert',
      );
    }
    return this.memoryService.clearAllByExpert(expertId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/memory/memory.controller.spec.ts --no-cache`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/memory/memory.controller.ts src/memory/memory.controller.spec.ts
git commit -m "[memory] add MemoryController with REST endpoints"
```

---

## Task 7: MemoryModule + Wire Into App

**Files:**
- Create: `src/memory/memory.module.ts`
- Modify: `src/app.module.ts`
- Modify: `src/council/council.module.ts`

- [ ] **Step 1: Create MemoryModule**

Create `src/memory/memory.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { MessageModule } from '../message/message.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [MessageModule, LlmModule],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
```

- [ ] **Step 2: Add MemoryModule to AppModule**

In `src/app.module.ts`, add the import at the top:

```typescript
import { MemoryModule } from './memory/memory.module';
```

Add `MemoryModule` to the `imports` array:

```typescript
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
    MemoryModule,
  ],
```

- [ ] **Step 3: Import MemoryModule into CouncilModule**

In `src/council/council.module.ts`, add:

```typescript
import { MemoryModule } from '../memory/memory.module';
```

And add `MemoryModule` to the imports array:

```typescript
imports: [SessionModule, MessageModule, LlmModule, MemoryModule],
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx nest build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/memory/memory.module.ts src/app.module.ts src/council/council.module.ts
git commit -m "[memory] wire MemoryModule into app and council modules"
```

---

## Task 8: Update Expert DTOs for Memory Config Fields

**Files:**
- Modify: `src/expert/dto/create-expert.dto.ts`
- Modify: `src/expert/dto/expert-response.dto.ts`

- [ ] **Step 1: Add memory config fields to CreateExpertDto**

In `src/expert/dto/create-expert.dto.ts`, add these imports at the top:

```typescript
import { IsBoolean, IsInt, Min, Max, IsOptional } from 'class-validator';
```

(Merge with existing import — final top import line becomes):

```typescript
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsObject,
  ValidateNested,
  IsDefined,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
```

Add these fields after the `config` field:

```typescript
  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  memoryMaxEntries?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  memoryMaxInject?: number;
```

- [ ] **Step 2: Add memory fields to ExpertResponseDto**

In `src/expert/dto/expert-response.dto.ts`, add these exposed fields before `createdAt`:

```typescript
  @Expose()
  memoryEnabled: boolean;

  @Expose()
  memoryMaxEntries: number;

  @Expose()
  memoryMaxInject: number;
```

Update the `fromPrisma` method to include the new fields:

```typescript
  static fromPrisma(expert: Expert): ExpertResponseDto {
    return new ExpertResponseDto({
      id: expert.id,
      name: expert.name,
      specialty: expert.specialty,
      systemPrompt: expert.systemPrompt,
      driverType: expert.driverType,
      config: expert.config,
      memoryEnabled: expert.memoryEnabled,
      memoryMaxEntries: expert.memoryMaxEntries,
      memoryMaxInject: expert.memoryMaxInject,
      createdAt: expert.createdAt,
      updatedAt: expert.updatedAt,
    });
  }
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx nest build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/expert/dto/create-expert.dto.ts src/expert/dto/expert-response.dto.ts
git commit -m "[memory] add memory config fields to expert DTOs"
```

---

## Task 9: Integrate Memory into CouncilService

**Files:**
- Modify: `src/council/council.service.ts`
- Modify: `src/council/events/discussion.events.ts`
- Modify: `src/council/gateways/discussion.gateway.ts`

This is the core integration — memory injection into `buildExpertContext()` and generation after `concludeSession()`.

- [ ] **Step 1: Update ExpertTurnStartEvent to include injectedMemoryIds**

In `src/council/events/discussion.events.ts`, update the `ExpertTurnStartEvent` interface:

```typescript
export interface ExpertTurnStartEvent {
  sessionId: string;
  expertId: string;
  expertName: string;
  turnNumber: number;
  injectedMemoryIds: string[];
}
```

- [ ] **Step 2: Update DiscussionGateway to forward injectedMemoryIds**

In `src/council/gateways/discussion.gateway.ts`, update the `EXPERT_TURN_START` event listener (in the `onModuleInit` method, around line 185):

```typescript
    this.eventEmitter.on(DISCUSSION_EVENTS.EXPERT_TURN_START, (event: ExpertTurnStartEvent) => {
      const roomName = `session:${event.sessionId}`;
      this.server.to(roomName).emit('expert-turn-start', {
        sessionId: event.sessionId,
        expertId: event.expertId,
        expertName: event.expertName,
        turnNumber: event.turnNumber,
        injectedMemoryIds: event.injectedMemoryIds,
      });
    });
```

- [ ] **Step 3: Inject MemoryService into CouncilService**

In `src/council/council.service.ts`, add the import at the top:

```typescript
import { MemoryService } from '../memory/memory.service';
```

Update the constructor to inject MemoryService:

```typescript
  constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly driverFactory: DriverFactory,
    private readonly eventEmitter: EventEmitter2,
    private readonly memoryService: MemoryService,
  ) {}
```

- [ ] **Step 4: Update buildExpertContext to accept and inject memory text**

Change the `buildExpertContext` method signature and body to accept an optional memory string:

```typescript
  private buildExpertContext(
    session: SessionResponseDto,
    currentExpert: ExpertResponseDto,
    allExperts: ExpertResponseDto[],
    recentMessages: MessageResponseDto[],
    memoryText?: string,
  ): LLMMessage[] {
    // Build system message with expert's role and instructions
    const expertList = allExperts
      .map((expert) => `- ${expert.name} (${expert.specialty})`)
      .join('\n');

    const memorySection = memoryText ? `\n\n${memoryText}\n` : '';

    const systemMessage: LLMMessage = {
      role: 'system',
      content: `${currentExpert.systemPrompt}
${memorySection}
Problem Statement:
${session.problemStatement}

Participating Experts:
${expertList}

Instructions:
You are participating in a collaborative discussion with other experts. Work towards consensus on the problem statement. When consensus is reached, explicitly state "I agree" or "consensus reached" in your response. You can reference other experts by name in your discussion.`,
    };

    // Convert recent messages to LLM format
    const conversationMessages: LLMMessage[] = recentMessages.map((msg) => {
      const expertPrefix = msg.expertName ? `[${msg.expertName}] ` : '';
      return {
        role: this.mapMessageRoleToLLMRole(msg.role),
        content: `${expertPrefix}${msg.content}`,
      };
    });

    return [systemMessage, ...conversationMessages];
  }
```

- [ ] **Step 5: Add memory retrieval before building context in the discussion loop**

In the main discussion loop (around line 215-224 in the current file), replace the context-building block. Find this code:

```typescript
        // Retrieve recent messages for context
        const recentMessages = await this.messageService.findLatestBySession(sessionId, 10);

        // Build context for the current expert
        const contextMessages = this.buildExpertContext(
          session,
          currentExpert,
          experts,
          recentMessages,
        );
```

Replace with:

```typescript
        // Retrieve recent messages for context
        const recentMessages = await this.messageService.findLatestBySession(sessionId, 10);

        // Retrieve relevant memories for the current expert
        let memoryText = '';
        let injectedMemoryIds: string[] = [];
        if (currentExpert.memoryEnabled) {
          try {
            const { memories, ids } = await this.memoryService.getRelevantMemories(
              currentExpert.id,
              session.problemStatement,
              currentExpert.memoryMaxInject,
            );
            injectedMemoryIds = ids;
            memoryText = this.memoryService.formatMemoriesForInjection(memories);
          } catch (error) {
            this.logger.warn(`Failed to retrieve memories for expert ${currentExpert.name}: ${error.message}`);
          }
        }

        // Build context for the current expert
        const contextMessages = this.buildExpertContext(
          session,
          currentExpert,
          experts,
          recentMessages,
          memoryText,
        );
```

- [ ] **Step 6: Update the EXPERT_TURN_START event emission to include injectedMemoryIds**

Find this code (around line 208):

```typescript
        // Emit expert turn start event
        this.eventEmitter.emit(DISCUSSION_EVENTS.EXPERT_TURN_START, {
          sessionId,
          expertId: currentExpert.id,
          expertName: currentExpert.name,
          turnNumber: currentExpertIndex + 1,
        } as ExpertTurnStartEvent);
```

Move it to AFTER the memory retrieval block (after the `memoryText` and `injectedMemoryIds` variables are set), and update it:

```typescript
        // Emit expert turn start event
        this.eventEmitter.emit(DISCUSSION_EVENTS.EXPERT_TURN_START, {
          sessionId,
          expertId: currentExpert.id,
          expertName: currentExpert.name,
          turnNumber: currentExpertIndex + 1,
          injectedMemoryIds,
        } as ExpertTurnStartEvent);
```

- [ ] **Step 7: Add memory generation after concludeSession**

Find this code (around line 316):

```typescript
      // Conclude the session
      await this.concludeSession(sessionId, consensusReached);
```

Add memory generation right after:

```typescript
      // Conclude the session
      await this.concludeSession(sessionId, consensusReached);

      // Generate memories for each expert (async, non-blocking)
      for (const expert of experts) {
        if (expert.memoryEnabled) {
          this.memoryService
            .generateSessionMemory(expert.id, sessionId)
            .catch((error) =>
              this.logger.error(
                `Memory generation failed for expert ${expert.name}: ${error.message}`,
              ),
            );
        }
      }
```

Note: `generateSessionMemory` is intentionally fire-and-forget (no `await`). Memory generation should not delay the session end response.

- [ ] **Step 8: Verify the app compiles**

Run: `npx nest build`
Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/council/council.service.ts src/council/events/discussion.events.ts src/council/gateways/discussion.gateway.ts
git commit -m "[memory] integrate memory injection and generation into council service"
```

---

## Task 10: Frontend Types and API Client

**Files:**
- Create: `frontend/src/types/memory.ts`
- Create: `frontend/src/lib/api/memories.ts`
- Modify: `frontend/src/types/expert.ts`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Create memory types**

Create `frontend/src/types/memory.ts`:

```typescript
export enum MemoryType {
  SESSION_SUMMARY = 'SESSION_SUMMARY',
  KEY_INSIGHT = 'KEY_INSIGHT',
  USER_NOTE = 'USER_NOTE',
}

export interface MemoryResponse {
  id: string;
  expertId: string;
  sessionId: string | null;
  type: MemoryType;
  content: string;
  relevance: number;
  effectiveRelevance: number;
  metadata: {
    topics?: string[];
    sessionTitle?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryDto {
  content: string;
  relevance?: number;
  metadata?: {
    topics?: string[];
  };
}

export interface UpdateMemoryDto {
  content?: string;
  relevance?: number;
}
```

- [ ] **Step 2: Add memory fields to ExpertResponse**

In `frontend/src/types/expert.ts`, add to `CreateExpertDto`:

```typescript
  memoryEnabled?: boolean;
  memoryMaxEntries?: number;
  memoryMaxInject?: number;
```

Add to `ExpertResponse`:

```typescript
  memoryEnabled: boolean;
  memoryMaxEntries: number;
  memoryMaxInject: number;
```

The full updated file:

```typescript
export enum DriverType {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GROK = 'GROK',
}

export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
}

export interface CreateExpertDto {
  name: string;
  specialty: string;
  systemPrompt: string;
  driverType: DriverType;
  config: LLMConfig;
  memoryEnabled?: boolean;
  memoryMaxEntries?: number;
  memoryMaxInject?: number;
}

export type UpdateExpertDto = Partial<CreateExpertDto>;

export interface ExpertResponse {
  id: string;
  name: string;
  specialty: string;
  systemPrompt: string;
  driverType: DriverType;
  config: LLMConfig;
  memoryEnabled: boolean;
  memoryMaxEntries: number;
  memoryMaxInject: number;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 3: Export memory types from index**

In `frontend/src/types/index.ts`, add:

```typescript
export type { MemoryResponse, CreateMemoryDto, UpdateMemoryDto } from './memory';
export { MemoryType } from './memory';
```

- [ ] **Step 4: Create memory API client**

Create `frontend/src/lib/api/memories.ts`:

```typescript
import { apiClient } from '../api';
import type { MemoryResponse, CreateMemoryDto, UpdateMemoryDto } from '@/types';
import { MemoryType } from '@/types';

export async function getExpertMemories(
  expertId: string,
  options?: { type?: MemoryType; page?: number; limit?: number },
): Promise<MemoryResponse[]> {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));

  const query = params.toString();
  const url = `/experts/${expertId}/memories${query ? `?${query}` : ''}`;
  const response = await apiClient.get<MemoryResponse[]>(url);
  return response.data;
}

export async function getExpertMemory(
  expertId: string,
  memoryId: string,
): Promise<MemoryResponse> {
  const response = await apiClient.get<MemoryResponse>(
    `/experts/${expertId}/memories/${memoryId}`,
  );
  return response.data;
}

export async function createExpertMemory(
  expertId: string,
  data: CreateMemoryDto,
): Promise<MemoryResponse> {
  const response = await apiClient.post<MemoryResponse>(
    `/experts/${expertId}/memories`,
    data,
  );
  return response.data;
}

export async function updateExpertMemory(
  expertId: string,
  memoryId: string,
  data: UpdateMemoryDto,
): Promise<MemoryResponse> {
  const response = await apiClient.patch<MemoryResponse>(
    `/experts/${expertId}/memories/${memoryId}`,
    data,
  );
  return response.data;
}

export async function deleteExpertMemory(
  expertId: string,
  memoryId: string,
): Promise<void> {
  await apiClient.delete(`/experts/${expertId}/memories/${memoryId}`);
}

export async function clearExpertMemories(expertId: string): Promise<void> {
  await apiClient.delete(`/experts/${expertId}/memories?confirm=true`);
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/memory.ts frontend/src/types/expert.ts frontend/src/types/index.ts frontend/src/lib/api/memories.ts
git commit -m "[memory] add frontend types and API client for memory CRUD"
```

---

## Task 11: Expert Form — Memory Settings

**Files:**
- Modify: `frontend/src/lib/validations/expert.ts`
- Modify: `frontend/src/components/experts/ExpertForm.tsx`

- [ ] **Step 1: Update expert form schema**

In `frontend/src/lib/validations/expert.ts`, add memory fields to the schema:

```typescript
import { z } from "zod";
import { DriverType } from "@/types";

export const expertFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  specialty: z.string().min(1, "Specialty is required").max(200, "Specialty must be less than 200 characters"),
  systemPrompt: z.string().min(10, "System prompt must be at least 10 characters").max(5000, "System prompt must be less than 5000 characters"),
  driverType: z.nativeEnum(DriverType, {
    required_error: "Driver type is required",
  }),
  config: z.object({
    model: z.string().min(1, "Model is required"),
    temperature: z.number().min(0, "Temperature must be at least 0").max(2, "Temperature must be at most 2").optional(),
    maxTokens: z.number().int().positive("Max tokens must be positive").optional(),
    topP: z.number().min(0, "Top P must be at least 0").max(1, "Top P must be at most 1").optional(),
    stop: z.array(z.string()).optional(),
  }),
  memoryEnabled: z.boolean().optional(),
  memoryMaxEntries: z.number().int().min(1).max(500).optional(),
  memoryMaxInject: z.number().int().min(1).max(20).optional(),
});

export type ExpertFormValues = z.infer<typeof expertFormSchema>;
```

- [ ] **Step 2: Add memory settings to ExpertForm**

In `frontend/src/components/experts/ExpertForm.tsx`, add the `Checkbox` import from shadcn/ui. Add this import at the top, alongside other imports:

```typescript
import { Checkbox } from "@/components/ui/checkbox";
```

Update `defaultValues` in the form initialization. When `expert` is provided, add:

```typescript
          memoryEnabled: expert.memoryEnabled ?? true,
          memoryMaxEntries: expert.memoryMaxEntries ?? 50,
          memoryMaxInject: expert.memoryMaxInject ?? 5,
```

When no expert (creation), add:

```typescript
          memoryEnabled: true,
          memoryMaxEntries: 50,
          memoryMaxInject: 5,
```

Add a memory settings section before the closing `<div className="flex justify-end gap-2 pt-4">`. Insert after the Stop Tokens field (after line 292):

```tsx
        {/* Memory Settings */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-medium mb-3">Memory Settings</h3>

          <FormField
            control={form.control}
            name="memoryEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 mb-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="font-normal">
                  Enable persistent memory
                </FormLabel>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="memoryMaxEntries"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Stored Memories</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      max="500"
                      {...field}
                      onChange={(e) => {
                        if (e.target.value === '') {
                          field.onChange(undefined);
                        } else {
                          field.onChange(parseInt(e.target.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="memoryMaxInject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Memories Per Turn</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      max="20"
                      {...field}
                      onChange={(e) => {
                        if (e.target.value === '') {
                          field.onChange(undefined);
                        } else {
                          field.onChange(parseInt(e.target.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
```

- [ ] **Step 3: Verify the frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/validations/expert.ts frontend/src/components/experts/ExpertForm.tsx
git commit -m "[memory] add memory settings to expert form"
```

---

## Task 12: Memory Tab Components

**Files:**
- Create: `frontend/src/components/experts/MemoryCard.tsx`
- Create: `frontend/src/components/experts/AddNoteDialog.tsx`
- Create: `frontend/src/components/experts/ClearMemoryDialog.tsx`
- Create: `frontend/src/components/experts/MemoryTab.tsx`

- [ ] **Step 1: Create MemoryCard component**

Create `frontend/src/components/experts/MemoryCard.tsx`:

```tsx
import { useState } from "react";
import { MemoryResponse, MemoryType } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Pencil, Check, X } from "lucide-react";

interface MemoryCardProps {
  memory: MemoryResponse;
  onUpdate: (memoryId: string, data: { content?: string; relevance?: number }) => Promise<void>;
  onDelete: (memoryId: string) => Promise<void>;
}

function relevanceColor(value: number): string {
  if (value > 0.7) return "bg-green-100 text-green-800";
  if (value > 0.3) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function typeLabel(type: MemoryType): string {
  switch (type) {
    case MemoryType.SESSION_SUMMARY:
      return "Summary";
    case MemoryType.KEY_INSIGHT:
      return "Insight";
    case MemoryType.USER_NOTE:
      return "Note";
    default:
      return type;
  }
}

function formatAge(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  return `${weeks} weeks ago`;
}

export function MemoryCard({ memory, onUpdate, onDelete }: MemoryCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(memory.content);
  const [editRelevance, setEditRelevance] = useState(memory.relevance);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(memory.id, {
        content: editContent,
        relevance: editRelevance,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditContent(memory.content);
    setEditRelevance(memory.relevance);
    setEditing(false);
  };

  const displayContent =
    !expanded && memory.content.length > 200
      ? memory.content.substring(0, 200) + "..."
      : memory.content;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {typeLabel(memory.type)}
          </Badge>
          <Badge className={`text-xs ${relevanceColor(memory.effectiveRelevance)}`}>
            {memory.effectiveRelevance.toFixed(2)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatAge(memory.createdAt)}
          </span>
        </div>
        <div className="flex gap-1">
          {editing ? (
            <>
              <Button size="icon" variant="ghost" onClick={handleSave} disabled={saving}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" onClick={handleCancel}>
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDelete(memory.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Relevance:</label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={editRelevance}
              onChange={(e) => setEditRelevance(parseFloat(e.target.value))}
              className="w-20 h-7 text-sm"
            />
          </div>
        </div>
      ) : (
        <p
          className="text-sm cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {displayContent}
        </p>
      )}

      {memory.metadata?.sessionTitle && (
        <p className="text-xs text-muted-foreground">
          Session: {memory.metadata.sessionTitle}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create AddNoteDialog component**

Create `frontend/src/components/experts/AddNoteDialog.tsx`:

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (content: string) => Promise<void>;
}

export function AddNoteDialog({ open, onOpenChange, onSubmit }: AddNoteDialogProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Memory Note</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="Enter a note for this expert to remember..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[120px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !content.trim()}>
            {submitting ? "Saving..." : "Add Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create ClearMemoryDialog component**

Create `frontend/src/components/experts/ClearMemoryDialog.tsx`:

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClearMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  expertName: string;
}

export function ClearMemoryDialog({
  open,
  onOpenChange,
  onConfirm,
  expertName,
}: ClearMemoryDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear All Memories</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all memories for {expertName}. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear All
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Create MemoryTab component**

Create `frontend/src/components/experts/MemoryTab.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import { ExpertResponse, MemoryResponse, MemoryType } from "@/types";
import {
  getExpertMemories,
  createExpertMemory,
  updateExpertMemory,
  deleteExpertMemory,
  clearExpertMemories,
} from "@/lib/api/memories";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemoryCard } from "./MemoryCard";
import { AddNoteDialog } from "./AddNoteDialog";
import { ClearMemoryDialog } from "./ClearMemoryDialog";
import { Plus, Trash2, RefreshCw, Search } from "lucide-react";

interface MemoryTabProps {
  expert: ExpertResponse;
}

export function MemoryTab({ expert }: MemoryTabProps) {
  const [memories, setMemories] = useState<MemoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const { toast } = useToast();

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const type = filterType === "all" ? undefined : (filterType as MemoryType);
      const data = await getExpertMemories(expert.id, { type, limit: 100 });
      setMemories(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch memories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [expert.id, filterType, toast]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleAddNote = async (content: string) => {
    await createExpertMemory(expert.id, { content });
    toast({ title: "Note added" });
    fetchMemories();
  };

  const handleUpdate = async (
    memoryId: string,
    data: { content?: string; relevance?: number },
  ) => {
    await updateExpertMemory(expert.id, memoryId, data);
    toast({ title: "Memory updated" });
    fetchMemories();
  };

  const handleDelete = async (memoryId: string) => {
    await deleteExpertMemory(expert.id, memoryId);
    toast({ title: "Memory deleted" });
    fetchMemories();
  };

  const handleClearAll = async () => {
    await clearExpertMemories(expert.id);
    toast({ title: "All memories cleared" });
    fetchMemories();
  };

  const filtered = searchQuery
    ? memories.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : memories;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value={MemoryType.SESSION_SUMMARY}>Summaries</SelectItem>
            <SelectItem value={MemoryType.KEY_INSIGHT}>Insights</SelectItem>
            <SelectItem value={MemoryType.USER_NOTE}>Notes</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchMemories} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button onClick={() => setAddNoteOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Note
        </Button>
        {memories.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setClearOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {/* Memory List */}
      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading memories...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {searchQuery ? "No memories match your search." : "No memories yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AddNoteDialog
        open={addNoteOpen}
        onOpenChange={setAddNoteOpen}
        onSubmit={handleAddNote}
      />

      <ClearMemoryDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        onConfirm={handleClearAll}
        expertName={expert.name}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify the frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/experts/MemoryCard.tsx frontend/src/components/experts/AddNoteDialog.tsx frontend/src/components/experts/ClearMemoryDialog.tsx frontend/src/components/experts/MemoryTab.tsx
git commit -m "[memory] add frontend memory tab components"
```

---

## Task 13: Expert Page — Memory Tab Integration

**Files:**
- Modify: `frontend/src/pages/ExpertsPage.tsx`

The current ExpertsPage uses a table with edit/delete dialogs. We need to add a way to view an expert's memory tab. The simplest approach: add a "Memory" button to each row that opens a dialog with the MemoryTab.

- [ ] **Step 1: Create ExpertMemoryDialog wrapper**

This is a dialog that wraps the MemoryTab for use from the ExpertsPage table.

Add to `frontend/src/pages/ExpertsPage.tsx` — import the MemoryTab and Dialog components at the top:

```typescript
import { MemoryTab } from "@/components/experts/MemoryTab";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
```

- [ ] **Step 2: Add memory dialog state to ExpertsPage**

Add state for the memory dialog alongside the existing dialog states:

```typescript
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
```

Add a handler:

```typescript
  const handleMemory = (expert: ExpertResponse) => {
    setSelectedExpert(expert);
    setMemoryDialogOpen(true);
  };
```

- [ ] **Step 3: Add memory dialog to the JSX**

After the `DeleteExpertDialog` component in the JSX, add:

```tsx
      <Dialog open={memoryDialogOpen} onOpenChange={setMemoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedExpert?.name} — Memory
            </DialogTitle>
          </DialogHeader>
          {selectedExpert && <MemoryTab expert={selectedExpert} />}
        </DialogContent>
      </Dialog>
```

- [ ] **Step 4: Pass handleMemory to ExpertTable**

The ExpertTable component needs a new `onMemory` callback prop. Update the `ExpertTable` usage:

```tsx
        <ExpertTable
          data={experts}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onMemory={handleMemory}
        />
```

- [ ] **Step 5: Update ExpertTable to add Memory button**

In `frontend/src/components/experts/ExpertTable.tsx`, add `onMemory` to the props interface and add a "Memory" button in the actions column. The exact changes depend on how the table actions are currently rendered — look at the existing `onEdit`/`onDelete` pattern and add a third button with `Brain` icon from lucide-react:

```tsx
import { Brain } from "lucide-react";

// In props interface:
  onMemory: (expert: ExpertResponse) => void;

// In the actions cell, alongside Edit and Delete buttons:
<Button variant="ghost" size="icon" onClick={() => onMemory(expert)}>
  <Brain className="h-4 w-4" />
</Button>
```

- [ ] **Step 6: Verify the frontend compiles and renders**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors.

Start the dev server and verify the expert table shows a Memory button, clicking it opens the memory dialog.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ExpertsPage.tsx frontend/src/components/experts/ExpertTable.tsx
git commit -m "[memory] integrate memory tab into expert management page"
```

---

## Task 14: Session Detail Page — Memory Injection Indicator

**Files:**
- Modify: `frontend/src/hooks/use-websocket.ts`
- Modify: `frontend/src/pages/SessionDetailPage.tsx`

- [ ] **Step 1: Track injectedMemoryIds in useWebSocket hook**

In `frontend/src/hooks/use-websocket.ts`, update the `CurrentExpertTurn` interface:

```typescript
interface CurrentExpertTurn {
  expertId: string;
  expertName: string;
  turnNumber: number;
  injectedMemoryIds: string[];
}
```

Update the `expert-turn-start` event handler (around line 70):

```typescript
        newSocket.on("expert-turn-start", (data: { expertId: string; expertName: string; turnNumber: number; injectedMemoryIds?: string[] }) => {
          if (isMounted) {
            setCurrentExpertTurn({
              expertId: data.expertId,
              expertName: data.expertName,
              turnNumber: data.turnNumber,
              injectedMemoryIds: data.injectedMemoryIds ?? [],
            });
          }
        });
```

- [ ] **Step 2: Add memory tracking state to useWebSocket**

Add a new state to track memory counts per expert across turns:

```typescript
  const [expertMemoryCounts, setExpertMemoryCounts] = useState<Map<string, number>>(new Map());
```

Update the `expert-turn-start` handler to also accumulate counts:

```typescript
        newSocket.on("expert-turn-start", (data: { expertId: string; expertName: string; turnNumber: number; injectedMemoryIds?: string[] }) => {
          if (isMounted) {
            const ids = data.injectedMemoryIds ?? [];
            setCurrentExpertTurn({
              expertId: data.expertId,
              expertName: data.expertName,
              turnNumber: data.turnNumber,
              injectedMemoryIds: ids,
            });
            if (ids.length > 0) {
              setExpertMemoryCounts((prev) => {
                const next = new Map(prev);
                next.set(data.expertId, ids.length);
                return next;
              });
            }
          }
        });
```

Add `expertMemoryCounts` to the return object of the hook:

```typescript
  return {
    socket,
    isConnected,
    error,
    messages,
    consensusReached,
    isDiscussionActive,
    currentExpertTurn,
    expertMemoryCounts,
    startDiscussion,
    sendIntervention,
    pauseDiscussion,
    stopDiscussion,
    disconnect,
  };
```

Update the `UseWebSocketReturn` interface to include `expertMemoryCounts`:

```typescript
  expertMemoryCounts: Map<string, number>;
```

- [ ] **Step 3: Display memory badge on SessionDetailPage**

In `frontend/src/pages/SessionDetailPage.tsx`, destructure `expertMemoryCounts` from the hook:

```typescript
  const {
    isConnected,
    error: wsError,
    messages: wsMessages,
    consensusReached,
    isDiscussionActive,
    currentExpertTurn,
    expertMemoryCounts,
    startDiscussion,
    sendIntervention,
    pauseDiscussion,
    stopDiscussion,
    disconnect,
  } = useWebSocket(id || "");
```

Update the Participating Experts card (around line 227-243) to show memory badges:

```tsx
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participating Experts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.experts.map((expert) => {
                const memCount = expertMemoryCounts.get(expert.id);
                return (
                  <div key={expert.id} className="pb-3 border-b last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{expert.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {expert.specialty}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {memCount != null && memCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {memCount} {memCount === 1 ? "memory" : "memories"}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {expert.driverType}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
```

- [ ] **Step 4: Verify the frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/use-websocket.ts frontend/src/pages/SessionDetailPage.tsx
git commit -m "[memory] add memory injection indicator to session detail page"
```

---

## Task 15: End-to-End Verification

**Files:** None new — this is a verification task.

- [ ] **Step 1: Run all backend tests**

```bash
npx jest --no-cache
```

Expected: All tests pass (keywords, relevance, memory service, memory controller tests).

- [ ] **Step 2: Run the backend build**

```bash
npx nest build
```

Expected: Clean build with no errors.

- [ ] **Step 3: Run the frontend type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Run the database migration (if not already applied)**

```bash
npx prisma migrate status
```

Expected: All migrations applied.

- [ ] **Step 5: Manual smoke test checklist**

Start the backend (`npm run start:dev`) and frontend (`cd frontend && npm run dev`) and verify:

1. Create a new expert — memory settings should appear in the form with defaults (enabled, 50 max entries, 5 per turn).
2. Edit an existing expert — memory settings should reflect the saved values.
3. Click the Memory (brain) button on an expert row — memory dialog opens, shows "No memories yet."
4. Add a user note via the "Add Note" button — it appears in the memory list.
5. Edit the note — changes persist.
6. Delete the note — it disappears.
7. Start a session with 2+ experts — after session completes, expert memories should be generated.
8. Check the memory tab after a session — SESSION_SUMMARY and KEY_INSIGHT entries should appear.
9. Start another session on a related topic — memory injection indicator badges should appear on the session detail page.

- [ ] **Step 6: Final commit with any fixes**

If any issues were found during smoke testing, fix and commit:

```bash
git add -A
git commit -m "[memory] fix issues found during end-to-end verification"
```

- [ ] **Step 7: Push branch and create PR**

```bash
git push -u origin agent/plan-writer/6f821f88
```

---

## Summary of Changes by Layer

| Layer | Files Changed | What Changed |
|-------|--------------|-------------|
| Database | `prisma/schema.prisma`, migration | ExpertMemory table, MemoryType enum, Expert memory config fields |
| Backend Utils | `src/memory/utils/keywords.ts`, `relevance.ts` | Keyword extraction, relevance scoring |
| Backend Service | `src/memory/memory.service.ts` | CRUD, memory generation, memory injection |
| Backend Controller | `src/memory/memory.controller.ts` | REST API under `/experts/:id/memories` |
| Backend DTOs | `src/memory/dto/` | Create, Update, Response DTOs |
| Backend Module | `src/memory/memory.module.ts` | NestJS module wiring |
| Council Integration | `src/council/council.service.ts` | Memory injection in buildExpertContext, generation after concludeSession |
| Events | `src/council/events/discussion.events.ts` | injectedMemoryIds in ExpertTurnStartEvent |
| Gateway | `src/council/gateways/discussion.gateway.ts` | Forward injectedMemoryIds to frontend |
| Expert DTOs | `src/expert/dto/` | memoryEnabled, memoryMaxEntries, memoryMaxInject |
| Frontend Types | `frontend/src/types/` | Memory types, updated Expert types |
| Frontend API | `frontend/src/lib/api/memories.ts` | Memory CRUD client |
| Frontend Components | `frontend/src/components/experts/` | MemoryTab, MemoryCard, AddNoteDialog, ClearMemoryDialog |
| Frontend Pages | `ExpertsPage.tsx`, `SessionDetailPage.tsx` | Memory dialog, injection indicator badges |
| Frontend Hook | `use-websocket.ts` | Track expertMemoryCounts |
