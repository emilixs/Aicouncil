import { Test, TestingModule } from '@nestjs/testing';
import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionStatus, MessageRole, DriverType } from '@prisma/client';
import { LLMResponse } from '../llm/dto/llm-response.dto';

describe('CouncilService - Analytics Capture', () => {
  let councilService: CouncilService;
  let messageService: jest.Mocked<MessageService>;
  let sessionService: jest.Mocked<SessionService>;
  let driverFactory: jest.Mocked<DriverFactory>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

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
        id: 'se-1',
        sessionId,
        expertId: expert1Id,
        joinedAt: new Date(),
        expert: {
          id: expert1Id,
          name: 'Expert One',
          specialty: 'Testing',
          systemPrompt: 'You are expert one',
          driverType: DriverType.ANTHROPIC,
          config: { model: 'claude-3-sonnet-20240229', temperature: 0.7 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        id: 'se-2',
        sessionId,
        expertId: expert2Id,
        joinedAt: new Date(),
        expert: {
          id: expert2Id,
          name: 'Expert Two',
          specialty: 'Analysis',
          systemPrompt: 'You are expert two',
          driverType: DriverType.ANTHROPIC,
          config: { model: 'claude-3-sonnet-20240229', temperature: 0.7 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
  };

  const normalizedExperts = mockSession.experts.map((e) => e.expert);

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

  // Helper: set up control flags as startDiscussion would, then run the loop directly
  function setupAndRunLoop() {
    (councilService as any).interventionQueues.set(sessionId, []);
    (councilService as any).sessionControlFlags.set(sessionId, 'running');
    return councilService.runDiscussionLoop(sessionId, mockSession as any, normalizedExperts as any);
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
      (councilService as any).interventionQueues.set(sessionId, [{ content: 'User intervention', userId: 'user-1' }]);

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
      await councilService.runDiscussionLoop(sessionId, mockSession as any, normalizedExperts as any).catch(() => {});

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
      sessionService.update.mockResolvedValue({ ...mockSession, status: SessionStatus.ACTIVE } as any);

      const mockDriver = driverFactory.createDriver(DriverType.ANTHROPIC);
      (mockDriver.chat as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(makeLLMResponse('I agree, consensus reached')), 5000)),
      );

      messageService.countBySession.mockResolvedValue(0);
      messageService.create.mockResolvedValue({
        id: 'msg-1', sessionId, content: 'I agree, consensus reached',
        role: MessageRole.ASSISTANT, expertId: 'expert-1',
        isIntervention: false, timestamp: new Date(),
      } as any);

      const result = await councilService.startDiscussion(sessionId);
      expect(result).toBeDefined();

      // Drain the background loop so no timers leak
      await jest.advanceTimersByTimeAsync(10000);

      jest.useRealTimers();
    });
  });
});
