import { Test, TestingModule } from '@nestjs/testing';
import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionStatus, MessageRole, DriverType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { MemoryService } from '../memory/memory.service';
import { ConsensusService } from '../consensus/consensus.service';
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
          config: { model: 'claude-sonnet-4-6', temperature: 0.7 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
  };

  const normalizedExperts = mockSession.experts.map((e) => e.expert);

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
        {
          provide: MemoryService,
          useValue: {
            getRelevantMemories: jest.fn().mockResolvedValue({ memories: [], ids: [] }),
            formatMemoriesForInjection: jest.fn().mockReturnValue(''),
            generateSessionMemory: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConsensusService,
          useValue: {
            evaluateConsensus: jest.fn().mockResolvedValue({ convergenceScore: 0.5, consensusReached: false, areasOfAgreement: [], areasOfDisagreement: [], progressAssessment: 'ongoing', reasoning: 'test' }),
            checkStallDetection: jest.fn().mockReturnValue({ stalled: false, stalledRounds: 0 }),
            hasAutoPolledSession: jest.fn().mockResolvedValue(false),
            createPoll: jest.fn().mockResolvedValue(undefined),
            generateSummary: jest.fn().mockResolvedValue(undefined),
            clearSessionState: jest.fn(),
          },
        },
      ],
    }).compile();

    councilService = module.get<CouncilService>(CouncilService);
  });

  function setupAndRunLoop() {
    (councilService as any).interventionQueues.set(sessionId, []);
    (councilService as any).sessionControlFlags.set(sessionId, 'running');
    return councilService.runDiscussionLoop(
      sessionId,
      mockSession as any,
      normalizedExperts as any,
    );
  }

  describe('pauseDiscussion', () => {
    it('should set session status to PAUSED and emit SESSION_PAUSED event', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);

      let pauseTriggered = false;
      (mockDriver.chat as jest.Mock).mockImplementation(async () => {
        if (!pauseTriggered) {
          pauseTriggered = true;
          setTimeout(() => {
            councilService.pauseDiscussion(sessionId).then(() => {
              councilService.stopDiscussion(sessionId);
            });
          }, 50);
          return {
            content: 'Expert response',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          };
        }
        return {
          content: 'Should not reach',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
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

      await setupAndRunLoop();

      const pausedEmit = eventEmitter.emit.mock.calls.find(
        (call) => call[0] === DISCUSSION_EVENTS.SESSION_PAUSED,
      );
      expect(pausedEmit).toBeDefined();
      expect(pausedEmit![1]).toEqual({ sessionId });

      const pauseUpdate = sessionService.update.mock.calls.find(
        (call) => call[1]?.status === SessionStatus.PAUSED,
      );
      expect(pauseUpdate).toBeDefined();
    });

    it('should throw BadRequestException if session is not running', async () => {
      await expect(councilService.pauseDiscussion(sessionId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('resumeDiscussion', () => {
    it('should throw BadRequestException if session is not paused', async () => {
      await expect(councilService.resumeDiscussion(sessionId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('stopDiscussion', () => {
    it('should emit DISCUSSION_STOPPED immediately when stopped', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);

      let stopTriggered = false;
      (mockDriver.chat as jest.Mock).mockImplementation(async () => {
        if (!stopTriggered) {
          stopTriggered = true;
          setTimeout(() => councilService.stopDiscussion(sessionId), 50);
          return {
            content: 'Expert response',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          };
        }
        return {
          content: 'Unreachable',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
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

      await setupAndRunLoop();

      const stoppedEmit = eventEmitter.emit.mock.calls.find(
        (call) => call[0] === DISCUSSION_EVENTS.DISCUSSION_STOPPED,
      );
      expect(stoppedEmit).toBeDefined();
      expect(stoppedEmit![1]).toEqual({ sessionId });

      const cancelUpdate = sessionService.update.mock.calls.find(
        (call) => call[1]?.status === SessionStatus.CANCELLED,
      );
      expect(cancelUpdate).toBeDefined();
    });

    it('should throw BadRequestException if session has no active flag', async () => {
      await expect(councilService.stopDiscussion(sessionId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('queueIntervention with PAUSED status', () => {
    it('should allow queueing interventions when session is PAUSED', async () => {
      const pausedSession = { ...mockSession, status: SessionStatus.PAUSED };
      sessionService.findOne.mockResolvedValue(pausedSession as any);

      const result = await councilService.queueIntervention(
        sessionId,
        'User input while paused',
        'user-1',
      );
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
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);

      let callCount = 0;
      (mockDriver.chat as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          setTimeout(async () => {
            await councilService.pauseDiscussion(sessionId);
            setTimeout(() => councilService.resumeDiscussion(sessionId), 50);
          }, 50);
          return {
            content: 'Turn 1',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          };
        }
        setTimeout(() => councilService.stopDiscussion(sessionId), 50);
        return {
          content: 'Turn 2 after resume',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
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

      await setupAndRunLoop();

      expect(messageService.create).toHaveBeenCalledTimes(2);

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
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);

      (mockDriver.chat as jest.Mock).mockImplementation(async () => {
        setTimeout(async () => {
          await councilService.pauseDiscussion(sessionId);
          setTimeout(() => councilService.stopDiscussion(sessionId), 50);
        }, 50);
        return {
          content: 'Only turn',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
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

      await setupAndRunLoop();

      expect(messageService.create).toHaveBeenCalledTimes(1);

      const cancelUpdate = sessionService.update.mock.calls.find(
        (call) => call[1]?.status === SessionStatus.CANCELLED,
      );
      expect(cancelUpdate).toBeDefined();
    });
  });
});
