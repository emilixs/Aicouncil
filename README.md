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

## Council Orchestration System

### Overview

The Council module orchestrates multi-agent discussions between configured experts. The system enables collaborative problem-solving where multiple AI experts with different specialties work together to reach consensus on complex questions.

**Discussion Flow:**
1. Create a session with a problem statement and select experts
2. Start the discussion via the REST API
3. Experts take turns responding in round-robin order
4. Each expert is aware of other experts' competences and can reference them by name
5. Discussion continues until consensus is reached or message limit is hit
6. Session concludes with final status and consensusReached flag

**Key Features:**
- **Expert Awareness**: Experts know each other's names and specialties, enabling true collaboration
- **Round-Robin Turn-Taking**: Fair participation with each expert getting equal opportunities to contribute
- **Consensus Detection**: Automatic detection of agreement through explicit keywords
- **Message Limits**: Configurable limits prevent infinite discussions
- **Status Tracking**: Sessions transition through PENDING → ACTIVE → COMPLETED states

### Starting a Discussion

**Endpoint:** `POST /sessions/:id/start`

**Prerequisites:**
- Session must exist and be in PENDING status
- All experts in the session must have valid configurations
- Required API keys must be configured for the driver types used by experts

**Example Request:**
```bash
curl -X POST http://localhost:3000/sessions/abc123-def456-ghi789/start
```

**Response:**
```json
{
  "id": "abc123-def456-ghi789",
  "problemStatement": "How should we architect a scalable microservices system?",
  "status": "COMPLETED",
  "consensusReached": true,
  "maxMessages": 50,
  "createdAt": "2025-10-26T10:00:00Z",
  "updatedAt": "2025-10-26T10:05:30Z",
  "experts": [...]
}
```

**Important Notes:**
- This is a **long-running synchronous operation** that may take seconds to minutes
- Duration depends on number of experts, problem complexity, message limit, and LLM response times
- The endpoint returns only after the discussion concludes
- Future WebSocket gateway will provide real-time streaming for better UX

### How Discussions Work

#### Turn-Taking

Experts take turns in **round-robin order**, ensuring each expert participates equally. The order is determined by the order experts were added to the session. Each expert gets a turn to respond before the cycle repeats.

#### Expert Context

Each expert receives comprehensive context when generating their response:

1. **System Prompt**: Their own system prompt defining their role and expertise
2. **Problem Statement**: The original question/problem from the session
3. **Expert List**: Names and specialties of all participating experts
4. **Conversation History**: Last 10 messages with expert names and content
5. **Collaboration Instructions**: Explicit instruction to collaborate and state agreement when consensus is reached

**Example Context Sent to Expert:**
```
System: You are Sarah, a Security Expert specializing in application security and threat modeling.

Other experts in this discussion:
- John (Backend Architect): Specializes in scalable backend systems
- Maria (DevOps Engineer): Specializes in CI/CD and infrastructure

Problem: How should we architect a scalable microservices system?

Recent conversation:
[John (Backend Architect)]: We should use event-driven architecture with message queues...
[Maria (DevOps Engineer)]: I agree with John's approach. For deployment, we should use Kubernetes...

Please provide your expert opinion. If you agree with the current direction, explicitly state "I agree" or "consensus reached".
```

#### Consensus Detection

The discussion concludes when an expert's message contains explicit agreement keywords (case-insensitive):

- "I agree"
- "consensus reached"
- "we agree"
- "I concur"
- "agreed"
- "we have consensus"
- "we reached consensus"
- "in agreement"

When consensus is detected:
- Session status transitions to COMPLETED
- `consensusReached` flag is set to `true`
- No further messages are generated

#### Message Limits

Discussions also conclude if the session's `maxMessages` limit is reached:
- Session status transitions to COMPLETED
- `consensusReached` flag is set to `false`
- This prevents infinite discussions when experts cannot reach agreement

#### Session Status Transitions

- **PENDING**: Initial state after session creation
- **ACTIVE**: Discussion is in progress (set when discussion starts)
- **COMPLETED**: Discussion concluded (consensus reached or message limit hit)

### Expert Collaboration

Experts can reference each other by name in their responses, enabling natural collaboration:

**Example Expert Response:**
```
As Sarah (Security Expert) mentioned, we should implement OAuth 2.0 for authentication.
Building on John's event-driven architecture proposal, I recommend adding encryption
at rest for the message queues to protect sensitive data in transit.
```

The system prompt includes all experts' names and specialties, so experts can:
- Acknowledge other experts' contributions
- Build on previous suggestions
- Address specific experts by name
- Reference expertise areas when relevant

This creates a more natural and collaborative discussion compared to isolated responses.

### Viewing Discussion Results

After the discussion concludes, retrieve the results:

**Get Session Status:**
```bash
curl http://localhost:3000/sessions/abc123-def456-ghi789
```

Returns session with `status` (COMPLETED) and `consensusReached` flag.

**Get All Messages:**
```bash
curl http://localhost:3000/sessions/abc123-def456-ghi789/messages
```

Returns all messages in chronological order. Each message includes:
- `expertId`: UUID of the expert who generated the message
- `expertName`: Display name of the expert
- `expertSpecialty`: Specialty description of the expert
- `content`: The message content
- `timestamp`: When the message was created
- `isIntervention`: `false` for expert messages, `true` for user interventions (future feature)

### Configuration Tips

#### Expert Selection

Choose experts with **complementary specialties** for richer discussions:

**Good Example:**
- Backend Architect (system design)
- Security Expert (threat modeling)
- DevOps Engineer (deployment and operations)
- Database Specialist (data modeling)

**Poor Example:**
- Three Backend Architects with identical specialties
- Experts with overlapping competences

#### System Prompts

Write **clear, specific system prompts** that define each expert's role and perspective:

**Good Example:**
```
You are Sarah, a Security Expert with 15 years of experience in application security,
threat modeling, and compliance. Your focus is on identifying security vulnerabilities,
recommending security best practices, and ensuring systems meet security standards
like OWASP Top 10 and SOC 2.
```

**Poor Example:**
```
You are a security expert.
```

#### Message Limits

Set appropriate limits based on problem complexity:

- **Simple questions** (10-20 messages): Quick consensus on straightforward topics
- **Moderate complexity** (30-50 messages): Standard architectural discussions
- **Complex problems** (50-100 messages): Deep technical debates requiring multiple rounds

**Note:** Higher limits allow more thorough discussions but increase cost and latency.

#### Model Selection

Use **more capable models** for better reasoning and consensus:

**Recommended for Council Discussions:**
- OpenAI: `gpt-4`, `gpt-4-turbo`
- Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`

**Not Recommended:**
- `gpt-3.5-turbo`: May struggle with complex reasoning and consensus
- `claude-3-haiku-20240307`: Optimized for speed over reasoning depth

#### Temperature Settings

Adjust temperature based on discussion goals:

- **Lower temperature (0.3-0.5)**: Focused, deterministic discussions for technical decisions
- **Higher temperature (0.7-0.9)**: Creative exploration and brainstorming sessions

**Example Configuration:**
```json
{
  "model": "gpt-4",
  "temperature": 0.5,
  "maxTokens": 2000
}
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

