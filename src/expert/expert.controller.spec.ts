import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { ExpertController } from './expert.controller';
import { ExpertService } from './expert.service';
import { PrismaService } from '../common/prisma.service';

describe('ExpertController - POST /experts/:id/clone', () => {
  let app: INestApplication;
  let prisma: {
    expert: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockExpert = {
    id: 'test-expert-id',
    name: 'Security Expert',
    specialty: 'Cybersecurity',
    systemPrompt: 'You are a cybersecurity expert who analyzes threats.',
    driverType: 'ANTHROPIC',
    config: { model: 'claude-sonnet-4-5-20250514', temperature: 0.7 },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeAll(async () => {
    prisma = {
      expert: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExpertController],
      providers: [
        ExpertService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should clone an expert and return 201', async () => {
    const clonedExpert = {
      ...mockExpert,
      id: 'cloned-expert-id',
      name: 'Security Expert (Copy)',
      createdAt: new Date('2026-04-11'),
      updatedAt: new Date('2026-04-11'),
    };

    prisma.expert.findUnique.mockResolvedValue(mockExpert);
    prisma.expert.create.mockResolvedValue(clonedExpert);

    const response = await request(app.getHttpServer())
      .post(`/experts/${mockExpert.id}/clone`)
      .expect(HttpStatus.CREATED);

    expect(response.body).toHaveProperty('id', 'cloned-expert-id');
    expect(response.body.id).not.toBe(mockExpert.id);
    expect(response.body.specialty).toBe(mockExpert.specialty);
    expect(response.body.systemPrompt).toBe(mockExpert.systemPrompt);
    expect(response.body.driverType).toBe(mockExpert.driverType);
  });

  it('should clone with optional name override', async () => {
    const customName = 'My Custom Expert';
    const clonedExpert = {
      ...mockExpert,
      id: 'cloned-expert-id',
      name: customName,
      createdAt: new Date('2026-04-11'),
      updatedAt: new Date('2026-04-11'),
    };

    prisma.expert.findUnique.mockResolvedValue(mockExpert);
    prisma.expert.create.mockResolvedValue(clonedExpert);

    const response = await request(app.getHttpServer())
      .post(`/experts/${mockExpert.id}/clone`)
      .send({ name: customName })
      .expect(HttpStatus.CREATED);

    expect(response.body.name).toBe(customName);
  });

  it('should return 404 for non-existent expert', async () => {
    prisma.expert.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/experts/non-existent-id/clone')
      .expect(HttpStatus.NOT_FOUND);
  });

  it('should return a new ID for the cloned expert', async () => {
    const clonedExpert = {
      ...mockExpert,
      id: 'completely-new-id',
      createdAt: new Date('2026-04-11'),
      updatedAt: new Date('2026-04-11'),
    };

    prisma.expert.findUnique.mockResolvedValue(mockExpert);
    prisma.expert.create.mockResolvedValue(clonedExpert);

    const response = await request(app.getHttpServer())
      .post(`/experts/${mockExpert.id}/clone`)
      .expect(HttpStatus.CREATED);

    expect(response.body.id).toBe('completely-new-id');
    expect(response.body.id).not.toBe(mockExpert.id);
  });
});
