# AI Council - Frontend

## Overview

React single-page application (SPA) built with Vite, TypeScript, and Shadcn UI. Provides the user interface for managing AI experts, creating discussion sessions, and monitoring real-time collaborative problem-solving.

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Shadcn UI** - Component library built on Radix UI primitives
- **React Router** - Client-side routing
- **Axios** - REST API client
- **Socket.IO Client** - WebSocket connections for real-time updates
- **Zustand** - State management
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Type safety
- **LLM Providers** - OpenAI, Anthropic, and xAI (Grok) support

## Prerequisites

- Node.js >= 18
- Backend server running on `http://localhost:3000`

## Installation

```bash
cd frontend
npm install
cp .env.example .env
```

## Development

```bash
# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/          # Shadcn UI components
│   │   └── layout/      # Layout components (Navigation, Layout)
│   ├── pages/           # Route pages
│   ├── lib/             # Utilities and API clients
│   │   ├── api/         # API endpoint functions
│   │   ├── api.ts       # Axios client configuration
│   │   ├── socket.ts    # Socket.IO client
│   │   └── utils.ts     # Utility functions
│   ├── stores/          # Zustand stores
│   ├── types/           # TypeScript type definitions
│   ├── App.tsx          # Root component with routing
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles and Tailwind directives
├── public/              # Static assets
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
└── components.json      # Shadcn UI configuration
```

## Adding Shadcn Components

To add new Shadcn UI components:

```bash
npx shadcn-ui@latest add <component-name>
```

Example:
```bash
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add select
```

## API Integration

### REST API

The application uses Axios for REST API calls. The client is configured in `src/lib/api.ts` with:

- Base URL from environment variable or `/api` proxy
- Automatic JWT token injection from localStorage
- 401 error handling (clears token and redirects)

API functions are organized in `src/lib/api/`:
- `experts.ts` - Expert CRUD operations
- `sessions.ts` - Session management and messaging

### Development Proxy

In development, Vite proxies `/api/*` requests to `http://localhost:3000` (configured in `vite.config.ts`). This avoids CORS issues during development.

## WebSocket Integration

Socket.IO client is configured in `src/lib/socket.ts` for real-time communication:

1. Get session token from `/sessions/:id/token` endpoint
2. Create socket connection with `createSocketConnection(token)`
3. Connect to `/discussion` namespace
4. Listen for events: `message`, `consensus`, `session_complete`
5. Emit events: `intervention`

### JWT Authentication Flow

```typescript
// 1. Get token for session
const { token } = await getSessionToken(sessionId);

// 2. Create socket with token
const socket = createSocketConnection(token);

// 3. Connect
socket.connect();

// 4. Listen for events
socket.on('message', (data) => { /* handle message */ });
```

## Theming

The application supports light/dark mode with system preference detection:

- Theme state managed by Zustand store (`src/stores/theme.ts`)
- Persisted to localStorage
- CSS variables defined in `src/index.css`
- Toggle button in navigation

### Theme Variables

Customize colors by editing CSS variables in `src/index.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

## Environment Variables

All environment variables must be prefixed with `VITE_` to be exposed to the client.

```env
# Base URL for REST API calls
VITE_API_BASE_URL=http://localhost:3000

# WebSocket server URL
VITE_WS_URL=http://localhost:3000

