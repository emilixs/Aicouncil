import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SessionStatus, DriverType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { SessionService } from './session.service';
import { PrismaService } from '../common/prisma.service';
import { SessionResponseDto } from './dto';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePrismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('mock prisma error', {
    code,
    clientVersion: '5.0.0',
  });
}

function makeExpertRecord(id: string, name = 'Expert') {
  return {
    id,
    name,
    specialty: 'Engineering',
    systemPrompt: 'You are an expert.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-4' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
}

function makeSessionExpert(sessionId: string, expertId: string) {
  return {
    sessionId,
    expertId,
    expert: makeExpertRecord(expertId, `Expert ${expertId}`),
  };
}

function makeSessionRecord(overrides: Partial<Record<string, any>> = {}) {
  const id = overrides.id ?? 'session-id-1';
  return {
    id,
    problemStatement: 'What is the best architecture for a microservices system?',
    status: SessionStatus.PENDING,
    maxMessages: 20,
    consensusReached: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    experts: [
      makeSessionExpert(id, 'expert-id-1'),
      makeSessionExpert(id, 'expert-id-2'),
    ],
    _count: { messages: 0 },
    ...overrides,
  };
}

// ─── Mock PrismaService ──────────────────────────────────────────────────────

const mockPrismaService = {
  expert: {
    findMany: jest.fn(),
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
  $transaction: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      problemStatement: 'What is the best architecture for a microservices system?',
      expertIds: ['expert-id-1', 'expert-id-2'],
      maxMessages: 20,
    };

    it('creates a session with experts and returns SessionResponseDto', async () => {
      const sessionRecord = makeSessionRecord();

      // All experts found
      mockPrismaService.expert.findMany.mockResolvedValue([
        { id: 'expert-id-1' },
        { id: 'expert-id-2' },
      ]);

      // Transaction callback receives the tx proxy and calls session.create, sessionExpert.createMany, session.findUnique
      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          session: {
            create: jest.fn().mockResolvedValue({ id: 'session-id-1' }),
            findUnique: jest.fn().mockResolvedValue(sessionRecord),
          },
          sessionExpert: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return callback(txMock);
      });

      const result = await service.create(dto);

      expect(mockPrismaService.expert.findMany).toHaveBeenCalledWith({
        where: { id: { in: dto.expertIds } },
        select: { id: true },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toBeInstanceOf(SessionResponseDto);
      expect(result.id).toBe('session-id-1');
      expect(result.status).toBe(SessionStatus.PENDING);
      expect(result.statusDisplay).toBe('pending');
      expect(result.experts).toHaveLength(2);
    });

    it('throws NotFoundException when an expert ID does not exist', async () => {
      mockPrismaService.expert.findMany.mockResolvedValue([{ id: 'expert-id-1' }]);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException on duplicate expert IDs', async () => {
      const dtoWithDuplicates = {
        ...dto,
        expertIds: ['expert-id-1', 'expert-id-1'],
      };

      // Both IDs resolve (they're the same expert)
      mockPrismaService.expert.findMany.mockResolvedValue([{ id: 'expert-id-1' }]);

      await expect(service.create(dtoWithDuplicates)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when transaction returns null session', async () => {
      mockPrismaService.expert.findMany.mockResolvedValue([
        { id: 'expert-id-1' },
        { id: 'expert-id-2' },
      ]);

      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          session: {
            create: jest.fn().mockResolvedValue({ id: 'session-id-1' }),
            findUnique: jest.fn().mockResolvedValue(null), // null after create
          },
          sessionExpert: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return callback(txMock);
      });

      await expect(service.create(dto)).rejects.toThrow(InternalServerErrorException);
    });

    it('throws InternalServerErrorException on PrismaClientKnownRequestError in transaction', async () => {
      mockPrismaService.expert.findMany.mockResolvedValue([
        { id: 'expert-id-1' },
        { id: 'expert-id-2' },
      ]);

      mockPrismaService.$transaction.mockRejectedValue(makePrismaError('P2002'));

      await expect(service.create(dto)).rejects.toThrow(InternalServerErrorException);
    });

    it('propagates non-Prisma errors thrown inside the transaction', async () => {
      mockPrismaService.expert.findMany.mockResolvedValue([
        { id: 'expert-id-1' },
        { id: 'expert-id-2' },
      ]);

      const specificError = new BadRequestException('some downstream error');
      mockPrismaService.$transaction.mockRejectedValue(specificError);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all sessions ordered by createdAt desc', async () => {
      const sessions = [
        makeSessionRecord({ id: 'session-id-1', createdAt: new Date('2024-02-01') }),
        makeSessionRecord({ id: 'session-id-2', createdAt: new Date('2024-01-01') }),
      ];
      mockPrismaService.session.findMany.mockResolvedValue(sessions);

      const result = await service.findAll();

      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith({
        include: {
          experts: { include: { expert: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(SessionResponseDto);
      expect(result[0].id).toBe('session-id-1');
    });

    it('returns empty array when no sessions exist', async () => {
      mockPrismaService.session.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('includes messageCount from _count.messages', async () => {
      const session = makeSessionRecord({ _count: { messages: 5 } });
      mockPrismaService.session.findMany.mockResolvedValue([session]);

      const [result] = await service.findAll();

      expect(result.messageCount).toBe(5);
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns SessionResponseDto when found', async () => {
      const session = makeSessionRecord();
      mockPrismaService.session.findUnique.mockResolvedValue(session);

      const result = await service.findOne('session-id-1');

      expect(mockPrismaService.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-id-1' },
        include: {
          experts: { include: { expert: true } },
          _count: { select: { messages: true } },
        },
      });
      expect(result).toBeInstanceOf(SessionResponseDto);
      expect(result.id).toBe('session-id-1');
    });

    it('throws NotFoundException when session does not exist', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    describe('valid status transitions', () => {
      const transitions: Array<[SessionStatus, SessionStatus]> = [
        [SessionStatus.PENDING, SessionStatus.ACTIVE],
        [SessionStatus.PENDING, SessionStatus.CANCELLED],
        [SessionStatus.ACTIVE, SessionStatus.COMPLETED],
        [SessionStatus.ACTIVE, SessionStatus.CANCELLED],
      ];

      it.each(transitions)(
        'allows transition from %s to %s',
        async (from, to) => {
          jest.clearAllMocks();
          const current = makeSessionRecord({ status: from });
          const updated = makeSessionRecord({ status: to });

          // findOne (called inside update) uses findUnique
          mockPrismaService.session.findUnique.mockResolvedValue(current);
          mockPrismaService.session.update.mockResolvedValue(updated);

          const result = await service.update('session-id-1', { status: to });

          expect(result).toBeInstanceOf(SessionResponseDto);
          expect(result.status).toBe(to);
        },
      );

      it('allows updating to the same status (no-op transition)', async () => {
        const current = makeSessionRecord({ status: SessionStatus.ACTIVE });
        const updated = makeSessionRecord({ status: SessionStatus.ACTIVE });

        mockPrismaService.session.findUnique.mockResolvedValue(current);
        mockPrismaService.session.update.mockResolvedValue(updated);

        const result = await service.update('session-id-1', {
          status: SessionStatus.ACTIVE,
        });

        expect(result.status).toBe(SessionStatus.ACTIVE);
      });
    });

    describe('invalid status transitions', () => {
      const invalidTransitions: Array<[SessionStatus, SessionStatus]> = [
        [SessionStatus.PENDING, SessionStatus.COMPLETED],
        [SessionStatus.COMPLETED, SessionStatus.ACTIVE],
        [SessionStatus.COMPLETED, SessionStatus.PENDING],
        [SessionStatus.COMPLETED, SessionStatus.CANCELLED],
        [SessionStatus.CANCELLED, SessionStatus.ACTIVE],
        [SessionStatus.CANCELLED, SessionStatus.PENDING],
        [SessionStatus.CANCELLED, SessionStatus.COMPLETED],
      ];

      it.each(invalidTransitions)(
        'rejects invalid transition from %s to %s',
        async (from, to) => {
          jest.clearAllMocks();
          const current = makeSessionRecord({ status: from });
          mockPrismaService.session.findUnique.mockResolvedValue(current);

          await expect(
            service.update('session-id-1', { status: to }),
          ).rejects.toThrow(BadRequestException);

          expect(mockPrismaService.session.update).not.toHaveBeenCalled();
        },
      );
    });

    it('updates consensusReached without status validation', async () => {
      const current = makeSessionRecord({ status: SessionStatus.ACTIVE });
      const updated = makeSessionRecord({
        status: SessionStatus.ACTIVE,
        consensusReached: true,
      });

      mockPrismaService.session.findUnique.mockResolvedValue(current);
      mockPrismaService.session.update.mockResolvedValue(updated);

      const result = await service.update('session-id-1', { consensusReached: true });

      expect(result.consensusReached).toBe(true);
    });

    it('throws NotFoundException when session not found via findOne', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { status: SessionStatus.ACTIVE }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException on P2025 during prisma.session.update', async () => {
      const current = makeSessionRecord({ status: SessionStatus.PENDING });
      mockPrismaService.session.findUnique.mockResolvedValue(current);
      mockPrismaService.session.update.mockRejectedValue(makePrismaError('P2025'));

      await expect(
        service.update('session-id-1', { status: SessionStatus.ACTIVE }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException on other Prisma errors during update', async () => {
      const current = makeSessionRecord({ status: SessionStatus.PENDING });
      mockPrismaService.session.findUnique.mockResolvedValue(current);
      mockPrismaService.session.update.mockRejectedValue(makePrismaError('P2000'));

      await expect(
        service.update('session-id-1', { status: SessionStatus.ACTIVE }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── statusDisplay mapping ───────────────────────────────────────────────────

  describe('statusDisplay mapping', () => {
    it.each([
      [SessionStatus.PENDING, 'pending'],
      [SessionStatus.ACTIVE, 'active'],
      [SessionStatus.COMPLETED, 'concluded'],
      [SessionStatus.CANCELLED, 'cancelled'],
    ])('maps %s to display value "%s"', async (status, expectedDisplay) => {
      jest.clearAllMocks();
      const session = makeSessionRecord({ status });
      mockPrismaService.session.findUnique.mockResolvedValue(session);

      const result = await service.findOne('session-id-1');

      expect(result.statusDisplay).toBe(expectedDisplay);
    });
  });
});
