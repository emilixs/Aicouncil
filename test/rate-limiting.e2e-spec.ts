import { Test, TestingModule } from '@nestjs/testing';
import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';

/**
 * E2E tests for API rate limiting.
 *
 * These tests define the expected throttling behavior:
 * - POST /sessions/:id/start — 3 requests/min (expensive LLM operation)
 * - POST /experts — 10 requests/min (write operation)
 * - GET /experts — 30 requests/min (default read limit)
 * - 429 responses include Retry-After header and structured body
 * - Successful responses include X-RateLimit-* headers
 *
 * RED phase: these tests should FAIL until rate limiting is implemented.
 */
describe('Rate Limiting (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Set required env vars for test
    process.env.JWT_SECRET = 'test-secret-for-rate-limiting-e2e';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    const mockPrismaService = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
      expert: {
        create: jest.fn().mockResolvedValue({ id: 'mock-id', name: 'test' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockRejectedValue(new Error('Not found')),
        update: jest.fn(),
        delete: jest.fn(),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockRejectedValue(new Error('Not found')),
        update: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /sessions/:id/start — limit: 3/min', () => {
    it('should return 429 on the 4th rapid request', async () => {
      const sessionId = 'test-session-id';

      // Send 3 requests (within limit) — they may fail with 404/400 but should NOT be 429
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'POST',
          url: `/sessions/${sessionId}/start`,
        });
        expect(response.statusCode).not.toBe(429);
      }

      // 4th request should be throttled
      const throttledResponse = await app.inject({
        method: 'POST',
        url: `/sessions/${sessionId}/start`,
      });
      expect(throttledResponse.statusCode).toBe(429);
    });
  });

  describe('POST /experts — limit: 10/min', () => {
    it('should return 429 on the 11th rapid request', async () => {
      // Send 10 requests (within limit)
      for (let i = 0; i < 10; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/experts',
          payload: {
            name: `Expert ${i}`,
            specialty: 'testing',
            driverType: 'ANTHROPIC',
          },
        });
        expect(response.statusCode).not.toBe(429);
      }

      // 11th request should be throttled
      const throttledResponse = await app.inject({
        method: 'POST',
        url: '/experts',
        payload: {
          name: 'Expert overflow',
          specialty: 'testing',
          driverType: 'ANTHROPIC',
        },
      });
      expect(throttledResponse.statusCode).toBe(429);
    });
  });

  describe('GET /experts — default limit: 30/min', () => {
    it('should return 429 on the 31st request', async () => {
      // Send 30 requests (within limit)
      for (let i = 0; i < 30; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/experts',
        });
        expect(response.statusCode).not.toBe(429);
      }

      // 31st request should be throttled
      const throttledResponse = await app.inject({
        method: 'GET',
        url: '/experts',
      });
      expect(throttledResponse.statusCode).toBe(429);
    });
  });

  describe('429 response format', () => {
    it('should include Retry-After header in 429 response', async () => {
      const sessionId = 'test-retry-header';

      // Exhaust the limit (3 requests for session start)
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: `/sessions/${sessionId}/start`,
        });
      }

      // Trigger 429
      const throttledResponse = await app.inject({
        method: 'POST',
        url: `/sessions/${sessionId}/start`,
      });

      expect(throttledResponse.statusCode).toBe(429);
      expect(throttledResponse.headers['retry-after']).toBeDefined();
    });

    it('should return correct 429 response body structure', async () => {
      const sessionId = 'test-body-structure';

      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: `/sessions/${sessionId}/start`,
        });
      }

      // Trigger 429
      const throttledResponse = await app.inject({
        method: 'POST',
        url: `/sessions/${sessionId}/start`,
      });

      expect(throttledResponse.statusCode).toBe(429);
      const body = JSON.parse(throttledResponse.body);
      expect(body).toMatchObject({
        statusCode: 429,
        message: expect.any(String),
        retryAfter: expect.any(Number),
      });
    });
  });

  describe('Rate limit headers on successful responses', () => {
    it('should include X-RateLimit-* headers on successful responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/experts',
      });

      // Should not be throttled
      expect(response.statusCode).not.toBe(429);

      // Should include rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });
});