# WebSocket namespace for discussion sessions
VITE_WS_NAMESPACE=/discussion
```

**Backend API Key Requirements:**

The backend requires appropriate API keys to be configured for the driver types used by experts:
- `OPENAI_API_KEY` - Required if using OpenAI models
- `ANTHROPIC_API_KEY` - Required if using Anthropic Claude models
- `XAI_API_KEY` - Required if using xAI Grok models

At least one API key must be configured for the system to function. Configure keys for the driver types you plan to use.

## Session Management & Real-Time Discussions

### Overview

The session management system enables users to create discussion sessions with selected experts and monitor real-time conversations. The system uses WebSocket connections for live updates and supports user interventions during discussions.

**Workflow:**
1. User creates a session with problem statement and expert selection
2. Session is created in PENDING state
3. User starts discussion, triggering expert turns
4. Experts exchange messages in real-time via WebSocket
5. User can send interventions to guide discussion
6. System detects consensus and ends session

### Creating Sessions

**SessionForm Component** (`src/components/sessions/SessionForm.tsx`):
- Problem statement input (10-2000 characters)
- Expert multi-select with specialty badges
- Max messages configuration (5-200)
- Form validation using Zod schema

**Validation Schema** (`src/lib/validations/session.ts`):
```typescript
sessionFormSchema = {
  problemStatement: string (min 10, max 2000),
  expertIds: string[] (min 2, max 10),
  maxMessages: number (min 5, max 200, default 30)
}
```

### Session List

**SessionsPage** (`src/pages/SessionsPage.tsx`):
- Grid display of all sessions
- Status badges (PENDING, ACTIVE, COMPLETED)
- Quick expert preview (max 3 + count)
- Consensus indicator
- Create new session button
- Refresh functionality

**SessionCard Component** (`src/components/sessions/SessionCard.tsx`):
- Truncated problem statement (100 chars)
- Status with color coding and animation
- Expert list with specialty badges
- Message count and consensus status
- Hover effects and click navigation

### Real-Time Discussion

**SessionDetailPage** (`src/pages/SessionDetailPage.tsx`):
- Two-column layout (messages + controls)
- Real-time message streaming
- Session status monitoring
- Expert details sidebar
- Connection status indicators

**Message Display:**
- MessageList component with auto-scroll
- MessageItem with role-based styling
- Intervention messages highlighted in blue
- Consensus messages highlighted in green
- System messages in gray
- Timestamps with smart formatting (today/yesterday/date)

### User Interventions

**InterventionPanel Component** (`src/components/sessions/InterventionPanel.tsx`):
- Textarea for intervention content
- Character counter (max 1000)
- Connection status indicator
- Send button with loading state
- Error handling and display
- Disabled when discussion inactive or disconnected

**Intervention Flow:**
1. User types message in InterventionPanel
2. Clicks "Send Intervention"
3. Message sent via WebSocket `intervention` event
4. Backend queues intervention
5. System acknowledges with `intervention-queued` event
6. Message appears in discussion when processed

### WebSocket Integration

**useWebSocket Hook** (`src/hooks/use-websocket.ts`):

State management:
- `socket` - Socket.IO instance
- `isConnected` - Connection status
- `error` - Error messages
- `messages` - All discussion messages
- `consensusReached` - Consensus flag
- `isDiscussionActive` - Discussion status
- `currentExpertTurn` - Current expert ID

Events handled:
- `connect` - Connection established
- `disconnect` - Connection lost
- `message` - New message received
- `expert-turn-start` - Expert turn started
- `discussion-started` - Discussion began
- `consensus-reached` - Consensus detected
- `session-ended` - Session completed
- `intervention-queued` - Intervention queued
- `error` - Error occurred

Methods:
- `startDiscussion()` - Emit `start-discussion` event
- `sendIntervention(content)` - Emit `intervention` event with content
- `disconnect()` - Close WebSocket connection

**JWT Authentication:**
```typescript
// 1. Fetch session token
const { token } = await getSessionToken(sessionId);

// 2. Create socket with token in auth
const socket = createSocketConnection(token);

// 3. Connect to /discussion namespace
socket.connect();
```

### Session States

- **PENDING** - Session created, awaiting start
- **ACTIVE** - Discussion in progress
- **COMPLETED** - Discussion ended (consensus or max messages reached)

### Consensus Detection

The system detects consensus when experts reach agreement:
- Visual indicator in SessionControls
- Green alert in MessageList
- Consensus message added to discussion
- Session transitions to COMPLETED state

### Components

Key components for session management:

| Component | Purpose |
|-----------|---------|
| SessionForm | Create session form with validation |
| SessionFormDialog | Dialog wrapper for SessionForm |
| SessionsPage | List all sessions |
| SessionCard | Individual session card |
| SessionDetailPage | Session detail view with real-time updates |
| MessageList | Display discussion messages |
| MessageItem | Individual message display |
| InterventionPanel | Send user interventions |
| SessionControls | Session status and controls |
| useWebSocket | WebSocket connection and event handling |

### Best Practices

1. **Error Handling** - Always handle WebSocket errors and display to user
2. **Connection Status** - Show connection status in UI
3. **Auto-scroll** - Messages auto-scroll to bottom on new messages
4. **Cleanup** - Disconnect WebSocket on component unmount
5. **Validation** - Validate form inputs before submission
6. **Loading States** - Show loading indicators during async operations
7. **Timestamps** - Use smart timestamp formatting for better UX
8. **Accessibility** - Use semantic HTML and ARIA labels

## Next Steps

The current implementation provides the foundation and placeholder pages. Subsequent phases will implement:

1. **Expert Management** - Full CRUD interface for creating and managing AI experts
2. **Session Creation** - Form to create new discussion sessions with expert selection
3. **Real-time Discussion** - Live streaming of expert messages with intervention capabilities
4. **Session History** - Browse and review past discussions

## Development Notes

- Use `cn()` utility from `@/lib/utils` for conditional class merging
- Follow Shadcn UI patterns for component composition
- Keep API calls in `src/lib/api/` directory
- Define types in `src/types/` directory
- Use Zustand for global state management

