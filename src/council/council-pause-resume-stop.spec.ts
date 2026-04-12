import { Test, TestingModule } from '@nestjs/testing';
import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionStatus, MessageRole, DriverType } from '@prisma/client';
import { DISCUSSION_EVENTS } from './events/discussion.events';

describe('CouncilService - Pause/Resume/Stop', () => {
  let councilService: CouncilService;
  let messageService: jest.Mocked<MessageService>;
  let sessionService: jest.Mocked<SessionService>;
  let driverFactory: jest.Mocked<DriverFactory>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const sessionId = 'test-session-id';

  const mockSession = {
    id: sessionId,
    problemStatement: 'Test problem',
    status: SessionStatus.PENDING,
    maxMessages: 20,
    consensusReached: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    experts: [
      {
        id: 'se-1',
        sessionId,
        expertId: 'expert-1',
        joinedAt: new Date(),
        expert: {
          id: 'expert-1',
          name: 'Expert One',
          specialty: 'Testing',
          systemPrompt: 'You are expert one',
          driverType: DriverType.ANTHROPIC,
          config: { model: 'claude-3-sonnet-20240229', temperature: 0.7 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
  };

  beforeEach(async () => {
    const mockDriver = {
      chat: jest.fn(),
      streamChat: jest.fn(),
    };

    driverFactory = {
      createDriver: jest.fn().mockReturnValue(mockDriver),
    } as any;

    sessionService = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as any;

    messageService = {
      create: jest.fn(),
      findBySession: jest.fn().mockResolvedValue([]),
      countBySession: jest.fn().mockResolvedValue(0),
      findLatestBySession: jest.fn().mockResolvedValue([]),
    } as any;

    eventEmitter = {
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouncilService,
        { provide: SessionService, useValue: sessionService },
        { provide: MessageService, useValue: messageService },
        { provide: DriverFactory, useValue: driverFactory },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    councilService = module.get<CouncilService>(CouncilService);
  });

  describe('pauseDiscussion', () => {
    it('should set session status to PAUSED and emit SESSION_PAUSED event', async () => {
      // Start a discussion to set the control flag to 'running'
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);

      // First call returns a response, then pause before second call
      let pauseTriggered = false;
      (mockDriver.chat as jest.Mock).mockImplementation(async () => {
        if (!pauseTriggered) {
          pauseTriggered = true;
          // Pause after the first expert turn
          setTimeout(() => {
            councilService.pauseDiscussion(sessionId).then(() => {
              // Then stop to end the test
              councilService.stopDiscussion(sessionId);
            });
          }, 50);
          return { content: 'Expert response', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
        }
        // This should not be reached because we pause+stop
        return { content: 'Should not reach', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
      });

      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'Expert response',
        role: MessageRole.ASSISTANT,
        expertId: 'expert-1',
        isIntervention: false,
        timestamp: new Date(),
      } as any);

      await councilService.startDiscussion(sessionId);

      // Verify SESSION_PAUSED was emitted
      const pausedEmit = eventEmitter.emit.mock.calls.find(
        (call) => call[0] === DISCUSSION_EVENTS.SESSION_PAUSED,
      );
      expect(pausedEmit).toBeDefined();
      expect(pausedEmit![1]).toEqual({ sessionId });

      // Verify session was updated to PAUSED
      const pauseUpdate = sessionService.update.mock.calls.find(
        (call) => call[1]?.status === SessionStatus.PAUSED,
      );
      expect(pauseUpdate).toBeDefined();
    });

    it('should not pause if session is not running', async () => {
      // No discussion started, so no control flag exists
      await councilService.pauseDiscussion(sessionId);

      // Should not emit or update
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DISCUSSION_EVENTS.SESSION_PAUSED,
        expect.anything(),
      );
      expect(sessionService.update).not.toHaveBeenCalled();
    });
  });

  describe('resumeDiscussion', () => {
    it('should not resume if session is not paused', async () => {
      await councilService.resumeDiscussion(sessionId);

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DISCUSSION_EVENTS.SESSION_RESUMED,
        expect.anything(),
      );
      expect(sessionService.update).not.toHaveBeenCalled();
    });
  });

  describe('stopDiscussion', () => {
    it('should emit DISCUSSION_STOPPED immediately when stopped', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);

      // Make the chat call slow so we can stop during it
      let stopTriggered = false;
      (mockDriver.chat as jest.Mock).mockImplementation(async () => {
        if (!stopTriggered) {
          stopTriggered = true;
          // Stop after the first expert turn completes
          setTimeout(() => councilService.stopDiscussion(sessionId), 50);
          return { content: 'Expert response', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
        }
        return { content: 'Unreachable', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
      });

      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'Expert response',
        role: MessageRole.ASSISTANT,
        expertId: 'expert-1',
        isIntervention: false,
        timestamp: new Date(),
      } as any);

      await councilService.startDiscussion(sessionId);

      // Verify DISCUSSION_STOPPED was emitted
      const stoppedEmit = eventEmitter.emit.mock.calls.find(
        (call) => call[0] === DISCUSSION_EVENTS.DISCUSSION_STOPPED,
      );
      expect(stoppedEmit).toBeDefined();
      expect(stoppedEmit![1]).toEqual({ sessionId });

      // Session should end as CANCELLED
      const cancelUpdate = sessionService.update.mock.calls.find(
        (call) => call[1]?.status === SessionStatus.CANCELLED,
      );
      expect(cancelUpdate).toBeDefined();
    });

    it('should not stop if session has no active flag', async () => {
      await councilService.stopDiscussion(sessionId);

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DISCUSSION_EVENTS.DISCUSSION_STOPPED,
        expect.anything(),
      );
    });
  });

  describe('queueIntervention with PAUSED status', () => {
    it('should allow queueing interventions when session is PAUSED', async () => {
      const pausedSession = { ...mockSession, status: SessionStatus.PAUSED };
      sessionService.findOne.mockResolvedValue(pausedSession as any);

      const result = await councilService.queueIntervention(sessionId, 'User input while paused', 'user-1');
      expect(result).toBe(true);
    });

    it('should allow queueing interventions when session is ACTIVE', async () => {
      const activeSession = { ...mockSession, status: SessionStatus.ACTIVE };
      sessionService.findOne.mockResolvedValue(activeSession as any);

      const result = await councilService.queueIntervention(sessionId, 'User input', 'user-1');
      expect(result).toBe(true);
    });

    it('should reject interventions when session is COMPLETED', async () => {
      const completedSession = { ...mockSession, status: SessionStatus.COMPLETED };
      sessionService.findOne.mockResolvedValue(completedSession as any);

      const result = await councilService.queueIntervention(sessionId, 'Too late', 'user-1');
      expect(result).toBe(false);
    });

    it('should reject interventions when session is CANCELLED', async () => {
      const cancelledSession = { ...mockSession, status: SessionStatus.CANCELLED };
      sessionService.findOne.mockResolvedValue(cancelledSession as any);

      const result = await councilService.queueIntervention(sessionId, 'Too late', 'user-1');
      expect(result).toBe(false);
    });
  });

  describe('waitWhilePaused (Promise-based)', () => {
    it('should resume the discussion loop when resumeDiscussion is called', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);

      let callCount = 0;
      (mockDriver.chat as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // After first turn, trigger pause then resume
          setTimeout(async () => {
            await councilService.pauseDiscussion(sessionId);
            // Resume after a short delay
            setTimeout(() => councilService.resumeDiscussion(sessionId), 50);
          }, 50);
          return { content: 'Turn 1', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
        }
        // After resume, stop to end the test
        setTimeout(() => councilService.stopDiscussion(sessionId), 50);
        return { content: 'Turn 2 after resume', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
      });

      let msgCount = 0;
      messageService.create.mockImplementation(async () => {
        msgCount++;
        return {
          id: `msg-${msgCount}`,
          sessionId,
          content: `Message ${msgCount}`,
          role: MessageRole.ASSISTANT,
          expertId: 'expert-1',
          isIntervention: false,
          timestamp: new Date(),
        } as any;
      });
      messageService.countBySession.mockImplementation(async () => msgCount);

      await councilService.startDiscussion(sessionId);

      // Should have created at least 2 messages (one before pause, one after resume)
      expect(messageService.create).toHaveBeenCalledTimes(2);

      // Both SESSION_PAUSED and SESSION_RESUMED should have been emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.SESSION_PAUSED,
        expect.objectContaining({ sessionId }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.SESSION_RESUMED,
        expect.objectContaining({ sessionId }),
      );
    });

    it('should exit the discussion loop when stopDiscussion is called while paused', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);

      (mockDriver.chat as jest.Mock).mockImplementation(async () => {
        // After first turn, pause then stop
        setTimeout(async () => {
          await councilService.pauseDiscussion(sessionId);
          setTimeout(() => councilService.stopDiscussion(sessionId), 50);
        }, 50);
        return { content: 'Only turn', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
      });

      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'Only turn',
        role: MessageRole.ASSISTANT,
        expertId: 'expert-1',
        isIntervention: false,
        timestamp: new Date(),
      } as any);

      await councilService.startDiscussion(sessionId);

      // Only one message should have been created (before the pause)
      expect(messageService.create).toHaveBeenCalledTimes(1);

      // Session should end as CANCELLED
      const cancelUpdate = sessionService.update.mock.calls.find(
        (call) => call[1]?.status === SessionStatus.CANCELLED,
      );
      expect(cancelUpdate).toBeDefined();
    });
  });
});
