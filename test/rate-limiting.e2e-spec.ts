import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe, HttpStatus } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';

/**
 * E2E tests for API rate limiting.
 *
 * These tests verify that:
 * - POST /sessions/:id/start is limited to 3 requests per minute
 * - POST /experts is limited to 10 requests per minute
 * - GET /experts (default) is limited to 30 requests per minute
 * - 429 responses include Retry-After header
 * - 429 response body has { statusCode: 429, message, retryAfter }
 * - Successful responses include X-RateLimit-* headers
 *
 * RED PHASE: These tests should FAIL until rate limiting is implemented.
 */
describe('Rate Limiting (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Set required env vars for test environment
    process.env.JWT_SECRET = 'test-secret-for-rate-limiting-e2e';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

    const mockPrismaService = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
      expert: {
        create: jest.fn().mockResolvedValue({ id: 'mock-id', name: 'Test', specialty: 'Test', systemPrompt: 'test prompt here', driverType: 'ANTHROPIC', config: {}, createdAt: new Date(), updatedAt: new Date() }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockRejectedValue(new Error('Not found')),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: 'mock-session-id', problemStatement: 'test', status: 'PENDING', maxMessages: 20, createdAt: new Date(), updatedAt: new Date() }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockRejectedValue(new Error('Not found')),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
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

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  /**
   * Helper to make N rapid requests and return all responses.
   */
  async function makeRequests(
    method: 'GET' | 'POST',
    url: string,
    count: number,
    body?: Record<string, unknown>,
  ) {
    const responses = [];
    for (let i = 0; i < count; i++) {
      const result = await app.inject({
        method,
        url,
        payload: body,
      });
      responses.push(result);
    }
    return responses;
  }

  describe('POST /sessions/:id/start — strict limit (3/min)', () => {
    it('should return 429 after 3 requests in quick succession', async () => {
      // Use a fake session ID — the request may fail with 404, but
      // rate limiting should kick in before route handling on the 4th request
      const fakeSessionId = '00000000-0000-0000-0000-000000000001';
      const responses = await makeRequests(
        'POST',
        `/sessions/${fakeSessionId}/start`,
        4,
      );

      // First 3 requests should NOT be 429 (they may be 404 or other errors, but not rate-limited)
      for (let i = 0; i < 3; i++) {
        expect(responses[i].statusCode).not.toBe(HttpStatus.TOO_MANY_REQUESTS);
      }

      // 4th request should be rate-limited
      expect(responses[3].statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('should include Retry-After header in 429 response', async () => {
      const fakeSessionId = '00000000-0000-0000-0000-000000000002';
      const responses = await makeRequests(
        'POST',
        `/sessions/${fakeSessionId}/start`,
        4,
      );

      const rateLimitedResponse = responses[3];
      expect(rateLimitedResponse.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
      expect(Number(rateLimitedResponse.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('should include retryAfter in 429 response body', async () => {
      const fakeSessionId = '00000000-0000-0000-0000-000000000003';
      const responses = await makeRequests(
        'POST',
        `/sessions/${fakeSessionId}/start`,
        4,
      );

      const rateLimitedResponse = responses[3];
      expect(rateLimitedResponse.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);

      const body = JSON.parse(rateLimitedResponse.body);
      expect(body).toEqual(
        expect.objectContaining({
          statusCode: 429,
          message: expect.any(String),
          retryAfter: expect.any(Number),
        }),
      );
    });
  });

  describe('POST /experts — moderate limit (10/min)', () => {
    it('should return 429 after 10 requests in quick succession', async () => {
      const expertPayload = {
        name: 'Test Expert',
        specialty: 'Testing',
        systemPrompt: 'You are a test expert for rate limiting validation.',
        driverType: 'ANTHROPIC',
        config: { model: 'claude-3-haiku-20240307', temperature: 0.7, maxTokens: 100 },
      };

      const responses = await makeRequests('POST', '/experts', 11, expertPayload);

      // First 10 should not be rate-limited
      for (let i = 0; i < 10; i++) {
        expect(responses[i].statusCode).not.toBe(HttpStatus.TOO_MANY_REQUESTS);
      }

      // 11th should be rate-limited
      expect(responses[10].statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('GET /experts — default limit (30/min)', () => {
    it('should return 429 after 30 requests in quick succession', async () => {
      const responses = await makeRequests('GET', '/experts', 31);

      // First 30 should not be rate-limited
      for (let i = 0; i < 30; i++) {
        expect(responses[i].statusCode).not.toBe(HttpStatus.TOO_MANY_REQUESTS);
      }

      // 31st should be rate-limited
      expect(responses[30].statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('Rate limit headers on successful responses', () => {
    it('should include X-RateLimit-Limit header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/experts',
      });

      // Successful response should have rate limit headers
      expect(
        response.headers['x-ratelimit-limit'] ?? response.headers['X-RateLimit-Limit'],
      ).toBeDefined();
    });

    it('should include X-RateLimit-Remaining header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/experts',
      });

      expect(
        response.headers['x-ratelimit-remaining'] ??
          response.headers['X-RateLimit-Remaining'],
      ).toBeDefined();
    });

    it('should include X-RateLimit-Reset header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/experts',
      });

      expect(
        response.headers['x-ratelimit-reset'] ?? response.headers['X-RateLimit-Reset'],
      ).toBeDefined();
    });
  });

  describe('429 response structure', () => {
    it('should return structured error body with statusCode, message, and retryAfter', async () => {
      // Exhaust the limit on a strict endpoint
      const fakeSessionId = '00000000-0000-0000-0000-000000000099';
      const responses = await makeRequests(
        'POST',
        `/sessions/${fakeSessionId}/start`,
        4,
      );

      const rateLimited = responses[3];
      expect(rateLimited.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);

      const body = JSON.parse(rateLimited.body);
      expect(body.statusCode).toBe(429);
      expect(body.message).toBe('Too many requests. Please try again later.');
      expect(typeof body.retryAfter).toBe('number');
      expect(body.retryAfter).toBeGreaterThan(0);
    });
  });
});
