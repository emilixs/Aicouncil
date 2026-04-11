import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import supertest from 'supertest';
import { NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { ExpertModule } from '../src/expert/expert.module';
import { CommonModule } from '../src/common/common.module';
import { PrismaService } from '../src/common/prisma.service';

// Fixed UUIDs for testing
const EXPERT_ID_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EXPERT_ID_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const NOT_FOUND_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const mockExpert1 = {
  id: EXPERT_ID_1,
  name: 'Alice',
  specialty: 'Software Architecture',
  systemPrompt: 'You are a senior software architect with 20 years of experience.',
  driverType: 'OPENAI',
  config: { model: 'gpt-4' },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const mockExpert2 = {
  id: EXPERT_ID_2,
  name: 'Bob',
  specialty: 'Security',
  systemPrompt: 'You are a cybersecurity expert specializing in application security.',
  driverType: 'ANTHROPIC',
  config: { model: 'claude-3-5-sonnet-20241022' },
  createdAt: new Date('2024-01-02T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
};

describe('ExpertController (e2e)', () => {
  let app: NestFastifyApplication;
  let mockPrisma: {
    expert: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $connect: jest.Mock;
    $disconnect: jest.Mock;
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    mockPrisma = {
      expert: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        CommonModule,
        ExpertModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
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
  // POST /experts
  // ─────────────────────────────────────────────────────────────────

  describe('POST /experts', () => {
    const validBody = {
      name: 'Alice',
      specialty: 'Software Architecture',
      systemPrompt: 'You are a senior software architect with extensive experience.',
      driverType: 'OPENAI',
      config: { model: 'gpt-4' },
    };

    it('201 – creates an expert with valid body', async () => {
      mockPrisma.expert.create.mockResolvedValue(mockExpert1);

      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send(validBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: EXPERT_ID_1,
        name: 'Alice',
        specialty: 'Software Architecture',
        driverType: 'OPENAI',
      });
      expect(mockPrisma.expert.create).toHaveBeenCalledTimes(1);
    });

    it('400 – missing name', async () => {
      const { name: _name, ...bodyWithoutName } = validBody;
      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send(bodyWithoutName)
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(mockPrisma.expert.create).not.toHaveBeenCalled();
    });

    it('400 – systemPrompt shorter than 10 characters', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send({ ...validBody, systemPrompt: 'Too short' })
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(mockPrisma.expert.create).not.toHaveBeenCalled();
    });

    it('400 – invalid driverType', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send({ ...validBody, driverType: 'INVALID_DRIVER' })
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(mockPrisma.expert.create).not.toHaveBeenCalled();
    });

    it('400 – missing config', async () => {
      const { config: _config, ...bodyWithoutConfig } = validBody;
      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send(bodyWithoutConfig)
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(mockPrisma.expert.create).not.toHaveBeenCalled();
    });

    it('400 – name too long (> 100 chars)', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send({ ...validBody, name: 'A'.repeat(101) })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('400 – specialty too long (> 200 chars)', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send({ ...validBody, specialty: 'B'.repeat(201) })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('400 – empty name string', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send({ ...validBody, name: '' })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('201 – ANTHROPIC driverType is valid', async () => {
      mockPrisma.expert.create.mockResolvedValue(mockExpert2);

      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send({
          name: 'Bob',
          specialty: 'Security',
          systemPrompt: 'You are a cybersecurity expert specializing in application security.',
          driverType: 'ANTHROPIC',
          config: { model: 'claude-3-5-sonnet-20241022' },
        })
        .expect(201);

      expect(response.body.driverType).toBe('ANTHROPIC');
    });

    it('201 – GROK driverType is valid', async () => {
      const grokExpert = {
        ...mockExpert1,
        driverType: 'GROK',
        config: { model: 'grok-1' },
      };
      mockPrisma.expert.create.mockResolvedValue(grokExpert);

      const response = await supertest(app.getHttpServer())
        .post('/experts')
        .send({
          name: 'Charlie',
          specialty: 'Data Analysis',
          systemPrompt: 'You are a data analysis expert with strong statistical skills.',
          driverType: 'GROK',
          config: { model: 'grok-1' },
        })
        .expect(201);

      expect(response.body.driverType).toBe('GROK');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /experts
  // ─────────────────────────────────────────────────────────────────

  describe('GET /experts', () => {
    it('200 – returns empty array when no experts', async () => {
      mockPrisma.expert.findMany.mockResolvedValue([]);

      const response = await supertest(app.getHttpServer())
        .get('/experts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('200 – returns array of experts', async () => {
      mockPrisma.expert.findMany.mockResolvedValue([mockExpert1, mockExpert2]);

      const response = await supertest(app.getHttpServer())
        .get('/experts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({ id: EXPERT_ID_1, name: 'Alice' });
      expect(response.body[1]).toMatchObject({ id: EXPERT_ID_2, name: 'Bob' });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /experts/:id
  // ─────────────────────────────────────────────────────────────────

  describe('GET /experts/:id', () => {
    it('200 – returns expert when found', async () => {
      mockPrisma.expert.findUnique.mockResolvedValue(mockExpert1);

      const response = await supertest(app.getHttpServer())
        .get(`/experts/${EXPERT_ID_1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: EXPERT_ID_1,
        name: 'Alice',
        specialty: 'Software Architecture',
        driverType: 'OPENAI',
      });
    });

    it('404 – returns 404 when expert not found', async () => {
      mockPrisma.expert.findUnique.mockResolvedValue(null);

      const response = await supertest(app.getHttpServer())
        .get(`/experts/${NOT_FOUND_ID}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // PATCH /experts/:id
  // ─────────────────────────────────────────────────────────────────

  describe('PATCH /experts/:id', () => {
    it('200 – partial update returns updated expert', async () => {
      const updatedExpert = { ...mockExpert1, name: 'Alice Updated' };
      mockPrisma.expert.update.mockResolvedValue(updatedExpert);

      const response = await supertest(app.getHttpServer())
        .patch(`/experts/${EXPERT_ID_1}`)
        .send({ name: 'Alice Updated' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: EXPERT_ID_1,
        name: 'Alice Updated',
      });
    });

    it('200 – updating systemPrompt only', async () => {
      const newPrompt = 'You are an updated expert with deep knowledge.';
      const updatedExpert = { ...mockExpert1, systemPrompt: newPrompt };
      mockPrisma.expert.update.mockResolvedValue(updatedExpert);

      const response = await supertest(app.getHttpServer())
        .patch(`/experts/${EXPERT_ID_1}`)
        .send({ systemPrompt: newPrompt })
        .expect(200);

      expect(response.body.systemPrompt).toBe(newPrompt);
    });

    it('404 – returns 404 when expert not found on update', async () => {
      const prismaError = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrisma.expert.update.mockRejectedValue(prismaError);

      const response = await supertest(app.getHttpServer())
        .patch(`/experts/${NOT_FOUND_ID}`)
        .send({ name: 'Ghost' })
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('400 – systemPrompt shorter than 10 chars is rejected in update', async () => {
      const response = await supertest(app.getHttpServer())
        .patch(`/experts/${EXPERT_ID_1}`)
        .send({ systemPrompt: 'Short' })
        .expect(400);

      expect(mockPrisma.expert.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // DELETE /experts/:id
  // ─────────────────────────────────────────────────────────────────

  describe('DELETE /experts/:id', () => {
    it('204 – deletes an expert successfully', async () => {
      mockPrisma.expert.delete.mockResolvedValue(mockExpert1);

      await supertest(app.getHttpServer())
        .delete(`/experts/${EXPERT_ID_1}`)
        .expect(204);

      expect(mockPrisma.expert.delete).toHaveBeenCalledWith({
        where: { id: EXPERT_ID_1 },
      });
    });

    it('404 – returns 404 when expert not found on delete', async () => {
      const prismaError = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrisma.expert.delete.mockRejectedValue(prismaError);

      const response = await supertest(app.getHttpServer())
        .delete(`/experts/${NOT_FOUND_ID}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });
});
