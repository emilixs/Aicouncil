import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { AuthService } from '../src/common/auth/auth.service';

describe('Endpoints (e2e)', () => {
  let app: NestFastifyApplication;
  let authService: AuthService;

  const mockExpert = {
    id: 'expert-1',
    name: 'Test Expert',
    specialty: 'Testing',
    systemPrompt: 'You are a test expert',
    driverType: 'OPENAI',
    config: { model: 'gpt-4' },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockSession = {
    id: 'session-1',
    problemStatement: 'Test problem',
    maxMessages: 10,
    status: 'PENDING',
    type: 'DISCUSSION',
    consensusReached: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    experts: [{
      sessionId: 'session-1',
      expertId: 'expert-1',
      expert: mockExpert,
    }],
    _count: { messages: 0 },
  };

  const mockPrismaService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([1]),
    $transaction: jest.fn(),
    session: {
      findMany: jest.fn().mockResolvedValue([mockSession]),
      findUnique: jest.fn().mockResolvedValue(mockSession),
      create: jest.fn().mockResolvedValue(mockSession),
      update: jest.fn().mockResolvedValue(mockSession),
    },
    sessionExpert: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    expert: {
      findMany: jest.fn().mockResolvedValue([mockExpert]),
      findUnique: jest.fn().mockResolvedValue(mockExpert),
      create: jest.fn().mockResolvedValue(mockExpert),
      update: jest.fn().mockResolvedValue(mockExpert),
      delete: jest.fn().mockResolvedValue(mockExpert),
    },
    message: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  let token: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-for-e2e';
    process.env.JWT_EXPIRES_IN = '1h';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    authService = moduleFixture.get<AuthService>(AuthService);
    token = authService.generateToken({ sessionId: 'session-1', userId: 'test-user' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-set defaults after clearAllMocks
    mockPrismaService.expert.findMany.mockResolvedValue([mockExpert]);
    mockPrismaService.expert.findUnique.mockResolvedValue(mockExpert);
    mockPrismaService.expert.create.mockResolvedValue(mockExpert);
    mockPrismaService.expert.update.mockResolvedValue(mockExpert);
    mockPrismaService.expert.delete.mockResolvedValue(mockExpert);
    mockPrismaService.session.findMany.mockResolvedValue([mockSession]);
    mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
    mockPrismaService.session.create.mockResolvedValue(mockSession);
    mockPrismaService.message.findMany.mockResolvedValue([]);
    mockPrismaService.$queryRaw.mockResolvedValue([1]);
  });

  describe('Expert CRUD', () => {
    it('POST /experts (201) - create expert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/experts',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Test Expert',
          specialty: 'Testing',
          systemPrompt: 'You are a test expert',
          driverType: 'OPENAI',
          config: { model: 'gpt-4' },
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('GET /experts (200) - list experts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/experts',
        headers: {
          authorization: 'Bearer ' + token,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /experts/:id (200) - get one expert', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/experts/expert-1',
        headers: {
          authorization: 'Bearer ' + token,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /experts/:id (404) - not found when findUnique returns null', async () => {
      mockPrismaService.expert.findUnique.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/experts/nonexistent-id',
        headers: {
          authorization: 'Bearer ' + token,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('PATCH /experts/:id (200) - update expert', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/experts/expert-1',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Updated Expert',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('DELETE /experts/:id (204) - delete expert', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/experts/expert-1',
        headers: {
          authorization: 'Bearer ' + token,
        },
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('Session lifecycle', () => {
    it('POST /sessions (201) - create session', async () => {
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn({
          session: {
            create: jest.fn().mockResolvedValue(mockSession),
            findUnique: jest.fn().mockResolvedValue(mockSession),
          },
          sessionExpert: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        });
      });

      const response = await app.inject({
        method: 'POST',
        url: '/sessions',
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': 'application/json',
        },
        payload: {
          problemStatement: 'Test',
          expertIds: ['expert-1'],
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('GET /sessions (200) - list sessions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/sessions',
        headers: {
          authorization: 'Bearer ' + token,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /sessions/:id (200) - get one session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/sessions/session-1',
        headers: {
          authorization: 'Bearer ' + token,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /sessions/:id (404) - not found when findUnique returns null', async () => {
      mockPrismaService.session.findUnique.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/sessions/nonexistent-id',
        headers: {
          authorization: 'Bearer ' + token,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('GET /sessions/:id/messages (200) - get messages for session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/sessions/session-1/messages',
        headers: {
          authorization: 'Bearer ' + token,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
