# Frontend UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the AI Council frontend to handle real-world usage — rich empty states, virtual scrolling for large message lists, search/filter/sort for experts and sessions, and Markdown export for discussion transcripts.

**Architecture:** Six independent features layered onto the existing React 18 + Vite + TailwindCSS + Radix UI frontend. Each feature is self-contained: empty states enhance existing pages, virtual scrolling replaces the current `MessageList` `.map()` rendering, search/filter adds controls to existing list pages, and export adds a utility function + button to `SessionDetailPage`. No backend changes required — all features are frontend-only using existing API data.

**Tech Stack:** React 18, TypeScript, Vite, TailwindCSS, Radix UI (shadcn pattern), `@tanstack/react-virtual` (virtual scrolling), `lucide-react` (icons), `date-fns` (dates), existing `@tanstack/react-table` (expert filtering)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/components/common/EmptyState.tsx` | Reusable empty state component with icon, title, description, CTA button |
| `frontend/src/components/sessions/VirtualMessageList.tsx` | Virtualized message list using `@tanstack/react-virtual` |
| `frontend/src/components/sessions/SessionFilters.tsx` | Status filter tabs + search input for sessions page |
| `frontend/src/components/sessions/ExportButton.tsx` | Export discussion to Markdown button + logic |
| `frontend/src/lib/utils/export.ts` | Pure function: `messagesToMarkdown(session, messages)` |
| `frontend/src/components/experts/ExpertFilters.tsx` | Search input + driver type filter for experts page |

### Modified Files
| File | Changes |
|------|---------|
| `frontend/src/pages/ExpertsPage.tsx` | Replace plain empty state with `EmptyState` component; add `ExpertFilters`; pass filtered data to table |
| `frontend/src/pages/SessionsPage.tsx` | Replace plain empty state with `EmptyState` component; add `SessionFilters`; filter/sort sessions |
| `frontend/src/pages/SessionDetailPage.tsx` | Replace `MessageList` with `VirtualMessageList`; add `ExportButton` |
| `frontend/src/components/experts/ExpertTable.tsx` | Add `getFilteredRowModel()` for TanStack global filter support |
| `frontend/src/components/sessions/MessageList.tsx` | No changes — kept as fallback; `VirtualMessageList` is the new primary |
| `frontend/package.json` | Add `@tanstack/react-virtual` dependency |

---

## Task 1: Install `@tanstack/react-virtual` dependency

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install the package**

```bash
cd frontend && npm install @tanstack/react-virtual@^3.13.0
```

- [ ] **Step 2: Verify installation**

```bash
cd frontend && node -e "require('@tanstack/react-virtual')" && echo "OK"
```

Expected: `OK` (no errors)

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "[frontend] add @tanstack/react-virtual for virtual scrolling"
```

---

## Task 2: Create reusable `EmptyState` component

**Files:**
- Create: `frontend/src/components/common/EmptyState.tsx`

- [ ] **Step 1: Create the EmptyState component**

```tsx
// frontend/src/components/common/EmptyState.tsx
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-6">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/common/EmptyState.tsx
git commit -m "[frontend] add reusable EmptyState component"
```

---

## Task 3: Add rich empty state to ExpertsPage

**Files:**
- Modify: `frontend/src/pages/ExpertsPage.tsx`
- Modify: `frontend/src/components/experts/ExpertTable.tsx`

- [ ] **Step 1: Update ExpertsPage to use EmptyState component**

In `frontend/src/pages/ExpertsPage.tsx`, add the import at the top:

```tsx
import { EmptyState } from "@/components/common/EmptyState";
import { Plus, RefreshCw, BrainCircuit } from "lucide-react";
```

(Replace the existing `import { Plus, RefreshCw } from "lucide-react";` line.)

Then replace the content rendering section (lines 74-84):

```tsx
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading experts...</p>
        </div>
      ) : experts.length === 0 ? (
        <EmptyState
          icon={BrainCircuit}
          title="No experts yet"
          description="Experts are AI personas with specific specialties that participate in council discussions. Create your first expert to get started."
          actionLabel="Create First Expert"
          onAction={() => setCreateDialogOpen(true)}
        />
      ) : (
        <ExpertTable
          data={experts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
```

