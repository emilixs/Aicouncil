import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import supertest from 'supertest';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { SessionModule } from '../src/session/session.module';
import { MessageModule } from '../src/message/message.module';
import { CouncilModule } from '../src/council/council.module';
import { CommonModule } from '../src/common/common.module';
import { LlmModule } from '../src/llm/llm.module';
import { PrismaService } from '../src/common/prisma.service';
import { DriverFactory } from '../src/llm/factories/driver.factory';

// ─────────────────────────────────────────────────────────────────
// Shared fixture data
// ─────────────────────────────────────────────────────────────────

const EXPERT_ID_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EXPERT_ID_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SESSION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const NOT_FOUND_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const mockExpert1 = {
  id: EXPERT_ID_1,
  name: 'Alice',
  specialty: 'Software Architecture',
  systemPrompt: 'You are a senior software architect.',
  driverType: 'OPENAI',
  config: { model: 'gpt-4' },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const mockExpert2 = {
  id: EXPERT_ID_2,
  name: 'Bob',
  specialty: 'Security',
  systemPrompt: 'You are a cybersecurity expert.',
  driverType: 'ANTHROPIC',
  config: { model: 'claude-3-5-sonnet-20241022' },
  createdAt: new Date('2024-01-02T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
};

const mockSession = {
  id: SESSION_ID,
  problemStatement: 'How should we architect a scalable microservices system?',
  status: 'PENDING',
  maxMessages: 20,
  consensusReached: false,
  createdAt: new Date('2024-01-03T00:00:00Z'),
  updatedAt: new Date('2024-01-03T00:00:00Z'),
  experts: [
    { sessionId: SESSION_ID, expertId: EXPERT_ID_1, expert: mockExpert1 },
    { sessionId: SESSION_ID, expertId: EXPERT_ID_2, expert: mockExpert2 },
  ],
  _count: { messages: 0 },
};

const mockCompletedSession = {
  ...mockSession,
  status: 'COMPLETED',
  consensusReached: true,
};

const mockActiveSession = {
  ...mockSession,
  status: 'ACTIVE',
};

const mockMessage1 = {
  id: 'msg-0001',
  sessionId: SESSION_ID,
  expertId: EXPERT_ID_1,
  content: 'I recommend using domain-driven design for the microservices.',
  role: 'ASSISTANT',
  isIntervention: false,
  timestamp: new Date('2024-01-03T00:01:00Z'),
  expert: mockExpert1,
};

const mockMessage2 = {
  id: 'msg-0002',
  sessionId: SESSION_ID,
  expertId: EXPERT_ID_2,
  content: 'I agree with the DDD approach. We should also consider security boundaries.',
  role: 'ASSISTANT',
  isIntervention: false,
  timestamp: new Date('2024-01-03T00:02:00Z'),
  expert: mockExpert2,
};

// ─────────────────────────────────────────────────────────────────
// Mock Prisma & DriverFactory
// ─────────────────────────────────────────────────────────────────

let mockPrisma: {
  expert: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  session: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  sessionExpert: {
    createMany: jest.Mock;
    findUnique: jest.Mock;
  };
  message: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

const mockDriverFactory = {
  createDriver: jest.fn(),
};

// ─────────────────────────────────────────────────────────────────
// Session CRUD tests
// ─────────────────────────────────────────────────────────────────

describe('SessionController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    mockPrisma = {
      expert: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      session: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      sessionExpert: {
        createMany: jest.fn(),
        findUnique: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        CommonModule,
        LlmModule,
        SessionModule,
        MessageModule,
        CouncilModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(DriverFactory)
      .useValue(mockDriverFactory)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────
  // POST /sessions
  // ─────────────────────────────────────────────────────────────────

  describe('POST /sessions', () => {
    const validBody = {
      problemStatement: 'How should we architect a scalable microservices system?',
      expertIds: [EXPERT_ID_1, EXPERT_ID_2],
    };

    it('201 – creates a session with valid body', async () => {
      mockPrisma.expert.findMany.mockResolvedValue([
        { id: EXPERT_ID_1 },
        { id: EXPERT_ID_2 },
      ]);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        return fn({
          session: {
            create: jest.fn().mockResolvedValue({ id: SESSION_ID }),
            findUnique: jest.fn().mockResolvedValue(mockSession),
          },
          sessionExpert: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        });
      });

      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send(validBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: SESSION_ID,
        problemStatement: 'How should we architect a scalable microservices system?',
      });
    });

    it('400 – problemStatement shorter than 10 characters', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send({ ...validBody, problemStatement: 'Too short' })
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('400 – only 1 expertId (below minimum of 2)', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send({ ...validBody, expertIds: [EXPERT_ID_1] })
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('400 – empty expertIds array', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send({ ...validBody, expertIds: [] })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('400 – duplicate expertIds', async () => {
      mockPrisma.expert.findMany.mockResolvedValue([{ id: EXPERT_ID_1 }]);

      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send({ ...validBody, expertIds: [EXPERT_ID_1, EXPERT_ID_1] })
        .expect(400);

      expect(response.body.message).toContain('Duplicate');
    });

    it('404 – expert IDs not found', async () => {
      mockPrisma.expert.findMany.mockResolvedValue([]);

      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send(validBody)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('400 – problemStatement exceeds 5000 chars', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send({ ...validBody, problemStatement: 'A'.repeat(5001) })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('400 – more than 10 expertIds', async () => {
      const tooManyIds = Array.from({ length: 11 }, (_, i) => `id-${i}`);
      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send({ ...validBody, expertIds: tooManyIds })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('201 – optional maxMessages within 5-100 range is accepted', async () => {
      mockPrisma.expert.findMany.mockResolvedValue([
        { id: EXPERT_ID_1 },
        { id: EXPERT_ID_2 },
      ]);
      const sessionWithMax = { ...mockSession, maxMessages: 50 };
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        return fn({
          session: {
            create: jest.fn().mockResolvedValue({ id: SESSION_ID }),
            findUnique: jest.fn().mockResolvedValue(sessionWithMax),
          },
          sessionExpert: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        });
      });

      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send({ ...validBody, maxMessages: 50 })
        .expect(201);

      expect(response.body.maxMessages).toBe(50);
    });

    it('400 – maxMessages below minimum of 5', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send({ ...validBody, maxMessages: 4 })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('400 – maxMessages above maximum of 100', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/sessions')
        .send({ ...validBody, maxMessages: 101 })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /sessions
  // ─────────────────────────────────────────────────────────────────

  describe('GET /sessions', () => {
    it('200 – returns empty array when no sessions', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);

      const response = await supertest(app.getHttpServer())
        .get('/sessions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('200 – returns array of sessions', async () => {
      mockPrisma.session.findMany.mockResolvedValue([mockSession]);

      const response = await supertest(app.getHttpServer())
        .get('/sessions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: SESSION_ID,
        problemStatement: 'How should we architect a scalable microservices system?',
      });
    });

    it('200 – sessions include experts array', async () => {
      mockPrisma.session.findMany.mockResolvedValue([mockSession]);

      const response = await supertest(app.getHttpServer())
        .get('/sessions')
        .expect(200);

      expect(Array.isArray(response.body[0].experts)).toBe(true);
      expect(response.body[0].experts).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /sessions/:id
  // ─────────────────────────────────────────────────────────────────

  describe('GET /sessions/:id', () => {
    it('200 – returns session when found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const response = await supertest(app.getHttpServer())
        .get(`/sessions/${SESSION_ID}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: SESSION_ID,
        problemStatement: 'How should we architect a scalable microservices system?',
        statusDisplay: 'pending',
      });
    });

    it('404 – returns 404 when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await supertest(app.getHttpServer())
        .get(`/sessions/${NOT_FOUND_ID}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('200 – statusDisplay reflects internal status correctly', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockCompletedSession);

      const response = await supertest(app.getHttpServer())
        .get(`/sessions/${SESSION_ID}`)
        .expect(200);

      expect(response.body.statusDisplay).toBe('concluded');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /sessions/:id/messages
  // ─────────────────────────────────────────────────────────────────

  describe('GET /sessions/:id/messages', () => {
    it('200 – returns messages for existing session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.message.findMany.mockResolvedValue([mockMessage1, mockMessage2]);

      const response = await supertest(app.getHttpServer())
        .get(`/sessions/${SESSION_ID}/messages`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        sessionId: SESSION_ID,
        content: 'I recommend using domain-driven design for the microservices.',
        role: 'ASSISTANT',
      });
    });

    it('200 – returns empty array when session has no messages', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.message.findMany.mockResolvedValue([]);

      const response = await supertest(app.getHttpServer())
        .get(`/sessions/${SESSION_ID}/messages`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('404 – returns 404 when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await supertest(app.getHttpServer())
        .get(`/sessions/${NOT_FOUND_ID}/messages`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('200 – messages include expertName when expert is set', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.message.findMany.mockResolvedValue([mockMessage1]);

      const response = await supertest(app.getHttpServer())
        .get(`/sessions/${SESSION_ID}/messages`)
        .expect(200);

      expect(response.body[0].expertName).toBe('Alice');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // POST /sessions/:id/token
  // ─────────────────────────────────────────────────────────────────

  describe('POST /sessions/:id/token', () => {
    it('200 – returns token and sessionId for existing session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/token`)
        .send({})
        .expect(200);

      expect(response.body).toMatchObject({
        token: expect.any(String),
        sessionId: SESSION_ID,
      });
    });

    it('200 – token is a non-empty JWT string', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/token`)
        .send({})
        .expect(200);

      const { token } = response.body;
      // JWT format: three base64url segments separated by dots
      expect(token.split('.').length).toBe(3);
    });

    it('200 – accepts optional userId in body', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/token`)
        .send({ userId: 'user-123' })
        .expect(200);

      expect(response.body.sessionId).toBe(SESSION_ID);
      expect(response.body.token).toBeDefined();
    });

    it('200 – works with empty body', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/token`)
        .expect(200);

      expect(response.body.sessionId).toBe(SESSION_ID);
    });

    it('404 – returns 404 when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${NOT_FOUND_ID}/token`)
        .send({})
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Council endpoint tests
// ─────────────────────────────────────────────────────────────────

describe('CouncilController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    mockPrisma = {
      expert: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      session: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      sessionExpert: {
        createMany: jest.fn(),
        findUnique: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    const mockDriver = {
      chat: jest.fn().mockResolvedValue({ content: 'I agree with the approach.' }),
    };

    const localDriverFactory = {
      createDriver: jest.fn().mockReturnValue(mockDriver),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        CommonModule,
        LlmModule,
        SessionModule,
        MessageModule,
        CouncilModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(DriverFactory)
      .useValue(localDriverFactory)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────
  // POST /sessions/:id/start
  // ─────────────────────────────────────────────────────────────────

  describe('POST /sessions/:id/start', () => {
    it('400 – returns 400 when session is not PENDING', async () => {
      // Session is ACTIVE, not PENDING
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockActiveSession,
        _count: { messages: 0 },
      });

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/start`)
        .expect(400);

      expect(response.body.message).toContain('pending');
    });

    it('400 – returns 400 when session is COMPLETED', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockCompletedSession,
        _count: { messages: 2 },
      });

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/start`)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('404 – returns 404 when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${NOT_FOUND_ID}/start`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('400 – returns 400 when session has no experts', async () => {
      const sessionNoExperts = {
        id: SESSION_ID,
        problemStatement: 'A valid long enough problem statement.',
        status: 'PENDING',
        maxMessages: 20,
        consensusReached: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        experts: [],
        _count: { messages: 0 },
      };
      mockPrisma.session.findUnique.mockResolvedValue(sessionNoExperts);

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/start`)
        .expect(400);

      expect(response.body.message).toContain('no experts');
    });

    it('200 – successfully starts and completes a discussion', async () => {
      // Call sequence through CouncilService.startDiscussion:
      // 1. sessionService.findOne  -> session.findUnique (PENDING, has experts)
      // 2. driverFactory.createDriver (validation pass)
      // 3. sessionService.update(ACTIVE) -> session.findUnique (for current state) + session.update
      // 4. message.count (countBySession)
      // 5. message.findMany (findLatestBySession – recent context)
      // 6. driverFactory.createDriver (expert turn)
      // 7. messageService.create:
      //    a. session.findUnique (validate session ACTIVE)
      //    b. sessionExpert.findUnique (validate expert in session)
      //    c. $transaction -> { message.count, message.create }
      // 8. concludeSession -> sessionService.update(COMPLETED)
      //    -> session.findUnique (current state) + session.update
      // 9. message.count (final count)
      // 10. sessionService.findOne (final) -> session.findUnique (COMPLETED)

      const pendingSessionFull = {
        ...mockSession,
        status: 'PENDING',
        _count: { messages: 0 },
      };

      const activeSessionRaw = {
        id: SESSION_ID,
        problemStatement: mockSession.problemStatement,
        status: 'ACTIVE',
        maxMessages: 20,
        consensusReached: false,
        createdAt: mockSession.createdAt,
        updatedAt: mockSession.updatedAt,
        experts: mockSession.experts,
        _count: { messages: 0 },
      };

      const completedSessionRaw = {
        id: SESSION_ID,
        problemStatement: mockSession.problemStatement,
        status: 'COMPLETED',
        maxMessages: 20,
        consensusReached: true,
        createdAt: mockSession.createdAt,
        updatedAt: mockSession.updatedAt,
        experts: mockSession.experts,
        _count: { messages: 1 },
      };

      const createdMessage = {
        id: 'msg-0001',
        sessionId: SESSION_ID,
        expertId: EXPERT_ID_1,
        content: 'I agree with the approach.',
        role: 'ASSISTANT',
        isIntervention: false,
        timestamp: new Date(),
        expert: mockExpert1,
      };

      mockPrisma.session.findUnique
        // 1. initial findOne (PENDING)
        .mockResolvedValueOnce(pendingSessionFull)
        // 3a. sessionService.update(ACTIVE) – internal findOne for status check
        .mockResolvedValueOnce(pendingSessionFull)
        // 3b. session.update returns the updated session (ACTIVE)
        // (session.update mock below handles this)
        // 7a. MessageService.create – validate session is ACTIVE
        .mockResolvedValueOnce(activeSessionRaw)
        // 8a. sessionService.update(COMPLETED) – internal findOne
        .mockResolvedValueOnce(activeSessionRaw)
        // 10. final findOne
        .mockResolvedValueOnce(completedSessionRaw);

      mockPrisma.session.update
        // 3b. update to ACTIVE
        .mockResolvedValueOnce(activeSessionRaw)
        // 8b. update to COMPLETED
        .mockResolvedValueOnce(completedSessionRaw);

      // 7b. expert membership check
      mockPrisma.sessionExpert.findUnique.mockResolvedValue({
        sessionId: SESSION_ID,
        expertId: EXPERT_ID_1,
      });

      // 4 & 9. message counts
      mockPrisma.message.count.mockResolvedValue(0);

      // 5. recent messages for context (empty is fine)
      mockPrisma.message.findMany.mockResolvedValue([]);

      // 7c. $transaction used by MessageService.create
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        return fn({
          message: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(createdMessage),
          },
        });
      });

      const response = await supertest(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/start`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: SESSION_ID,
      });
    });
  });
});
