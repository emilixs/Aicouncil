import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { AuthService } from '../src/common/auth/auth.service';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;
  let authService: AuthService;

  const mockPrismaService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([1]),
    session: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'test-session-id',
        problem: 'Test problem',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        experts: [],
        _count: { messages: 0 },
      }),
      create: jest.fn().mockResolvedValue({
        id: 'new-session-id',
        problem: 'New problem',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        experts: [],
        _count: { messages: 0 },
      }),
    },
    expert: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-for-e2e';
    process.env.JWT_EXPIRES_IN = '1h';

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

    authService = moduleFixture.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('public routes (no token required)', () => {
    it('GET /health should return 200 without a token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('POST /sessions/:id/token should return 200 without a token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/sessions/test-session-id/token',
        headers: { 'content-type': 'application/json' },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('protected routes (token required)', () => {
    it('GET /sessions should return 401 without a token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/sessions',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /sessions should return 200 with a valid Bearer token', async () => {
      const token = authService.generateToken({
        sessionId: 'test-session-id',
        userId: 'test-user',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/sessions',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /sessions should return 401 with an invalid Bearer token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/sessions',
        headers: {
          authorization: 'Bearer invalid-token-here',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /experts should return 401 without a token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/experts',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