- [ ] **Step 2: Remove the inline empty state from ExpertTable**

In `frontend/src/components/experts/ExpertTable.tsx`, remove the early-return empty check (lines 42-48):

Delete this block:
```tsx
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border rounded-lg">
        <p className="text-muted-foreground">No experts found. Create one to get started.</p>
      </div>
    );
  }
```

The empty state is now handled by the parent `ExpertsPage`.

- [ ] **Step 3: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ExpertsPage.tsx frontend/src/components/experts/ExpertTable.tsx
git commit -m "[frontend] add rich empty state to ExpertsPage"
```

---

## Task 4: Add rich empty state to SessionsPage

**Files:**
- Modify: `frontend/src/pages/SessionsPage.tsx`

- [ ] **Step 1: Update SessionsPage to use EmptyState component**

In `frontend/src/pages/SessionsPage.tsx`, add the import:

```tsx
import { EmptyState } from "@/components/common/EmptyState";
import { RefreshCw, Plus, MessageSquare } from "lucide-react";
```

(Replace the existing `import { RefreshCw, Plus } from "lucide-react";` line.)

Then replace the empty state block (lines 92-108) with:

```tsx
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No sessions yet"
          description="Discussion sessions bring your experts together to debate a problem and reach consensus. Create your first session to see them in action."
          actionLabel="Create First Session"
          onAction={() => setCreateDialogOpen(true)}
        />
      ) : (
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/SessionsPage.tsx
git commit -m "[frontend] add rich empty state to SessionsPage"
```

---

## Task 5: Create `VirtualMessageList` with `@tanstack/react-virtual`

**Files:**
- Create: `frontend/src/components/sessions/VirtualMessageList.tsx`

This replaces the existing `MessageList` for the session detail page. The key change: instead of rendering all messages in a flat `.map()`, we use `useVirtualizer` to only render visible messages. Each message gets a dynamic height measurement via `measureElement`.

- [ ] **Step 1: Create the VirtualMessageList component**

```tsx
// frontend/src/components/sessions/VirtualMessageList.tsx
import { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageResponse } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MessageItem } from "./MessageItem";
import { CheckCircle2 } from "lucide-react";

interface VirtualMessageListProps {
  messages: MessageResponse[];
  consensusReached: boolean;
  loading: boolean;
}

