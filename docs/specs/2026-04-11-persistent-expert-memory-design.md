# Persistent Expert Memory Across Sessions

**Issue:** ADM-17 — [P5] Add persistent expert memory across sessions
**Date:** 2026-04-11
**Status:** Design

## Goal

Allow AIcouncil experts to remember past discussions and reference them, enabling multi-session workflows where experts build on prior knowledge.

## Current State

- Experts are AI personas with name, specialty, systemPrompt, driverType, and LLM config.
- Sessions are round-robin discussions among 2-10 experts on a problem statement.
- Context per turn: expert's systemPrompt + problem statement + last 10 messages.
- **No cross-session memory exists.** Each session starts with a blank slate.
- The context assembly point is `buildExpertContext()` in `council.service.ts`.

## Architecture Decision

**Chosen approach: Summary-based memory with relevance scoring.**

Alternatives considered:

| Approach | Complexity | Infra Change | Semantic Search | Chosen? |
|----------|-----------|--------------|-----------------|---------|
| Summary-based (LLM summarization at session end) | Low | None | No (keyword overlap) | Yes |
| Vector-embedded (pgvector + embedding model) | High | pgvector extension | Yes | No (v2 upgrade path) |
| Sliding window with compressed history | Medium | None | No | No (latency on every turn) |

**Rationale:** Summary-based memory fits the existing PostgreSQL stack with no new infrastructure. Summarization happens once per expert per session (at session end), avoiding per-turn latency. Keyword-based relevance scoring is sufficient for v1; pgvector is the natural upgrade path if semantic search proves necessary.

## Data Model

### New: ExpertMemory table

```prisma
model ExpertMemory {
  id          String     @id @default(cuid())
  expertId    String
  sessionId   String?
  type        MemoryType
  content     String     @db.Text
  relevance   Float      @default(1.0)
  metadata    Json?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  expert  Expert   @relation(fields: [expertId], references: [id], onDelete: Cascade)
  session Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  @@index([expertId])
  @@index([expertId, relevance])
  @@index([sessionId])
}

enum MemoryType {
  SESSION_SUMMARY
  KEY_INSIGHT
  USER_NOTE
}
```

### Modified: Expert model

Add fields:

```prisma
memoryEnabled    Boolean  @default(true)
memoryMaxEntries Int      @default(50)
memoryMaxInject  Int      @default(5)
memories         ExpertMemory[]
```

### Modified: Session model

Add relation:

```prisma
memories ExpertMemory[]
```

### Field semantics

- `type`: Distinguishes auto-generated summaries, extracted insights, and user-curated notes.
- `relevance`: Float 0.0-1.0. Starts at 1.0, decays over time. Used for injection priority.
- `metadata`: JSON object storing extracted keywords/topics for relevance matching. Shape: `{ topics: string[], sessionTitle?: string }`.
- `sessionId`: Nullable. USER_NOTE memories may not be tied to a session.
- Cascade delete on expert ensures cleanup. SetNull on session preserves memories if a session is deleted.

## Memory Generation

### Trigger

After `concludeSession()` in `council.service.ts` completes successfully, for each expert in the session where `expert.memoryEnabled === true`.

### Process

New method: `MemoryService.generateSessionMemory(expertId: string, sessionId: string)`

1. Fetch all messages from the session for this expert via `MessageService`.
2. Call the expert's own LLM (using their configured driver + model) with the summarization prompt.
3. Parse the structured response.
4. Create database entries:
   - One `SESSION_SUMMARY` entry with the full summary text.
   - 0-5 `KEY_INSIGHT` entries, one per major insight, with topic keywords in `metadata`.
5. If `memoryMaxEntries` is exceeded, delete oldest low-relevance entries.

### Summarization Prompt

```
You are summarizing your participation in a group discussion.

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
```

### Cost Control

- Uses the expert's own configured LLM. No additional API key or model required.
- One LLM call per expert per session (at session end, not per turn).
- Runs asynchronously after session completion — does not block the session end response.

## Memory Injection

### Location

`buildExpertContext()` in `council.service.ts`. Injected into the system message between the expert's `systemPrompt` and the `Problem Statement:` block.

### Selection Algorithm

New method: `MemoryService.getRelevantMemories(expertId: string, problemStatement: string, maxInject: number)`

1. Fetch all memories for the expert where `relevance > 0.1`.
2. Score each memory:
   ```
   score = relevance * recencyBoost * topicOverlap
   ```
   - `recencyBoost`: `Math.max(0.3, 1.0 - (weeksSinceCreation * 0.1))`
   - `topicOverlap`: Jaccard similarity between `metadata.topics` and keywords extracted from `problemStatement` (tokenize, lowercase, remove stopwords). Minimum floor of 0.2 so memories with no topic overlap still have a chance if highly relevant/recent.
3. Sort by score descending, take top N (where N = `expert.memoryMaxInject`, default 5).
4. Token budget check: estimate tokens (content.length / 4), cap total at 3000 tokens. If exceeded, reduce to top 3.

### Injection Format

```
Relevant Memory from Past Sessions:
---
[Session: "{sessionTitle}" - {timeAgo}]
{summaryContent}

[Key Insight - {timeAgo}]
{insightContent}

[Note]
{userNoteContent}
---
Reference these memories naturally when relevant. Prioritize the current problem statement.
```

### When Memory is Disabled

If `expert.memoryEnabled === false`, skip both memory generation (at session end) and memory injection (at turn start). Existing memories are preserved in the database but not used.

