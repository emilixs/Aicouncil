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