export function VirtualMessageList({
  messages,
  consensusReached,
  loading,
}: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150,
    overscan: 5,
  });

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length, virtualizer]);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (loading) {
    return (
      <div className="h-[600px] rounded-md border p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="h-[600px] rounded-md border flex items-center justify-center text-center">
        <div>
          <p className="text-muted-foreground">No messages yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start the discussion to see expert messages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const message = messages[virtualItem.index];
            const isConsensusMessage = message.id.startsWith("consensus-");

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="p-2">
                  <MessageItem
                    message={message}
                    isConsensusMessage={isConsensusMessage}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Consensus Alert — outside the virtual list */}
      {consensusReached && (
        <div className="p-4 border-t">
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">Consensus Reached</AlertTitle>
            <AlertDescription className="text-green-800">
              The experts have reached a consensus on this topic.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/sessions/VirtualMessageList.tsx
git commit -m "[frontend] add VirtualMessageList with @tanstack/react-virtual"
```

---

## Task 6: Wire `VirtualMessageList` into `SessionDetailPage`

**Files:**
- Modify: `frontend/src/pages/SessionDetailPage.tsx`

- [ ] **Step 1: Replace MessageList import with VirtualMessageList**

In `frontend/src/pages/SessionDetailPage.tsx`, change the import (line 11):

From:
```tsx
import { MessageList } from "@/components/sessions/MessageList";
```

To:
```tsx
import { VirtualMessageList } from "@/components/sessions/VirtualMessageList";
```

- [ ] **Step 2: Replace the MessageList usage**

In the JSX (around line 194), replace:

```tsx
            <MessageList
              messages={allMessages}
              consensusReached={consensusReached || session.consensusReached}
              loading={loading}
            />
```

With:

```tsx
            <VirtualMessageList
              messages={allMessages}
              consensusReached={consensusReached || session.consensusReached}
              loading={loading}
            />
```

- [ ] **Step 3: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/SessionDetailPage.tsx
git commit -m "[frontend] wire VirtualMessageList into SessionDetailPage"
```

---

## Task 7: Add search and driver-type filter to ExpertsPage

**Files:**
- Create: `frontend/src/components/experts/ExpertFilters.tsx`
- Modify: `frontend/src/pages/ExpertsPage.tsx`
- Modify: `frontend/src/components/experts/ExpertTable.tsx`

- [ ] **Step 1: Create ExpertFilters component**

```tsx
// frontend/src/components/experts/ExpertFilters.tsx
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { DriverType } from "@/types";

interface ExpertFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  driverFilter: string;
  onDriverFilterChange: (value: string) => void;
}

export function ExpertFilters({
  searchQuery,
  onSearchChange,
  driverFilter,
  onDriverFilterChange,
}: ExpertFiltersProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search experts by name or specialty..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={driverFilter} onValueChange={onDriverFilterChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Drivers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Drivers</SelectItem>
          <SelectItem value={DriverType.OPENAI}>OpenAI</SelectItem>
          <SelectItem value={DriverType.ANTHROPIC}>Anthropic</SelectItem>
          <SelectItem value={DriverType.GROK}>Grok</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: Add filter state and logic to ExpertsPage**

In `frontend/src/pages/ExpertsPage.tsx`, add the imports:

```tsx
import { useState, useEffect, useMemo } from "react";
import { ExpertFilters } from "@/components/experts/ExpertFilters";
```

(Update the existing `import { useState, useEffect } from "react";` line to include `useMemo`.)

Add state variables after the existing `useState` declarations (after line 18):

```tsx
  const [searchQuery, setSearchQuery] = useState("");
  const [driverFilter, setDriverFilter] = useState("all");
```

Add the filtering logic before the `return` statement:

```tsx
  const filteredExperts = useMemo(() => {
    return experts.filter((expert) => {
      const matchesSearch =
        searchQuery === "" ||
        expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expert.specialty.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDriver =
        driverFilter === "all" || expert.driverType === driverFilter;
      return matchesSearch && matchesDriver;
    });
  }, [experts, searchQuery, driverFilter]);
```

- [ ] **Step 3: Add ExpertFilters to the JSX and use filteredExperts**

In the JSX, add `<ExpertFilters>` right before the loading/content conditional, and change `experts` to `filteredExperts` in the empty check and table data:

```tsx
      <ExpertFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        driverFilter={driverFilter}
        onDriverFilterChange={setDriverFilter}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading experts...</p>
        </div>
      ) : filteredExperts.length === 0 && experts.length > 0 ? (
        <div className="flex items-center justify-center h-64 border rounded-lg">
          <p className="text-muted-foreground">No experts match your filters.</p>
        </div>
      ) : filteredExperts.length === 0 ? (
        <EmptyState
          icon={BrainCircuit}
          title="No experts yet"
          description="Experts are AI personas with specific specialties that participate in council discussions. Create your first expert to get started."
          actionLabel="Create First Expert"
          onAction={() => setCreateDialogOpen(true)}
        />
      ) : (
        <ExpertTable
          data={filteredExperts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/experts/ExpertFilters.tsx frontend/src/pages/ExpertsPage.tsx
git commit -m "[frontend] add search and driver-type filter to ExpertsPage"
```

---

## Task 8: Add search, status filter, and sort to SessionsPage

**Files:**
- Create: `frontend/src/components/sessions/SessionFilters.tsx`
- Modify: `frontend/src/pages/SessionsPage.tsx`

- [ ] **Step 1: Create SessionFilters component**

```tsx
// frontend/src/components/sessions/SessionFilters.tsx
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { SessionStatus } from "@/types";

interface SessionFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

export function SessionFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
}: SessionFiltersProps) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by problem statement..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value={SessionStatus.PENDING}>Pending</SelectItem>
          <SelectItem value={SessionStatus.ACTIVE}>Active</SelectItem>
          <SelectItem value={SessionStatus.COMPLETED}>Completed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="status">By Status</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: Add filter/sort state and logic to SessionsPage**

In `frontend/src/pages/SessionsPage.tsx`, update imports:

```tsx
import { useEffect, useState, useMemo } from "react";
import { SessionFilters } from "@/components/sessions/SessionFilters";
import { EmptyState } from "@/components/common/EmptyState";
```

Add state variables after the existing `useState` declarations:

```tsx
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
```

Add the filtering and sorting logic before the `return` statement:

```tsx
  const filteredSessions = useMemo(() => {
    const statusOrder: Record<string, number> = {
      ACTIVE: 0,
      PENDING: 1,
      COMPLETED: 2,
    };

    return sessions
      .filter((session) => {
        const matchesSearch =
          searchQuery === "" ||
          session.problemStatement
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        const sessionStatus = session.status || "PENDING";
        const matchesStatus =
          statusFilter === "all" || sessionStatus === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "oldest":
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          case "status":
            return (
              (statusOrder[a.status || "PENDING"] ?? 3) -
              (statusOrder[b.status || "PENDING"] ?? 3)
            );
          case "newest":
          default:
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        }
      });
  }, [sessions, searchQuery, statusFilter, sortBy]);
```

- [ ] **Step 3: Update the JSX to use filters and filteredSessions**

Remove the existing sort in `fetchSessions` (lines 29-31) — sorting is now handled by `useMemo`. Change:

```tsx
      setSessions(data.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
```

To:

```tsx
      setSessions(data);
```

Update the content section to include `SessionFilters` and use `filteredSessions`:

```tsx
      {/* Filters — only show when there are sessions */}
      {!loading && sessions.length > 0 && (
        <SessionFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No sessions yet"
          description="Discussion sessions bring your experts together to debate a problem and reach consensus. Create your first session to see them in action."
          actionLabel="Create First Session"
          onAction={() => setCreateDialogOpen(true)}
        />
      ) : filteredSessions.length === 0 ? (
        <div className="flex items-center justify-center h-64 border rounded-lg">
          <p className="text-muted-foreground">No sessions match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onViewSession={handleViewSession}
            />
          ))}
        </div>
      )}
```

Also add the `MessageSquare` icon import (update the existing lucide import):

```tsx
import { RefreshCw, Plus, MessageSquare } from "lucide-react";
```

- [ ] **Step 4: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/sessions/SessionFilters.tsx frontend/src/pages/SessionsPage.tsx
git commit -m "[frontend] add search, status filter, and sort to SessionsPage"
```

---

## Task 9: Create Markdown export utility

**Files:**
- Create: `frontend/src/lib/utils/export.ts`

- [ ] **Step 1: Create the export utility**

```tsx
// frontend/src/lib/utils/export.ts
import { MessageResponse, SessionResponse, MessageRole } from "@/types";
import { format } from "date-fns";

export function messagesToMarkdown(
  session: SessionResponse,
  messages: MessageResponse[]
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Discussion Transcript`);
  lines.push("");
  lines.push(`**Problem Statement:** ${session.problemStatement}`);
  lines.push(`**Status:** ${session.status || "PENDING"}`);
  lines.push(`**Created:** ${format(new Date(session.createdAt), "PPpp")}`);
  lines.push(
    `**Experts:** ${session.experts.map((e) => `${e.name} (${e.specialty})`).join(", ")}`
  );
  lines.push(
    `**Consensus:** ${session.consensusReached ? "Reached" : "Not reached"}`
  );
  lines.push(`**Messages:** ${messages.length} / ${session.maxMessages}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Messages
  for (const msg of messages) {
    const timestamp = format(new Date(msg.timestamp), "PPpp");
    const sender = msg.isIntervention
      ? "User (Intervention)"
      : msg.role === MessageRole.SYSTEM
        ? "System"
        : `${msg.expertName || "Unknown"} [${msg.expertSpecialty || ""}]`;

    lines.push(`### ${sender}`);
    lines.push(`*${timestamp}*`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Footer
  lines.push(
    `*Exported from AI Council on ${format(new Date(), "PPpp")}*`
  );

  return lines.join("\n");
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/utils/export.ts
git commit -m "[frontend] add Markdown export utility for discussion transcripts"
```

---

## Task 10: Create `ExportButton` component and wire into `SessionDetailPage`

**Files:**
- Create: `frontend/src/components/sessions/ExportButton.tsx`
- Modify: `frontend/src/pages/SessionDetailPage.tsx`

- [ ] **Step 1: Create ExportButton component**

```tsx
// frontend/src/components/sessions/ExportButton.tsx
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { SessionResponse, MessageResponse } from "@/types";
import { messagesToMarkdown, downloadMarkdown } from "@/lib/utils/export";
import { format } from "date-fns";

interface ExportButtonProps {
  session: SessionResponse;
  messages: MessageResponse[];
}

export function ExportButton({ session, messages }: ExportButtonProps) {
  const handleExport = () => {
    const markdown = messagesToMarkdown(session, messages);
    const dateStr = format(new Date(session.createdAt), "yyyy-MM-dd");
    const slug = session.problemStatement
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/-+$/, "")
      .toLowerCase();
    const filename = `discussion-${dateStr}-${slug}.md`;
    downloadMarkdown(filename, markdown);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={messages.length === 0}
    >
      <Download className="h-4 w-4 mr-2" />
      Export Markdown
    </Button>
  );
}
```

- [ ] **Step 2: Add ExportButton to SessionDetailPage header**

In `frontend/src/pages/SessionDetailPage.tsx`, add the import:

```tsx
import { ExportButton } from "@/components/sessions/ExportButton";
```

In the header area, replace the Refresh button block (lines 169-176):

```tsx
        <div className="flex gap-2">
          <ExportButton session={session} messages={allMessages} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
```

- [ ] **Step 3: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/sessions/ExportButton.tsx frontend/src/pages/SessionDetailPage.tsx
git commit -m "[frontend] add Markdown export button to SessionDetailPage"
```

---

## Task 11: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2: Run the dev server and verify manually**

```bash
cd frontend && npm run dev
```

Then verify in the browser:

1. **Empty states:** Navigate to `/experts` with no experts — should show icon, description, CTA. Same for `/sessions`.
2. **Expert filters:** Create 2+ experts, verify search by name and filter by driver type work.
3. **Session filters:** Create 2+ sessions with different statuses, verify search, status filter, and sort controls.
4. **Virtual scrolling:** Open a session with messages — the message list should render inside a virtualized container. If you have a completed session with many messages, scroll should be smooth.
5. **Export:** On any session detail page with messages, click "Export Markdown" — a `.md` file should download with the full transcript.

- [ ] **Step 3: Build production bundle to check for issues**

```bash
cd frontend && npm run build
```

Expected: successful build with no errors

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "[frontend] final integration verification — all UX polish features complete"
```

---

## Summary of Changes

| Feature | Component(s) | Status |
|---------|-------------|--------|
| Reusable empty state | `EmptyState.tsx` | New |
| Rich empty state — Experts | `ExpertsPage.tsx`, `ExpertTable.tsx` | Modified |
| Rich empty state — Sessions | `SessionsPage.tsx` | Modified |
| Virtual scrolling for messages | `VirtualMessageList.tsx` | New |
| Virtual list wired in | `SessionDetailPage.tsx` | Modified |
| Expert search + driver filter | `ExpertFilters.tsx`, `ExpertsPage.tsx` | New + Modified |
| Session search + status filter + sort | `SessionFilters.tsx`, `SessionsPage.tsx` | New + Modified |
| Markdown export utility | `export.ts` | New |
| Export button | `ExportButton.tsx`, `SessionDetailPage.tsx` | New + Modified |
