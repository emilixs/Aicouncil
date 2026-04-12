import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaService } from '../common/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { SessionStatus, SessionType } from '@prisma/client';

const mockPrismaSession = {
  id: 'session-1',
  problemStatement: 'Test problem',
  maxMessages: 10,
  status: 'PENDING' as SessionStatus,
  type: 'DISCUSSION' as SessionType,
  consensusReached: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  experts: [
    {
      sessionId: 'session-1',
      expertId: 'exp-1',
      expert: {
        id: 'exp-1',
        name: 'Expert 1',
        specialty: 'Testing',
        systemPrompt: 'You are a test expert',
        driverType: 'OPENAI',
        config: { model: 'gpt-4' },
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    },
  ],
  _count: { messages: 0 },
};

describe('SessionService', () => {
  let service: SessionService;
  let prisma: {
    session: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    expert: {
      findMany: jest.Mock;
    };
    sessionExpert: {
      createMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: {
            session: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            expert: {
              findMany: jest.fn(),
            },
            sessionExpert: {
              createMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------------
  describe('create()', () => {
    const createDto = {
      problemStatement: 'Test problem statement',
      expertIds: ['exp-1', 'exp-2'],
      maxMessages: 10,
    };

    it('happy path — creates session with expert associations', async () => {
      prisma.expert.findMany.mockResolvedValue([{ id: 'exp-1' }, { id: 'exp-2' }]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        return fn({
          session: {
            create: jest.fn().mockResolvedValue(mockPrismaSession),
            findUnique: jest.fn().mockResolvedValue(mockPrismaSession),
          },
          sessionExpert: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        });
      });

      const result = await service.create(createDto);

      expect(prisma.expert.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['exp-1', 'exp-2'] } },
        select: { id: true },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe('session-1');
    });

    it('throws NotFoundException when expert IDs do not exist', async () => {
      prisma.expert.findMany.mockResolvedValue([{ id: 'exp-1' }]);

      await expect(
        service.create({ ...createDto, expertIds: ['exp-1', 'nonexistent-id'] }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.create({ ...createDto, expertIds: ['exp-1', 'nonexistent-id'] }),
      ).rejects.toThrow('nonexistent-id');
    });

    it('throws BadRequestException for duplicate expert IDs', async () => {
      prisma.expert.findMany.mockResolvedValue([{ id: 'exp-1' }]);

      await expect(
        service.create({ ...createDto, expertIds: ['exp-1', 'exp-1'] }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({ ...createDto, expertIds: ['exp-1', 'exp-1'] }),
      ).rejects.toThrow('Duplicate expert IDs are not allowed');
    });
  });

  // ---------------------------------------------------------------------------
  // findAll()
  // ---------------------------------------------------------------------------
  describe('findAll()', () => {
    it('returns array of sessions mapped through SessionResponseDto', async () => {
      prisma.session.findMany.mockResolvedValue([mockPrismaSession]);

      const result = await service.findAll();

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
    });

    it('returns empty array when no sessions exist', async () => {
      prisma.session.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------------------
  describe('findOne()', () => {
    it('returns session when found', async () => {
      prisma.session.findUnique.mockResolvedValue(mockPrismaSession);

      const result = await service.findOne('session-1');

      expect(prisma.session.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-1' } }),
      );
      expect(result.id).toBe('session-1');
    });

    it('throws NotFoundException when session does not exist', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('missing-id')).rejects.toThrow('missing-id');
    });
  });

  // ---------------------------------------------------------------------------
  // update()
  // ---------------------------------------------------------------------------
  describe('update()', () => {
    /**
     * Helper: prime findUnique so findOne (called inside update) succeeds.
     * We need to control the status of the "current" session.
     */
    function mockCurrentSession(status: SessionStatus) {
      prisma.session.findUnique.mockResolvedValue({ ...mockPrismaSession, status });
    }

    function mockUpdatedSession(status: SessionStatus) {
      prisma.session.update.mockResolvedValue({ ...mockPrismaSession, status });
    }

    it('valid transition PENDING -> ACTIVE', async () => {
      mockCurrentSession(SessionStatus.PENDING);
      mockUpdatedSession(SessionStatus.ACTIVE);

      const result = await service.update('session-1', { status: SessionStatus.ACTIVE });

      expect(prisma.session.update).toHaveBeenCalled();
      expect(result.id).toBe('session-1');
    });

    it('invalid transition COMPLETED -> ACTIVE throws BadRequestException', async () => {
      mockCurrentSession(SessionStatus.COMPLETED);

      await expect(
        service.update('session-1', { status: SessionStatus.ACTIVE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('invalid transition CANCELLED -> ACTIVE throws BadRequestException', async () => {
      mockCurrentSession(SessionStatus.CANCELLED);

      await expect(
        service.update('session-1', { status: SessionStatus.ACTIVE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('same status is allowed (no transition needed)', async () => {
      mockCurrentSession(SessionStatus.PENDING);
      mockUpdatedSession(SessionStatus.PENDING);

      const result = await service.update('session-1', { status: SessionStatus.PENDING });

      expect(prisma.session.update).toHaveBeenCalled();
      expect(result.id).toBe('session-1');
    });

    it('valid transition PENDING -> CANCELLED', async () => {
      mockCurrentSession(SessionStatus.PENDING);
      mockUpdatedSession(SessionStatus.CANCELLED);

      const result = await service.update('session-1', { status: SessionStatus.CANCELLED });

      expect(prisma.session.update).toHaveBeenCalled();
      expect(result.id).toBe('session-1');
    });

    it('valid transition ACTIVE -> PAUSED', async () => {
      mockCurrentSession(SessionStatus.ACTIVE);
      mockUpdatedSession(SessionStatus.PAUSED);

      const result = await service.update('session-1', { status: SessionStatus.PAUSED });

      expect(prisma.session.update).toHaveBeenCalled();
      expect(result.id).toBe('session-1');
    });

    it('valid transition ACTIVE -> COMPLETED', async () => {
      mockCurrentSession(SessionStatus.ACTIVE);
      mockUpdatedSession(SessionStatus.COMPLETED);

      const result = await service.update('session-1', { status: SessionStatus.COMPLETED });

      expect(prisma.session.update).toHaveBeenCalled();
      expect(result.id).toBe('session-1');
    });

    it('valid transition PAUSED -> ACTIVE', async () => {
      mockCurrentSession(SessionStatus.PAUSED);
      mockUpdatedSession(SessionStatus.ACTIVE);

      const result = await service.update('session-1', { status: SessionStatus.ACTIVE });

      expect(prisma.session.update).toHaveBeenCalled();
      expect(result.id).toBe('session-1');
    });

    it('throws NotFoundException when prisma.session.update returns P2025', async () => {
      mockCurrentSession(SessionStatus.PENDING);

      const prismaError = new PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      prisma.session.update.mockRejectedValue(prismaError);

      await expect(
        service.update('session-1', { status: SessionStatus.ACTIVE }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
