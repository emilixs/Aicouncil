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

## LLM Driver System

### Overview

The system supports multiple LLM providers through an extensible driver architecture. Currently supported providers include:

- **OpenAI**: GPT models (GPT-4, GPT-4 Turbo, GPT-3.5 Turbo)
- **Anthropic**: Claude models (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku)

All drivers implement a common interface for both streaming and non-streaming chat completions. The system uses async generators for streaming, enabling real-time WebSocket integration in future phases.

### Configuration

API keys are configured via environment variables (see `.env.example`). Each expert in the database has:

- `driverType`: Enum value (`OPENAI` or `ANTHROPIC`)
- `config`: JSON field with model-specific settings

**Example OpenAI configuration:**
```json
{
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 2000,
  "topP": 1.0
}
```

**Example Anthropic configuration:**
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "temperature": 0.7,
  "maxTokens": 2000
}
```

**Supported configuration fields:**

- `model` (required): Model identifier
- `temperature` (optional): Sampling temperature (0-2 for OpenAI, 0-1 for Anthropic)
- `maxTokens` (optional): Maximum tokens to generate
- `topP` (optional): Nucleus sampling parameter
- `stop` (optional): Array of stop sequences

### Error Handling & Retry Logic

Drivers implement exponential backoff with full jitter for transient errors. The following errors are automatically retried:

- Rate limits (429)
- Timeouts (408)
- Server errors (5xx)
- Network errors (ETIMEDOUT, ECONNRESET, etc.)

`Retry-After` headers from providers are honored when present.

**Default retry configuration:**

- Max retries: 6 attempts
- Base delay: 500ms
- Max delay: 30 seconds
- Max total time: 120 seconds

Non-retryable errors (401, 400) fail immediately with descriptive exceptions.

### Supported Models

**OpenAI models:**
- `gpt-4`
- `gpt-4-turbo`
- `gpt-3.5-turbo`
- And newer variants

**Anthropic models:**
- `claude-3-5-sonnet-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

**Note:** Refer to provider documentation for latest model availability.

### Adding New Providers

To add support for a new LLM provider:

1. **Add new value to `DriverType` enum** in `prisma/schema.prisma`:
   ```prisma
   enum DriverType {
     OPENAI
     ANTHROPIC
     NEW_PROVIDER
   }
   ```

2. **Run migration** to update the database schema:
   ```bash
   npm run prisma:migrate:dev
   ```
   Provide a descriptive migration name (e.g., "add_new_provider_driver_type")

3. **Create new driver class** in `src/llm/drivers/` extending `LLMDriver` abstract class:
   ```typescript
   import { Injectable } from '@nestjs/common';
   import { LLMDriver } from '../interfaces/llm-driver.interface';

   @Injectable()
   export class NewProviderDriver extends LLMDriver {
     // Implement chat() and streamChat() methods
   }
   ```

4. **Implement required methods**: `chat()` and `streamChat()`
   - Map messages to provider-specific format
   - Handle provider-specific response format
   - Use `retryWithBackoff` utility for API calls

5. **Add error mapping logic** to convert provider errors to `LLMException` subclasses:
   - `LLMAuthenticationException` for 401 errors
   - `LLMRateLimitException` for 429 errors
   - `LLMInvalidRequestException` for 400 errors
   - `LLMServiceException` for 5xx errors
   - `LLMTimeoutException` for timeout/network errors

6. **Add new case to `DriverFactory.createDriver()`** switch statement in `src/llm/factories/driver.factory.ts`:
   ```typescript
   case DriverType.NEW_PROVIDER: {
     const apiKey = this.configService.get<string>('NEW_PROVIDER_API_KEY');
     if (!apiKey || apiKey.trim() === '') {
       throw new LLMAuthenticationException('New Provider API key not configured');
     }
     return new NewProviderDriver(apiKey);
   }
   ```

7. **Add API key environment variable** to `.env.example`:
   ```
   # New Provider API key - Get from https://provider.com/api-keys
   NEW_PROVIDER_API_KEY=your_new_provider_key_here
   ```

8. **Update this README** with provider-specific configuration and model examples

9. **Install provider's SDK**:
   ```bash
   npm install <provider-sdk>
   ```

### Architecture

The system uses the factory pattern: `DriverFactory` creates driver instances based on `DriverType`. Key architectural principles:

- **Stateless drivers**: Driver instances are stateless and thread-safe
- **API key injection**: API keys are injected at instantiation time via `DriverFactory`
- **Runtime configuration**: Model configuration (temperature, max tokens, etc.) is passed per request to `chat()` and `streamChat()` methods
- **Common interface**: The abstract `LLMDriver` interface ensures all providers have consistent behavior
- **Async generators**: Streaming uses async generators for compatibility with WebSocket gateways

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

