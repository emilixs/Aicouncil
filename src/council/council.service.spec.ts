import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { SessionResponseDto } from '../session/dto';
import { DISCUSSION_EVENTS } from './events/discussion.events';

// Cast to access properties that will be added by the Plan Executor
const EVENTS = DISCUSSION_EVENTS as Record<string, string>;

/**
 * RED phase tests for CouncilService control methods.
 *
 * These tests define the expected interface for pause/stop/resume methods
 * that don't exist yet. They will FAIL because:
 * 1. CouncilService.pauseDiscussion() doesn't exist
 * 2. CouncilService.stopDiscussion() doesn't exist
 * 3. CouncilService.resumeDiscussion() doesn't exist
 * 4. The DiscussionStatus field doesn't exist on sessions
 */

// Helper to create a mock session response
function mockSessionResponse(overrides: Partial<SessionResponseDto> = {}): SessionResponseDto {
  return new SessionResponseDto({
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
    ...overrides,
  });
}

describe('CouncilService - Async Discussion Control Methods', () => {
  let councilService: CouncilService;
  let sessionService: jest.Mocked<SessionService>;
  let messageService: jest.Mocked<MessageService>;
  let driverFactory: jest.Mocked<DriverFactory>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockSessionService = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    };

    const mockMessageService = {
      create: jest.fn(),
      findLatestBySession: jest.fn(),
      countBySession: jest.fn(),
    };

    const mockDriverFactory = {
      createDriver: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouncilService,
        { provide: SessionService, useValue: mockSessionService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: DriverFactory, useValue: mockDriverFactory },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    councilService = module.get<CouncilService>(CouncilService);
    sessionService = module.get(SessionService) as jest.Mocked<SessionService>;
    messageService = module.get(MessageService) as jest.Mocked<MessageService>;
    driverFactory = module.get(DriverFactory) as jest.Mocked<DriverFactory>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  describe('pauseDiscussion', () => {
    it('should throw when session discussionStatus is not RUNNING', async () => {
      // Arrange: session that is IDLE (not running)
      const session = mockSessionResponse({
        id: 'session-1',
        status: SessionStatus.PENDING,
      });
      // Simulate discussionStatus being IDLE
      (session as any).discussionStatus = 'IDLE';
      sessionService.findOne.mockResolvedValue(session);

      // Act & Assert: pauseDiscussion should reject non-RUNNING sessions
      await expect(
        (councilService as any).pauseDiscussion('session-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transition discussionStatus to PAUSING when RUNNING', async () => {
      // Arrange: session with discussionStatus RUNNING
      const session = mockSessionResponse({
        id: 'session-2',
        status: SessionStatus.ACTIVE,
      });
      (session as any).discussionStatus = 'RUNNING';
      sessionService.findOne.mockResolvedValue(session);

      const updatedSession = mockSessionResponse({
        id: 'session-2',
        status: SessionStatus.ACTIVE,
      });
      (updatedSession as any).discussionStatus = 'PAUSING';
      sessionService.update.mockResolvedValue(updatedSession);

      // Act
      await (councilService as any).pauseDiscussion('session-2');

      // Assert: should update session discussionStatus to PAUSING
      expect(sessionService.update).toHaveBeenCalledWith(
        'session-2',
        expect.objectContaining({ discussionStatus: 'PAUSING' }),
      );
    });

    it('should throw when session discussionStatus is PAUSED (already paused)', async () => {
      const session = mockSessionResponse({
        id: 'session-3',
        status: SessionStatus.ACTIVE,
      });
      (session as any).discussionStatus = 'PAUSED';
      sessionService.findOne.mockResolvedValue(session);

      await expect(
        (councilService as any).pauseDiscussion('session-3'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('stopDiscussion', () => {
    it('should throw when session discussionStatus is not RUNNING or PAUSED', async () => {
      // Arrange: session that is IDLE
      const session = mockSessionResponse({
        id: 'session-4',
        status: SessionStatus.PENDING,
      });
      (session as any).discussionStatus = 'IDLE';
      sessionService.findOne.mockResolvedValue(session);

      // Act & Assert: stopDiscussion should reject non-RUNNING/PAUSED sessions
      await expect(
        (councilService as any).stopDiscussion('session-4'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transition to STOPPING when discussionStatus is RUNNING', async () => {
      const session = mockSessionResponse({
        id: 'session-5',
        status: SessionStatus.ACTIVE,
      });
      (session as any).discussionStatus = 'RUNNING';
      sessionService.findOne.mockResolvedValue(session);

      const updatedSession = mockSessionResponse({
        id: 'session-5',
        status: SessionStatus.ACTIVE,
      });
      (updatedSession as any).discussionStatus = 'STOPPING';
      sessionService.update.mockResolvedValue(updatedSession);

      // Act
      await (councilService as any).stopDiscussion('session-5');

      // Assert
      expect(sessionService.update).toHaveBeenCalledWith(
        'session-5',
        expect.objectContaining({ discussionStatus: 'STOPPING' }),
      );
    });

    it('should transition to STOPPED when discussionStatus is PAUSED', async () => {
      // When paused, the loop is already exited, so we go directly to STOPPED
      const session = mockSessionResponse({
        id: 'session-6',
        status: SessionStatus.ACTIVE,
      });
      (session as any).discussionStatus = 'PAUSED';
      sessionService.findOne.mockResolvedValue(session);

      const updatedSession = mockSessionResponse({
        id: 'session-6',
        status: SessionStatus.CANCELLED,
      });
      (updatedSession as any).discussionStatus = 'STOPPED';
      sessionService.update.mockResolvedValue(updatedSession);

      // Act
      await (councilService as any).stopDiscussion('session-6');

      // Assert: when paused, stop should go directly to STOPPED (no loop to signal)
      expect(sessionService.update).toHaveBeenCalledWith(
        'session-6',
        expect.objectContaining({ discussionStatus: 'STOPPED' }),
      );
    });

    it('should throw when session discussionStatus is COMPLETED', async () => {
      const session = mockSessionResponse({
        id: 'session-7',
        status: SessionStatus.COMPLETED,
      });
      (session as any).discussionStatus = 'COMPLETED';
      sessionService.findOne.mockResolvedValue(session);

      await expect(
        (councilService as any).stopDiscussion('session-7'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resumeDiscussion', () => {
    it('should throw when session discussionStatus is not PAUSED', async () => {
      // Arrange: session with discussionStatus RUNNING
      const session = mockSessionResponse({
        id: 'session-8',
        status: SessionStatus.ACTIVE,
      });
      (session as any).discussionStatus = 'RUNNING';
      sessionService.findOne.mockResolvedValue(session);

      // Act & Assert
      await expect(
        (councilService as any).resumeDiscussion('session-8'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transition DB to RUNNING and emit RESUMED event when PAUSED', async () => {
      // Arrange: paused session
      const session = mockSessionResponse({
        id: 'session-9',
        status: SessionStatus.ACTIVE,
      });
      (session as any).discussionStatus = 'PAUSED';
      sessionService.findOne.mockResolvedValue(session);

      const updatedSession = mockSessionResponse({
        id: 'session-9',
        status: SessionStatus.ACTIVE,
      });
      (updatedSession as any).discussionStatus = 'RUNNING';
      sessionService.update.mockResolvedValue(updatedSession);

      // Act
      await (councilService as any).resumeDiscussion('session-9');

      // Assert: should update status to RUNNING
      expect(sessionService.update).toHaveBeenCalledWith(
        'session-9',
        expect.objectContaining({ discussionStatus: 'RUNNING' }),
      );

      // Assert: RESUMED event key must exist
      expect(EVENTS.RESUMED).toBeDefined();

      // Assert: should emit RESUMED event
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EVENTS.RESUMED,
        expect.objectContaining({ sessionId: 'session-9' }),
      );
    });

    it('should throw when session discussionStatus is IDLE', async () => {
      const session = mockSessionResponse({
        id: 'session-10',
        status: SessionStatus.PENDING,
      });
      (session as any).discussionStatus = 'IDLE';
      sessionService.findOne.mockResolvedValue(session);

      await expect(
        (councilService as any).resumeDiscussion('session-10'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when session discussionStatus is STOPPED', async () => {
      const session = mockSessionResponse({
        id: 'session-11',
        status: SessionStatus.CANCELLED,
      });
      (session as any).discussionStatus = 'STOPPED';
      sessionService.findOne.mockResolvedValue(session);

      await expect(
        (councilService as any).resumeDiscussion('session-11'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
