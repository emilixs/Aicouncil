import { Test, TestingModule } from '@nestjs/testing';
import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionStatus, MessageRole, DriverType } from '@prisma/client';
import { MemoryService } from '../memory/memory.service';
import { LLMResponse } from '../llm/dto/llm-response.dto';

describe('CouncilService - Analytics Capture', () => {
  let councilService: CouncilService;
  let messageService: jest.Mocked<MessageService>;
  let sessionService: jest.Mocked<SessionService>;
  let driverFactory: jest.Mocked<DriverFactory>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let memoryService: jest.Mocked<MemoryService>;

  const sessionId = 'test-session-id';
  const expert1Id = 'expert-1';
  const expert2Id = 'expert-2';

  const mockSession = {
    id: sessionId,
    problemStatement: 'Test problem',
    status: SessionStatus.PENDING,
    maxMessages: 10,
    consensusReached: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    experts: [
      {
        id: expert1Id,
        name: 'Expert One',
        specialty: 'Testing',
        systemPrompt: 'You are expert one',
        driverType: DriverType.ANTHROPIC,
        config: { model: 'claude-3-sonnet-20240229', temperature: 0.7 },
        memoryEnabled: true,
        memoryMaxEntries: 50,
        memoryMaxInject: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: expert2Id,
        name: 'Expert Two',
        specialty: 'Analysis',
        systemPrompt: 'You are expert two',
        driverType: DriverType.ANTHROPIC,
        config: { model: 'claude-3-sonnet-20240229', temperature: 0.7 },
        memoryEnabled: true,
        memoryMaxEntries: 50,
        memoryMaxInject: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const normalizedExperts = mockSession.experts;

  const makeLLMResponse = (content: string, overrides?: Partial<LLMResponse>): LLMResponse => ({
    content,
    finishReason: 'stop',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    model: 'claude-3-sonnet-20240229',
    ...overrides,
  });

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

    memoryService = {
      getRelevantMemories: jest.fn().mockResolvedValue({ memories: [], totalFound: 0, ids: [] }),
      formatMemoriesForInjection: jest.fn().mockReturnValue(''),
      generateSessionMemory: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouncilService,
        { provide: SessionService, useValue: sessionService },
        { provide: MessageService, useValue: messageService },
        { provide: DriverFactory, useValue: driverFactory },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: MemoryService, useValue: memoryService },
      ],
    }).compile();

    councilService = module.get<CouncilService>(CouncilService);
  });

  // Helper: set up control flags as startDiscussion would, then run the loop directly
  function setupAndRunLoop() {
    (councilService as any).interventionQueues.set(sessionId, []);
    (councilService as any).sessionControlFlags.set(sessionId, 'running');
    return councilService.runDiscussionLoop(
      sessionId,
      mockSession as any,
      normalizedExperts as any,
    );
  }

  describe('token usage capture', () => {
    it('should pass promptTokens, completionTokens, totalTokens from LLMResponse to message creation', async () => {
      const llmResponse = makeLLMResponse('I think the answer is...');

      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock)
        .mockResolvedValueOnce(llmResponse)
        .mockResolvedValueOnce(makeLLMResponse('I agree, consensus reached'));

      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'I think the answer is...',
        role: MessageRole.ASSISTANT,
        expertId: expert1Id,
        isIntervention: false,
        timestamp: new Date(),
      } as any);

      messageService.countBySession.mockResolvedValue(0);

      await setupAndRunLoop().catch(() => {});

      const createCalls = messageService.create.mock.calls;
      expect(createCalls.length).toBeGreaterThan(0);

      const firstMessageDto = createCalls[0][0];
      expect(firstMessageDto.promptTokens).toBe(100);
      expect(firstMessageDto.completionTokens).toBe(50);
      expect(firstMessageDto.totalTokens).toBe(150);
    });
  });

  describe('round number tracking', () => {
    it('should set roundNumber=1 for first round of expert messages', async () => {
      const llmResponse = makeLLMResponse('My analysis...');

      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock)
        .mockResolvedValueOnce(llmResponse)
        .mockResolvedValueOnce(makeLLMResponse('I agree, consensus reached'));

      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'My analysis...',
        role: MessageRole.ASSISTANT,
        expertId: expert1Id,
        isIntervention: false,
        timestamp: new Date(),
      } as any);

      messageService.countBySession.mockResolvedValue(0);

      await setupAndRunLoop().catch(() => {});

      const createCalls = messageService.create.mock.calls;
      expect(createCalls.length).toBeGreaterThan(0);

      const firstMessageDto = createCalls[0][0];
      expect(firstMessageDto.roundNumber).toBe(1);
    });

    it('should increment roundNumber after all experts have spoken', async () => {
      sessionService.findOne.mockResolvedValue({
        ...mockSession,
        maxMessages: 10,
      } as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock)
        .mockResolvedValueOnce(makeLLMResponse('Expert 1, round 1'))
        .mockResolvedValueOnce(makeLLMResponse('Expert 2, round 1'))
        .mockResolvedValueOnce(makeLLMResponse('Expert 1, round 2'))
        .mockResolvedValueOnce(makeLLMResponse('I agree, consensus reached'));

      let msgCount = 0;
      messageService.create.mockImplementation(async () => {
        msgCount++;
        return {
          id: `msg-${msgCount}`,
          sessionId,
          content: `Message ${msgCount}`,
          role: MessageRole.ASSISTANT,
          expertId: expert1Id,
          isIntervention: false,
          timestamp: new Date(),
        } as any;
      });

      messageService.countBySession.mockImplementation(async () => msgCount);

      await setupAndRunLoop().catch(() => {});

      const createCalls = messageService.create.mock.calls;

      if (createCalls.length >= 3) {
        expect(createCalls[0][0].roundNumber).toBe(1);
        expect(createCalls[1][0].roundNumber).toBe(1);
        expect(createCalls[2][0].roundNumber).toBe(2);
      } else {
        expect(createCalls.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('response timing', () => {
    it('should include responseTimeMs in message creation', async () => {
      const llmResponse = makeLLMResponse('Response content');

      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock)
        .mockResolvedValueOnce(llmResponse)
        .mockResolvedValueOnce(makeLLMResponse('I agree, consensus reached'));

      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'Response content',
        role: MessageRole.ASSISTANT,
        expertId: expert1Id,
        isIntervention: false,
        timestamp: new Date(),
      } as any);

      messageService.countBySession.mockResolvedValue(0);

      await setupAndRunLoop().catch(() => {});

      const createCalls = messageService.create.mock.calls;
      expect(createCalls.length).toBeGreaterThan(0);

      const firstMessageDto = createCalls[0][0];
      expect(firstMessageDto.responseTimeMs).toBeDefined();
      expect(typeof firstMessageDto.responseTimeMs).toBe('number');
      expect(firstMessageDto.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('model and finishReason capture', () => {
    it('should pass model from LLMResponse to message creation', async () => {
      const llmResponse = makeLLMResponse('Content', { model: 'gpt-4o' });

      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock)
        .mockResolvedValueOnce(llmResponse)
        .mockResolvedValueOnce(makeLLMResponse('I agree, consensus reached'));

      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'Content',
        role: MessageRole.ASSISTANT,
        expertId: expert1Id,
        isIntervention: false,
        timestamp: new Date(),
      } as any);

      messageService.countBySession.mockResolvedValue(0);

      await setupAndRunLoop().catch(() => {});

      const createCalls = messageService.create.mock.calls;
      expect(createCalls.length).toBeGreaterThan(0);
      expect(createCalls[0][0].model).toBe('gpt-4o');
    });

    it('should pass finishReason from LLMResponse to message creation', async () => {
      const llmResponse = makeLLMResponse('Content', { finishReason: 'length' });

      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock)
        .mockResolvedValueOnce(llmResponse)
        .mockResolvedValueOnce(makeLLMResponse('I agree, consensus reached'));

      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'Content',
        role: MessageRole.ASSISTANT,
        expertId: expert1Id,
        isIntervention: false,
        timestamp: new Date(),
      } as any);

      messageService.countBySession.mockResolvedValue(0);

      await setupAndRunLoop().catch(() => {});

      const createCalls = messageService.create.mock.calls;
      expect(createCalls.length).toBeGreaterThan(0);
      expect(createCalls[0][0].finishReason).toBe('length');
    });
  });

  describe('intervention round number', () => {
    it('should include roundNumber when creating intervention messages', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      // Queue an intervention before running the loop
      (councilService as any).interventionQueues.set(sessionId, [
        { content: 'User intervention', userId: 'user-1' },
      ]);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock).mockResolvedValueOnce(
        makeLLMResponse('I agree, consensus reached'),
      );

      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'User intervention',
        role: MessageRole.USER,
        isIntervention: true,
        timestamp: new Date(),
      } as any);

      messageService.countBySession.mockResolvedValue(0);

      (councilService as any).sessionControlFlags.set(sessionId, 'running');
      await councilService
        .runDiscussionLoop(sessionId, mockSession as any, normalizedExperts as any)
        .catch(() => {});

      const interventionCall = messageService.create.mock.calls.find(
        (call) => call[0].isIntervention === true,
      );

      if (interventionCall) {
        expect(interventionCall[0].roundNumber).toBeDefined();
        expect(typeof interventionCall[0].roundNumber).toBe('number');
      }
    });
  });

  describe('startDiscussion (async fire-and-forget)', () => {
    it('should return immediately without waiting for the loop to finish', async () => {
      jest.useFakeTimers();

      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.ACTIVE,
      } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(makeLLMResponse('I agree, consensus reached')), 5000),
          ),
      );

      messageService.countBySession.mockResolvedValue(0);
      messageService.create.mockResolvedValue({
        id: 'msg-1',
        sessionId,
        content: 'I agree, consensus reached',
        role: MessageRole.ASSISTANT,
        expertId: 'expert-1',
        isIntervention: false,
        timestamp: new Date(),
      } as any);

      const result = await councilService.startDiscussion(sessionId);
      expect(result).toBeDefined();

      // Drain the background loop so no timers leak
      await jest.advanceTimersByTimeAsync(10000);

      jest.useRealTimers();
    });
  });

  describe('consensus detection', () => {
    it.each([
      'I agree with the proposal',
      'consensus reached on this topic',
      'we agree on the approach',
      'I concur with the analysis',
      'agreed, let us proceed',
      'we have consensus',
      'we reached consensus',
      'we are in agreement',
    ])('detects consensus in: "%s"', async (content) => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock).mockResolvedValueOnce(makeLLMResponse(content));

      messageService.create.mockResolvedValue({
        id: 'msg-1', sessionId, content, role: MessageRole.ASSISTANT,
        expertId: expert1Id, isIntervention: false, timestamp: new Date(),
      } as any);
      messageService.countBySession.mockResolvedValue(0);

      await setupAndRunLoop().catch(() => {});

      const consensusEvent = eventEmitter.emit.mock.calls.find(
        (call) => call[0] === 'discussion.consensus.reached',
      );
      expect(consensusEvent).toBeDefined();
    });

    it('does not detect consensus for normal discussion content', async () => {
      sessionService.findOne.mockResolvedValue({ ...mockSession, maxMessages: 2 } as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock).mockResolvedValue(
        makeLLMResponse('I think we should consider other options'),
      );

      let msgCount = 0;
      messageService.create.mockImplementation(async () => {
        msgCount++;
        return {
          id: `msg-${msgCount}`, sessionId, content: 'msg',
          role: MessageRole.ASSISTANT, expertId: expert1Id, isIntervention: false,
          timestamp: new Date(),
        } as any;
      });
      messageService.countBySession.mockImplementation(async () => msgCount);

      await setupAndRunLoop().catch(() => {});

      const consensusEvent = eventEmitter.emit.mock.calls.find(
        (call) => call[0] === 'discussion.consensus.reached',
      );
      expect(consensusEvent).toBeUndefined();
    });
  });

  describe('empty response handling', () => {
    it('skips message creation for empty response and continues', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock)
        .mockResolvedValueOnce(makeLLMResponse('   '))
        .mockResolvedValueOnce(makeLLMResponse('I agree, consensus reached'));

      messageService.create.mockResolvedValue({
        id: 'msg-1', sessionId, content: 'I agree, consensus reached',
        role: MessageRole.ASSISTANT, expertId: expert2Id, isIntervention: false,
        timestamp: new Date(),
      } as any);
      messageService.countBySession.mockResolvedValue(0);

      await setupAndRunLoop().catch(() => {});

      const createCalls = messageService.create.mock.calls;
      expect(createCalls.length).toBe(1);
      expect(createCalls[0][0].content).toBe('I agree, consensus reached');
    });
  });

  describe('transient error handling', () => {
    it('continues to next expert on transient LLMRateLimitException', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const rateLimitError = new Error('Rate limited');
      rateLimitError.name = 'LLMRateLimitException';

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(makeLLMResponse('I agree, consensus reached'));

      messageService.create.mockResolvedValue({
        id: 'msg-1', sessionId, content: 'msg', role: MessageRole.ASSISTANT,
        expertId: expert2Id, isIntervention: false, timestamp: new Date(),
      } as any);
      messageService.countBySession.mockResolvedValue(0);

      await setupAndRunLoop().catch(() => {});

      expect(messageService.create).toHaveBeenCalled();
    });

    it('throws on fatal (non-transient) error', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const fatalError = new Error('Invalid API key');
      fatalError.name = 'LLMAuthenticationException';

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock).mockRejectedValueOnce(fatalError);

      messageService.countBySession.mockResolvedValue(0);

      await expect(setupAndRunLoop()).rejects.toThrow('Invalid API key');
    });
  });

  describe('session control: stop', () => {
    it('stops the loop and sets status to CANCELLED', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock).mockImplementation(async () => {
        (councilService as any).sessionControlFlags.set(sessionId, 'stopped');
        return makeLLMResponse('some content');
      });

      let msgCount = 0;
      messageService.create.mockImplementation(async () => {
        msgCount++;
        return {
          id: `msg-${msgCount}`, sessionId, content: 'msg',
          role: MessageRole.ASSISTANT, expertId: expert1Id, isIntervention: false,
          timestamp: new Date(),
        } as any;
      });
      messageService.countBySession.mockImplementation(async () => msgCount);

      await setupAndRunLoop().catch(() => {});

      expect(sessionService.update).toHaveBeenCalledWith(sessionId, {
        status: SessionStatus.CANCELLED,
      });
    });
  });

  describe('concludeSession error handling', () => {
    it('emits error event when concludeSession fails but does not throw', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockRejectedValue(new Error('DB error'));

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock).mockResolvedValueOnce(
        makeLLMResponse('I agree, consensus reached'),
      );

      messageService.create.mockResolvedValue({
        id: 'msg-1', sessionId, content: 'I agree',
        role: MessageRole.ASSISTANT, expertId: expert1Id, isIntervention: false,
        timestamp: new Date(),
      } as any);
      messageService.countBySession.mockResolvedValue(1);

      await setupAndRunLoop().catch(() => {});

      const errorEvent = eventEmitter.emit.mock.calls.find(
        (call) => call[0] === 'discussion.error',
      );
      expect(errorEvent).toBeDefined();
    });
  });

  describe('processInterventions', () => {
    it('emits error event when intervention creation fails', async () => {
      sessionService.findOne.mockResolvedValue(mockSession as any);
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      (councilService as any).interventionQueues.set(sessionId, [
        { content: 'intervention 1', userId: 'user-1' },
      ]);

      messageService.create
        .mockRejectedValueOnce(new Error('Failed to create'))
        .mockResolvedValue({
          id: 'msg-2', sessionId, content: 'I agree, consensus reached',
          role: MessageRole.ASSISTANT, expertId: expert1Id, isIntervention: false,
          timestamp: new Date(),
        } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock).mockResolvedValueOnce(
        makeLLMResponse('I agree, consensus reached'),
      );
      messageService.countBySession.mockResolvedValue(0);

      (councilService as any).sessionControlFlags.set(sessionId, 'running');
      await councilService
        .runDiscussionLoop(sessionId, mockSession as any, normalizedExperts as any)
        .catch(() => {});

      const errorEvents = eventEmitter.emit.mock.calls.filter(
        (call) => call[0] === 'discussion.error',
      );
      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('max messages limit', () => {
    it('breaks the loop and concludes when max messages reached', async () => {
      const smallSession = { ...mockSession, maxMessages: 3 };
      sessionService.findOne.mockResolvedValue(smallSession as any);
      sessionService.update.mockResolvedValue({ ...smallSession, status: SessionStatus.COMPLETED } as any);

      messageService.countBySession.mockResolvedValue(3);

      (councilService as any).interventionQueues.set(sessionId, []);
      (councilService as any).sessionControlFlags.set(sessionId, 'running');
      await councilService.runDiscussionLoop(
        sessionId,
        smallSession as any,
        normalizedExperts as any,
      );

      const endedEvent = eventEmitter.emit.mock.calls.find(
        (call) => call[0] === 'discussion.session.ended',
      );
      expect(endedEvent).toBeDefined();
      expect(endedEvent![1].reason).toBe('max_messages');
    });
  });
});
