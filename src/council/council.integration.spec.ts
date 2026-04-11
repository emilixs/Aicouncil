import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { PrismaService } from '../common/prisma.service';
import { SessionResponseDto } from '../session/dto';
import { DISCUSSION_EVENTS } from './events/discussion.events';

// Cast to access properties that will be added by the Plan Executor
const EVENTS = DISCUSSION_EVENTS as Record<string, string>;

/**
 * RED phase integration tests for the pause/resume/stop discussion flow.
 *
 * These tests validate the full lifecycle:
 *   start → RUNNING, pause → PAUSED (no more messages),
 *   resume → RUNNING (messages resume), stop → STOPPED
 *
 * They will FAIL because:
 * 1. pauseDiscussion/stopDiscussion/resumeDiscussion methods don't exist
 * 2. DiscussionStatus field doesn't exist on sessions
 * 3. The discussion loop doesn't check for PAUSING/STOPPING signals
 * 4. startDiscussion is synchronous (blocks until done), not fire-and-forget
 * 5. DISCUSSION_EVENTS.PAUSED/STOPPED/RESUMED don't exist
 */

// Mock LLM driver that returns controlled responses
const mockLLMDriver = {
  chat: jest.fn().mockResolvedValue({ content: 'I think we should consider...' }),
};

// Helper to create a session with experts
function createMockSessionWithExperts(
  overrides: Record<string, any> = {},
): SessionResponseDto {
  return new SessionResponseDto({
    id: 'integration-session-1',
    problemStatement: 'How should we architect the system?',
    status: SessionStatus.PENDING,
    statusDisplay: 'pending',
    maxMessages: 20,
    consensusReached: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    experts: [
      {
        id: 'expert-1',
        name: 'Backend Expert',
        specialty: 'Backend Architecture',
        systemPrompt: 'You are a backend expert.',
        driverType: 'OPENAI',
        config: { model: 'gpt-4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      {
        id: 'expert-2',
        name: 'Frontend Expert',
        specialty: 'Frontend Architecture',
        systemPrompt: 'You are a frontend expert.',
        driverType: 'OPENAI',
        config: { model: 'gpt-4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ],
    messageCount: 0,
    ...overrides,
  });
}

describe('CouncilService - Pause/Resume/Stop Integration Flow', () => {
  let councilService: CouncilService;
  let sessionService: jest.Mocked<SessionService>;
  let messageService: jest.Mocked<MessageService>;
  let driverFactory: jest.Mocked<DriverFactory>;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockSessionService = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    };

    const mockMessageService = {
      create: jest.fn().mockResolvedValue({
        id: 'msg-1',
        content: 'Test message',
        role: 'ASSISTANT',
        sessionId: 'integration-session-1',
        expertId: 'expert-1',
        timestamp: new Date(),
      }),
      findLatestBySession: jest.fn().mockResolvedValue([]),
      countBySession: jest.fn().mockResolvedValue(0),
    };

    const mockDriverFactory = {
      createDriver: jest.fn().mockReturnValue(mockLLMDriver),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouncilService,
        { provide: SessionService, useValue: mockSessionService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: DriverFactory, useValue: mockDriverFactory },
        EventEmitter2,
      ],
    }).compile();

    councilService = module.get<CouncilService>(CouncilService);
    sessionService = module.get(SessionService) as jest.Mocked<SessionService>;
    messageService = module.get(MessageService) as jest.Mocked<MessageService>;
    driverFactory = module.get(DriverFactory) as jest.Mocked<DriverFactory>;
    eventEmitter = module.get(EventEmitter2);
  });

  describe('Full pause/resume/stop lifecycle', () => {
    it('should set discussionStatus to RUNNING after startDiscussion', async () => {
      // Arrange
      const session = createMockSessionWithExperts();
      sessionService.findOne.mockResolvedValue(session);

      // Make update return quickly, and countBySession trigger max-messages to exit loop
      sessionService.update.mockImplementation(async (id, dto) => {
        return createMockSessionWithExperts({
          status: dto.status ?? session.status,
          discussionStatus: (dto as any).discussionStatus ?? 'IDLE',
        });
      });
      // Return maxMessages so the loop exits immediately
      messageService.countBySession.mockResolvedValue(session.maxMessages);

      // Act: start the discussion
      const result = await councilService.startDiscussion('integration-session-1');

      // Assert: discussionStatus should be set to RUNNING
      // This will fail because startDiscussion doesn't set discussionStatus yet
      expect(sessionService.update).toHaveBeenCalledWith(
        'integration-session-1',
        expect.objectContaining({ discussionStatus: 'RUNNING' }),
      );
    });

    it('should stop producing messages after pause', async () => {
      // Arrange: ACTIVE session with RUNNING discussion
      const activeSession = createMockSessionWithExperts({
        status: SessionStatus.ACTIVE,
        statusDisplay: 'active',
      });
      (activeSession as any).discussionStatus = 'RUNNING';
      sessionService.findOne.mockResolvedValue(activeSession);

      let messageCreateCount = 0;
      messageService.create.mockImplementation(async () => {
        messageCreateCount++;
        return {
          id: `msg-${messageCreateCount}`,
          content: 'Test message',
          role: 'ASSISTANT',
          sessionId: 'integration-session-1',
          expertId: 'expert-1',
          timestamp: new Date(),
        } as any;
      });

      // Act: pause the discussion
      await (councilService as any).pauseDiscussion('integration-session-1');

      // Record message count at pause time
      const messagesAtPause = messageCreateCount;

      // Wait briefly to ensure no more messages are produced
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert: no new messages should be created after pause
      expect(messageService.create).toHaveBeenCalledTimes(messagesAtPause);

      // Assert: PAUSED event key must exist on DISCUSSION_EVENTS
      expect(EVENTS.PAUSED).toBeDefined();
    });

    it('should resume message production after resumeDiscussion', async () => {
      // Arrange: PAUSED session
      const pausedSession = createMockSessionWithExperts({
        status: SessionStatus.ACTIVE,
        statusDisplay: 'active',
      });
      (pausedSession as any).discussionStatus = 'PAUSED';
      (pausedSession as any).currentRound = 1;
      (pausedSession as any).currentTurnIndex = 2;
      sessionService.findOne.mockResolvedValue(pausedSession);

      const resumedSession = createMockSessionWithExperts({
        status: SessionStatus.ACTIVE,
        statusDisplay: 'active',
      });
      (resumedSession as any).discussionStatus = 'RUNNING';
      sessionService.update.mockResolvedValue(resumedSession);

      // Act: resume the discussion
      await (councilService as any).resumeDiscussion('integration-session-1');

      // Assert: discussionStatus should transition to RUNNING
      expect(sessionService.update).toHaveBeenCalledWith(
        'integration-session-1',
        expect.objectContaining({ discussionStatus: 'RUNNING' }),
      );

      // Assert: RESUMED event key must exist on DISCUSSION_EVENTS
      expect(EVENTS.RESUMED).toBeDefined();
    });

    it('should transition to STOPPED after stopDiscussion', async () => {
      // Arrange: RUNNING session
      const activeSession = createMockSessionWithExperts({
        status: SessionStatus.ACTIVE,
        statusDisplay: 'active',
      });
      (activeSession as any).discussionStatus = 'RUNNING';
      sessionService.findOne.mockResolvedValue(activeSession);

      const stoppedSession = createMockSessionWithExperts({
        status: SessionStatus.CANCELLED,
        statusDisplay: 'cancelled',
      });
      (stoppedSession as any).discussionStatus = 'STOPPED';
      sessionService.update.mockResolvedValue(stoppedSession);

      // Act: stop the discussion
      await (councilService as any).stopDiscussion('integration-session-1');

      // Assert: session should be in STOPPED state
      expect(sessionService.update).toHaveBeenCalledWith(
        'integration-session-1',
        expect.objectContaining({ discussionStatus: expect.stringMatching(/STOPPING|STOPPED/) }),
      );

      // Assert: STOPPED event key must exist on DISCUSSION_EVENTS
      expect(EVENTS.STOPPED).toBeDefined();
    });

    it('should resume from checkpoint after pause+resume', async () => {
      // Arrange: session was paused at round 2, turn 1
      const pausedSession = createMockSessionWithExperts({
        status: SessionStatus.ACTIVE,
        statusDisplay: 'active',
      });
      (pausedSession as any).discussionStatus = 'PAUSED';
      (pausedSession as any).currentRound = 2;
      (pausedSession as any).currentTurnIndex = 1;
      sessionService.findOne.mockResolvedValue(pausedSession);

      sessionService.update.mockImplementation(async (id, dto) => {
        return createMockSessionWithExperts({
          status: dto.status ?? SessionStatus.ACTIVE,
          discussionStatus: (dto as any).discussionStatus ?? 'RUNNING',
          currentRound: 2,
          currentTurnIndex: 1,
        });
      });

      // Act: resume from checkpoint
      await (councilService as any).resumeDiscussion('integration-session-1');

      // Assert: the discussion loop should restart from the checkpointed position
      // This is verified by the getProgress method (which also doesn't exist yet)
      const progress = await (councilService as any).getProgress('integration-session-1');
      expect(progress).toBeDefined();
      expect(progress.currentRound).toBe(2);
      expect(progress.currentTurnIndex).toBeGreaterThanOrEqual(1);
    });
  });
});
