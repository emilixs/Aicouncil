# AI Council

Multi-agent LLM discussion system with extensible expert configuration.

## Description

AI Council is a sophisticated platform that orchestrates multi-agent discussions using Large Language Models (LLMs). The system allows for dynamic expert configuration, turn-based conversations, consensus detection, and user interventions.

## Technology Stack

- **Backend**: NestJS with Fastify
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: React (to be implemented)
- **LLM Providers**: OpenAI, Anthropic Claude

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database
- npm or yarn package manager

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with appropriate values:
   - Database connection string
   - LLM API keys (OpenAI, Anthropic)
   - Port configuration

## Running the Application

### Development mode
```bash
npm run start:dev
```

### Production mode
```bash
npm run build
npm run start:prod
```

### Debug mode
```bash
npm run start:debug
```

## Project Structure

```
src/
├── common/          # Shared utilities, decorators, guards, interceptors
├── llm/             # LLM driver abstractions and implementations
├── expert/          # Expert configuration management
├── session/         # Discussion session management
├── message/         # Conversation message storage
├── council/         # Multi-agent orchestration logic
├── app.module.ts    # Root application module
├── app.controller.ts # Health check endpoint
├── app.service.ts   # Basic application service
└── main.ts          # Application entry point
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Linting and Formatting

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT

