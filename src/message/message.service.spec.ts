import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SessionStatus, MessageRole, DriverType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { MessageService } from './message.service';
import { PrismaService } from '../common/prisma.service';
import { MessageResponseDto } from './dto';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePrismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('mock prisma error', {
    code,
    clientVersion: '5.0.0',
  });
}

function makeExpertRecord(id = 'expert-id-1') {
  return {
    id,
    name: 'Alice',
    specialty: 'Software Architecture',
    systemPrompt: 'You are an expert.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-4' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
}

function makeSessionRecord(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'session-id-1',
    problemStatement: 'What is the best approach?',
    status: SessionStatus.ACTIVE,
    maxMessages: 20,
    consensusReached: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeMessageRecord(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'message-id-1',
    sessionId: 'session-id-1',
    expertId: 'expert-id-1',
    content: 'Hello, I have some thoughts on this.',
    role: MessageRole.ASSISTANT,
    isIntervention: false,
    timestamp: new Date('2024-01-01T10:00:00Z'),
    expert: makeExpertRecord(),
    ...overrides,
  };
}

// ─── Mock PrismaService ──────────────────────────────────────────────────────

const mockPrismaService = {
  session: {
    findUnique: jest.fn(),
  },
  sessionExpert: {
    findUnique: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MessageService', () => {
  let service: MessageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      sessionId: 'session-id-1',
      expertId: 'expert-id-1',
      content: 'My expert opinion on this matter.',
      role: MessageRole.ASSISTANT,
    };

    it('creates a message and returns MessageResponseDto', async () => {
      const session = makeSessionRecord({ maxMessages: 20 });
      const messageRecord = makeMessageRecord();

      mockPrismaService.session.findUnique.mockResolvedValue(session);
      mockPrismaService.sessionExpert.findUnique.mockResolvedValue({
        sessionId: 'session-id-1',
        expertId: 'expert-id-1',
      });

      // Transaction: count returns 5 (under limit), then creates message
      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          message: {
            count: jest.fn().mockResolvedValue(5),
            create: jest.fn().mockResolvedValue(messageRecord),
          },
        };
        return callback(txMock);
      });

      const result = await service.create(dto);

      expect(mockPrismaService.session.findUnique).toHaveBeenCalledWith({
        where: { id: dto.sessionId },
      });
      expect(mockPrismaService.sessionExpert.findUnique).toHaveBeenCalledWith({
        where: {
          sessionId_expertId: {
            sessionId: dto.sessionId,
            expertId: dto.expertId,
          },
        },
      });
      expect(result).toBeInstanceOf(MessageResponseDto);
      expect(result.id).toBe('message-id-1');
      expect(result.expertName).toBe('Alice');
      expect(result.expertSpecialty).toBe('Software Architecture');
    });

    it('creates a message without expertId (user intervention)', async () => {
      const dtoNoExpert = {
        sessionId: 'session-id-1',
        content: 'User intervention message.',
        role: MessageRole.USER,
      };

      const session = makeSessionRecord({ maxMessages: 20 });
      const messageRecord = makeMessageRecord({
        expertId: null,
        expert: null,
        role: MessageRole.USER,
        content: dtoNoExpert.content,
      });

      mockPrismaService.session.findUnique.mockResolvedValue(session);

      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          message: {
            count: jest.fn().mockResolvedValue(3),
            create: jest.fn().mockResolvedValue(messageRecord),
          },
        };
        return callback(txMock);
      });

      const result = await service.create(dtoNoExpert);

      // sessionExpert lookup should NOT be called when expertId is absent
      expect(mockPrismaService.sessionExpert.findUnique).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(MessageResponseDto);
      expect(result.expertName).toBeNull();
      expect(result.expertSpecialty).toBeNull();
    });

    it('throws NotFoundException when session does not exist', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when session is not ACTIVE (PENDING)', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(
        makeSessionRecord({ status: SessionStatus.PENDING }),
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when session is not ACTIVE (COMPLETED)', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(
        makeSessionRecord({ status: SessionStatus.COMPLETED }),
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when session is not ACTIVE (CANCELLED)', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(
        makeSessionRecord({ status: SessionStatus.CANCELLED }),
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when expert is not part of the session', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(makeSessionRecord());
      mockPrismaService.sessionExpert.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when message count limit is reached (inside transaction)', async () => {
      const session = makeSessionRecord({ maxMessages: 5 });
      mockPrismaService.session.findUnique.mockResolvedValue(session);
      mockPrismaService.sessionExpert.findUnique.mockResolvedValue({
        sessionId: 'session-id-1',
        expertId: 'expert-id-1',
      });

      // Transaction callback: count returns 5 (>= maxMessages 5)
      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          message: {
            count: jest.fn().mockResolvedValue(5),
            create: jest.fn(),
          },
        };
        return callback(txMock);
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException on PrismaClientKnownRequestError', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(makeSessionRecord());
      mockPrismaService.sessionExpert.findUnique.mockResolvedValue({
        sessionId: 'session-id-1',
        expertId: 'expert-id-1',
      });
      mockPrismaService.$transaction.mockRejectedValue(makePrismaError('P2002'));

      await expect(service.create(dto)).rejects.toThrow(InternalServerErrorException);
    });

    it('throws InternalServerErrorException on unexpected errors', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(makeSessionRecord());
      mockPrismaService.sessionExpert.findUnique.mockResolvedValue({
        sessionId: 'session-id-1',
        expertId: 'expert-id-1',
      });
      mockPrismaService.$transaction.mockRejectedValue(new Error('connection reset'));

      await expect(service.create(dto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── findBySession ────────────────────────────────────────────────────────────

  describe('findBySession', () => {
    it('returns messages ordered by timestamp asc', async () => {
      const messages = [
        makeMessageRecord({ id: 'msg-1', timestamp: new Date('2024-01-01T10:00:00Z') }),
        makeMessageRecord({ id: 'msg-2', timestamp: new Date('2024-01-01T10:05:00Z') }),
      ];
      mockPrismaService.message.findMany.mockResolvedValue(messages);

      const result = await service.findBySession('session-id-1');

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-id-1' },
        include: { expert: true },
        orderBy: { timestamp: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(MessageResponseDto);
      expect(result[0].id).toBe('msg-1');
    });

    it('returns empty array when no messages in session', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([]);

      const result = await service.findBySession('session-id-1');

      expect(result).toEqual([]);
    });

    it('throws InternalServerErrorException on database errors', async () => {
      mockPrismaService.message.findMany.mockRejectedValue(new Error('db error'));

      await expect(service.findBySession('session-id-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('includes expertName and expertSpecialty from joined expert', async () => {
      const message = makeMessageRecord({
        expert: makeExpertRecord('expert-id-1'),
      });
      mockPrismaService.message.findMany.mockResolvedValue([message]);

      const [result] = await service.findBySession('session-id-1');

      expect(result.expertName).toBe('Alice');
      expect(result.expertSpecialty).toBe('Software Architecture');
    });
  });

  // ── countBySession ───────────────────────────────────────────────────────────

  describe('countBySession', () => {
    it('returns the count of messages in a session', async () => {
      mockPrismaService.message.count.mockResolvedValue(7);

      const result = await service.countBySession('session-id-1');

      expect(mockPrismaService.message.count).toHaveBeenCalledWith({
        where: { sessionId: 'session-id-1' },
      });
      expect(result).toBe(7);
    });

    it('returns 0 when session has no messages', async () => {
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.countBySession('session-id-1');

      expect(result).toBe(0);
    });

    it('throws InternalServerErrorException on database errors', async () => {
      mockPrismaService.message.count.mockRejectedValue(new Error('db error'));

      await expect(service.countBySession('session-id-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── findLatestBySession ──────────────────────────────────────────────────────

  describe('findLatestBySession', () => {
    it('returns messages in chronological order (reversed from desc query)', async () => {
      // DB returns newest-first (desc), service reverses to oldest-first
      const messagesFromDb = [
        makeMessageRecord({ id: 'msg-3', timestamp: new Date('2024-01-01T10:10:00Z') }),
        makeMessageRecord({ id: 'msg-2', timestamp: new Date('2024-01-01T10:05:00Z') }),
        makeMessageRecord({ id: 'msg-1', timestamp: new Date('2024-01-01T10:00:00Z') }),
      ];
      mockPrismaService.message.findMany.mockResolvedValue(messagesFromDb);

      const result = await service.findLatestBySession('session-id-1', 3);

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-id-1' },
        include: { expert: true },
        orderBy: { timestamp: 'desc' },
        take: 3,
      });
      // After reverse: oldest first
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
      expect(result[2].id).toBe('msg-3');
    });

    it('uses default limit of 10 when no limit is provided', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([]);

      await service.findLatestBySession('session-id-1');

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('returns empty array when session has no messages', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([]);

      const result = await service.findLatestBySession('session-id-1', 5);

      expect(result).toEqual([]);
    });

    it('throws InternalServerErrorException on database errors', async () => {
      mockPrismaService.message.findMany.mockRejectedValue(new Error('db error'));

      await expect(service.findLatestBySession('session-id-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('returns instances of MessageResponseDto', async () => {
      const messages = [makeMessageRecord()];
      mockPrismaService.message.findMany.mockResolvedValue(messages);

      const result = await service.findLatestBySession('session-id-1', 1);

      expect(result[0]).toBeInstanceOf(MessageResponseDto);
    });
  });

  // ── deleteBySession ──────────────────────────────────────────────────────────

  describe('deleteBySession', () => {
    it('deletes all messages in a session and returns void', async () => {
      mockPrismaService.message.deleteMany.mockResolvedValue({ count: 3 });

      await expect(service.deleteBySession('session-id-1')).resolves.toBeUndefined();

      expect(mockPrismaService.message.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-id-1' },
      });
    });

    it('succeeds without error when session has no messages', async () => {
      mockPrismaService.message.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteBySession('session-id-1')).resolves.toBeUndefined();
    });

    it('throws InternalServerErrorException on database errors', async () => {
      mockPrismaService.message.deleteMany.mockRejectedValue(new Error('db error'));

      await expect(service.deleteBySession('session-id-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
