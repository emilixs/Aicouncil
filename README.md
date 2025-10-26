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

## Database Setup

The project uses Prisma ORM with PostgreSQL for data persistence.

1. Ensure PostgreSQL is installed and running on your system
2. Update the `DATABASE_URL` in your `.env` file with your PostgreSQL credentials:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/ai_council
   ```

3. Run the initial migration to create the database schema:
   ```bash
   npm run prisma:migrate:dev
   ```
   This will prompt you for a migration name (e.g., "init" for the first migration).

4. Prisma Client will be automatically generated during the migration process.

5. (Optional) Open Prisma Studio to inspect your database:
   ```bash
   npm run prisma:studio
   ```

## Migration Workflow

All database schema changes must be made in `prisma/schema.prisma`. Follow this workflow:

1. **Make schema changes** in `prisma/schema.prisma`
2. **Create a migration** with a descriptive name:
   ```bash
   npm run prisma:migrate:dev
   ```
   When prompted, provide a meaningful migration name (e.g., "add_user_role_field")

3. **Commit migration files** to Git:
   - All files in `prisma/migrations/` must be version-controlled
   - Never manually edit migration files

4. **For production deployments**, use:
   ```bash
   npm run prisma:migrate:deploy
   ```

5. **If you need to regenerate Prisma Client** without creating a migration:
   ```bash
   npm run prisma:generate
   ```

**Important**:
- The `build` script automatically runs `prisma generate` to ensure the Prisma Client is up-to-date before building the application.
- For CI/CD pipelines and production deployments, always run `npm run prisma:migrate:deploy` before starting the application to ensure the database schema is up-to-date.
- Example deployment sequence:
  ```bash
  npm install
  npm run prisma:migrate:deploy
  npm run build
  npm run start:prod
  ```

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