## Memory Decay

### Passive Decay

Relevance is recalculated on access (when memories are fetched for injection), not via a scheduled job. This avoids the need for a cron/scheduler.

Formula:
```
effectiveRelevance = baseRelevance * Math.pow(0.95, weeksSinceCreation)
```

- Floor: 0.1 (memories never reach zero relevance).
- `USER_NOTE` memories are exempt from decay — their relevance stays at the user-set value.
- `baseRelevance` is the stored `relevance` field (1.0 for auto-generated, user-adjustable).

### No Auto-Deletion

Memories persist until explicitly deleted by the user or pruned by `memoryMaxEntries`. Decay only affects injection priority — low-relevance memories still appear in the UI.

### Pruning

When a new memory is generated and the expert's total memory count exceeds `memoryMaxEntries`:
1. Sort by `effectiveRelevance` ascending.
2. Delete the lowest-scored entries until count <= `memoryMaxEntries`.
3. Never prune `USER_NOTE` entries automatically.

## API

### New Endpoints

All on `ExpertController` (or a new `MemoryController` nested under experts):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/experts/:id/memories` | List memories. Query params: `type`, `page`, `limit`, `sort`. |
| `GET` | `/experts/:id/memories/:memoryId` | Get a single memory. |
| `POST` | `/experts/:id/memories` | Create a USER_NOTE memory. Body: `{ content, relevance?, metadata? }`. |
| `PATCH` | `/experts/:id/memories/:memoryId` | Update content or relevance. |
| `DELETE` | `/experts/:id/memories/:memoryId` | Delete a single memory. |
| `DELETE` | `/experts/:id/memories` | Clear all memories for the expert. Requires confirmation param: `?confirm=true`. |

### DTOs

```typescript
// CreateMemoryDto
{
  content: string;       // min 1, max 5000
  relevance?: number;    // 0.0-1.0, default 1.0
  metadata?: {
    topics?: string[];
  };
}

// UpdateMemoryDto
{
  content?: string;
  relevance?: number;
}

// MemoryResponseDto
{
  id: string;
  expertId: string;
  sessionId: string | null;
  type: MemoryType;
  content: string;
  relevance: number;
  effectiveRelevance: number;  // computed with decay
  metadata: object | null;
  createdAt: string;
  updatedAt: string;
}
```

## Frontend UI

### Expert Page — Memory Tab

Add a tabbed interface to the expert detail/edit page. New "Memory" tab contains:

- **Memory list** grouped by type (Session Summaries, Key Insights, User Notes).
- Each entry shows: content (truncated to 200 chars, expandable), source session link, relevance badge (color-coded: green > 0.7, yellow > 0.3, red <= 0.3), age.
- **Actions per entry:** Edit (inline), Delete (with confirmation), Adjust relevance (slider).
- **"Add Note" button** opens a dialog to create a USER_NOTE.
- **"Clear All" button** with confirmation dialog.
- **Search input** filters memories by keyword.

### Expert Form — Memory Settings

Add to the expert create/edit form:

- Checkbox: "Enable persistent memory" (maps to `memoryEnabled`).
- Number input: "Max stored memories" (maps to `memoryMaxEntries`, default 50).
- Number input: "Max memories per turn" (maps to `memoryMaxInject`, default 5).

### Session Detail Page — Memory Indicator

- In the "Participating Experts" card, show a small badge per expert: "{N} memories active".
- Clicking the badge opens an expandable panel showing the actual memory text that was injected for that expert during this session.

To track which memories were injected, include the memory IDs in the `EXPERT_TURN_START` WebSocket event payload (new field: `injectedMemoryIds: string[]`). The frontend stores these per-expert for display. No additional database table needed — this is ephemeral display data.

## New Backend Module

Create a `MemoryModule` (`src/memory/`) with:

- `memory.module.ts` — NestJS module, imports PrismaModule.
- `memory.service.ts` — Core logic: generateSessionMemory, getRelevantMemories, CRUD operations.
- `memory.controller.ts` — REST endpoints (nested under /experts/:id/memories).
- `dto/create-memory.dto.ts` — Validation for user-created memories.
- `dto/update-memory.dto.ts` — Validation for updates.
- `dto/memory-response.dto.ts` — Response shape.
- `utils/relevance.ts` — Scoring functions (recencyBoost, topicOverlap, effectiveRelevance).
- `utils/keywords.ts` — Simple keyword extraction (tokenize, lowercase, stopword removal).

## Acceptance Criteria Mapping

| Criterion | How It's Met |
|-----------|-------------|
| Expert can reference insights from previous sessions | Memory injection in buildExpertContext() provides past summaries and insights in the system message. The LLM naturally references them. |
| Memory is scoped per expert (not shared unless configured) | ExpertMemory is linked to a single Expert via expertId. No cross-expert sharing in v1. |
| Users can view and clear expert memory | Frontend Memory tab with list view, edit, delete, and "Clear All". API endpoints for programmatic access. |
| Memory doesn't exceed context window limits | 3000-token cap on injected memories. memoryMaxInject limits entry count. Relevance scoring prioritizes the most useful memories. |

## Out of Scope (v1)

- Vector embeddings / pgvector (upgrade path for v2 if keyword matching proves insufficient).
- Cross-expert shared memory pools.
- Memory export/import.
- Within-session context window expansion (hardcoded 10-message limit is a separate concern).
- Memory-based expert recommendations ("this expert has relevant experience").
- Real-time memory updates during a session (memory is only generated at session end).
