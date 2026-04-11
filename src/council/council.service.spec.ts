import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
// Note: DISCUSSION_EVENTS.SESSION_RESUMED doesn't exist yet.
// We use the expected string literal 'discussion.session.resumed' in assertions.

/**
 * TDD RED phase: Tests for CouncilService pause/resume/stop control methods.
 *
 * These tests define the expected behavior of three new methods:
 * - pauseDiscussion(sessionId): signals the loop to pause
 * - resumeDiscussion(sessionId): resumes a paused discussion
 * - stopDiscussion(sessionId): signals the loop to stop
 *
 * Expected to FAIL until the methods are implemented.
 * Uses (service as any) to avoid TS compilation errors for non-existent methods.
 */
describe('CouncilService - pause/resume/stop controls', () => {
  let service: CouncilService;
  let sessionService: SessionService;
  let eventEmitter: EventEmitter2;

  const mockActiveSession = {
    id: 'test-session-id',
    problemStatement: 'Test problem',
    status: SessionStatus.ACTIVE,
    statusDisplay: 'active',
    maxMessages: 20,
    consensusReached: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    experts: [],
    messageCount: 0,
  };

  const mockPausedSession = {
    ...mockActiveSession,
    status: 'PAUSED' as SessionStatus,
    statusDisplay: 'paused',
  };

  const mockPendingSession = {
    ...mockActiveSession,
    status: SessionStatus.PENDING,
    statusDisplay: 'pending',
  };

  const mockCompletedSession = {
    ...mockActiveSession,
    status: SessionStatus.COMPLETED,
    statusDisplay: 'concluded',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouncilService,
        {
          provide: SessionService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: MessageService,
          useValue: {
            create: jest.fn(),
            countBySession: jest.fn(),
            findLatestBySession: jest.fn(),
          },
        },
        {
          provide: DriverFactory,
          useValue: {
            createDriver: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CouncilService>(CouncilService);
    sessionService = module.get<SessionService>(SessionService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('pauseDiscussion', () => {
    it('should exist as a method on CouncilService', () => {
      expect(typeof (service as any).pauseDiscussion).toBe('function');
    });

    it('should throw BadRequestException when session is not ACTIVE', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockPendingSession);

      await expect((service as any).pauseDiscussion('test-session-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when session is COMPLETED', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockCompletedSession);

      await expect((service as any).pauseDiscussion('test-session-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when session is already PAUSED', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockPausedSession);

      await expect((service as any).pauseDiscussion('test-session-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not throw when session is ACTIVE', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockActiveSession);

      await expect((service as any).pauseDiscussion('test-session-id')).resolves.not.toThrow();
    });
  });

  describe('stopDiscussion', () => {
    it('should exist as a method on CouncilService', () => {
      expect(typeof (service as any).stopDiscussion).toBe('function');
    });

    it('should throw BadRequestException when session is PENDING', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockPendingSession);

      await expect((service as any).stopDiscussion('test-session-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when session is COMPLETED', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockCompletedSession);

      await expect((service as any).stopDiscussion('test-session-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not throw when session is ACTIVE', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockActiveSession);

      await expect((service as any).stopDiscussion('test-session-id')).resolves.not.toThrow();
    });

    it('should not throw when session is PAUSED', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockPausedSession);

      await expect((service as any).stopDiscussion('test-session-id')).resolves.not.toThrow();
    });
  });

  describe('resumeDiscussion', () => {
    it('should exist as a method on CouncilService', () => {
      expect(typeof (service as any).resumeDiscussion).toBe('function');
    });

    it('should throw BadRequestException when session is not PAUSED', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockActiveSession);

      await expect((service as any).resumeDiscussion('test-session-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when session is PENDING', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockPendingSession);

      await expect((service as any).resumeDiscussion('test-session-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when session is COMPLETED', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockCompletedSession);

      await expect((service as any).resumeDiscussion('test-session-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should transition DB status to ACTIVE when session is PAUSED', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockPausedSession);
      (sessionService.update as jest.Mock).mockResolvedValue({
        ...mockPausedSession,
        status: SessionStatus.ACTIVE,
      });

      await (service as any).resumeDiscussion('test-session-id');

      expect(sessionService.update).toHaveBeenCalledWith('test-session-id', {
        status: SessionStatus.ACTIVE,
      });
    });

    it('should emit SESSION_RESUMED event when resuming', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue(mockPausedSession);
      (sessionService.update as jest.Mock).mockResolvedValue({
        ...mockPausedSession,
        status: SessionStatus.ACTIVE,
      });

      await (service as any).resumeDiscussion('test-session-id');

      // SESSION_RESUMED event constant doesn't exist yet — use expected string
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discussion.session.resumed',
        expect.objectContaining({ sessionId: 'test-session-id' }),
      );
    });
  });

  describe('startDiscussion returns immediately (async)', () => {
    it('should return 202-style response without blocking on discussion loop', async () => {
      const mockDriver = { chat: jest.fn().mockResolvedValue({ content: 'test response' }) };

      (sessionService.findOne as jest.Mock).mockResolvedValue({
        ...mockPendingSession,
        experts: [
          {
            id: 'expert-1',
            name: 'Expert 1',
            specialty: 'Testing',
            systemPrompt: 'You are a test expert',
            driverType: 'OPENAI',
            config: { model: 'gpt-4' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      (sessionService.update as jest.Mock).mockResolvedValue({
        ...mockActiveSession,
        experts: [],
        _count: { messages: 0 },
      });

      // The key assertion: startDiscussion should return quickly
      // with the session in ACTIVE status, not block until completion.
      const startTime = Date.now();
      const result = await service.startDiscussion('test-session-id');
      const elapsed = Date.now() - startTime;

      // Should return within 1 second (not wait for full discussion)
      expect(elapsed).toBeLessThan(1000);
      expect(result).toBeDefined();
    });
  });
});
