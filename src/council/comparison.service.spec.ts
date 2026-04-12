import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionStatus, MessageRole, DriverType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComparisonService } from './comparison.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { SessionResponseDto } from '../session/dto/session-response.dto';
import { MessageResponseDto } from '../message/dto/message-response.dto';
import { COMPARISON_EVENTS } from './events/comparison.events';

describe('ComparisonService', () => {
  let service: ComparisonService;
  let sessionService: jest.Mocked<SessionService>;
  let messageService: jest.Mocked<MessageService>;
  let driverFactory: jest.Mocked<DriverFactory>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  // Shared test fixtures
  const sessionId = 'test-session-id';

  const mockExpertA = {
    id: 'expert-a',
    name: 'Expert A',
    specialty: 'Backend',
    systemPrompt: 'You are a backend expert.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-5.4-mini' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExpertB = {
    id: 'expert-b',
    name: 'Expert B',
    specialty: 'Frontend',
    systemPrompt: 'You are a frontend expert.',
    driverType: DriverType.ANTHROPIC,
    config: { model: 'claude-sonnet-4-20250514' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExpertC = {
    id: 'expert-c',
    name: 'Expert C',
    specialty: 'DevOps',
    systemPrompt: 'You are a devops expert.',
    driverType: DriverType.GROK,
    config: { model: 'grok-4.20-0309-reasoning' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const makeSession = (overrides: Partial<SessionResponseDto> = {}): SessionResponseDto => {
    return new SessionResponseDto({
      id: sessionId,
      problemStatement: 'How should we design the API?',
      status: SessionStatus.PENDING,
      statusDisplay: 'pending',
      maxMessages: 20,
      consensusReached: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      experts: [mockExpertA, mockExpertB],
      // Session type will be added by the implementation — COMPARISON sessions
      // need a `type` field on SessionResponseDto. For now we simulate it.
      ...overrides,
    } as any);
  };

  const makeLLMResponse = (overrides = {}) => ({
    content: 'This is my expert response.',
    finishReason: 'stop' as const,
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    model: 'gpt-5.4-mini',
    ...overrides,
  });

  const mockDriver = {
    chat: jest.fn(),
    streamChat: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComparisonService,
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
            findBySession: jest.fn(),
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
          },
        },
      ],
    }).compile();

    service = module.get<ComparisonService>(ComparisonService);
    sessionService = module.get(SessionService);
    messageService = module.get(MessageService);
    driverFactory = module.get(DriverFactory);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startComparison()', () => {
    it('should dispatch all experts in parallel and create messages with metrics', async () => {
      const session = makeSession();
      // Mark session as COMPARISON type
      (session as any).type = 'COMPARISON';
      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(session);

      const responseA = makeLLMResponse({
        content: 'Response from Expert A',
        model: 'gpt-5.4-mini',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
      });
      const responseB = makeLLMResponse({
        content: 'Response from Expert B',
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 60, completionTokens: 120, totalTokens: 180 },
      });

      const driverA = { chat: jest.fn().mockResolvedValue(responseA), streamChat: jest.fn() };
      const driverB = { chat: jest.fn().mockResolvedValue(responseB), streamChat: jest.fn() };

      driverFactory.createDriver
        .mockReturnValueOnce(driverA as any)
        .mockReturnValueOnce(driverB as any);

      const messageA = new MessageResponseDto({
        id: 'msg-a',
        sessionId,
        expertId: mockExpertA.id,
        content: 'Response from Expert A',
        role: MessageRole.ASSISTANT,
        isIntervention: false,
        timestamp: new Date(),
        expertName: mockExpertA.name,
      });
      const messageB = new MessageResponseDto({
        id: 'msg-b',
        sessionId,
        expertId: mockExpertB.id,
        content: 'Response from Expert B',
        role: MessageRole.ASSISTANT,
        isIntervention: false,
        timestamp: new Date(),
        expertName: mockExpertB.name,
      });

      messageService.create.mockResolvedValueOnce(messageA).mockResolvedValueOnce(messageB);

      await service.startComparison(sessionId);

      // Both drivers should have been called
      expect(driverA.chat).toHaveBeenCalledTimes(1);
      expect(driverB.chat).toHaveBeenCalledTimes(1);

      // Messages should have been created with metric fields
      expect(messageService.create).toHaveBeenCalledTimes(2);

      // Verify that messages include durationMs, tokenCount, modelUsed
      // (These fields don't exist on CreateMessageDto yet — cast to any)
      const createCalls = messageService.create.mock.calls;
      for (const [createDto] of createCalls) {
        const dto = createDto as any;
        expect(dto).toHaveProperty('durationMs');
        expect(typeof dto.durationMs).toBe('number');
        expect(dto.durationMs).toBeGreaterThan(0);
        expect(dto).toHaveProperty('tokenCount');
        expect(dto).toHaveProperty('modelUsed');
      }

      // Verify first call has Expert A's metrics
      expect((createCalls[0][0] as any).tokenCount).toBe(150);
      expect((createCalls[0][0] as any).modelUsed).toBe('gpt-5.4-mini');

      // Verify second call has Expert B's metrics
      expect((createCalls[1][0] as any).tokenCount).toBe(180);
      expect((createCalls[1][0] as any).modelUsed).toBe('claude-sonnet-4-20250514');

      // RESPONSE_RECEIVED should have been emitted for each expert
      const responseEvents = eventEmitter.emit.mock.calls.filter(
        ([event]) => event === COMPARISON_EVENTS.RESPONSE_RECEIVED,
      );
      expect(responseEvents).toHaveLength(2);

      // ALL_RESPONSES_RECEIVED should have been emitted once
      const allReceivedEvents = eventEmitter.emit.mock.calls.filter(
        ([event]) => event === COMPARISON_EVENTS.ALL_RESPONSES_RECEIVED,
      );
      expect(allReceivedEvents).toHaveLength(1);
    });

    it('should persist partial results when one expert fails', async () => {
      const session = makeSession({
        experts: [mockExpertA, mockExpertB, mockExpertC],
      } as any);
      (session as any).type = 'COMPARISON';
      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(session);

      const responseA = makeLLMResponse({ content: 'Response A', model: 'gpt-5.4-mini' });
      const responseC = makeLLMResponse({ content: 'Response C', model: 'grok-4.20-0309-reasoning' });

      const driverA = { chat: jest.fn().mockResolvedValue(responseA), streamChat: jest.fn() };
      const driverB = {
        chat: jest.fn().mockRejectedValue(new Error('API key invalid')),
        streamChat: jest.fn(),
      };
      const driverC = { chat: jest.fn().mockResolvedValue(responseC), streamChat: jest.fn() };

      driverFactory.createDriver
        .mockReturnValueOnce(driverA as any)
        .mockReturnValueOnce(driverB as any)
        .mockReturnValueOnce(driverC as any);

      messageService.create.mockResolvedValue(
        new MessageResponseDto({
          id: 'msg-x',
          sessionId,
          expertId: 'any',
          content: 'response',
          role: MessageRole.ASSISTANT,
          isIntervention: false,
          timestamp: new Date(),
        }),
      );

      // Should NOT throw — partial results are OK
      await service.startComparison(sessionId);

      // Two successful experts should have created messages
      expect(messageService.create).toHaveBeenCalledTimes(2);

      // Error event should have been emitted for Expert B
      const errorEvents = eventEmitter.emit.mock.calls.filter(
        ([event]) => event === COMPARISON_EVENTS.COMPARISON_ERROR,
      );
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0][1]).toMatchObject({
        sessionId,
        expertId: mockExpertB.id,
        expertName: mockExpertB.name,
      });

      // Session should still transition to COMPLETED
      const updateCalls = sessionService.update.mock.calls;
      const completedCall = updateCalls.find(([, dto]) => dto.status === SessionStatus.COMPLETED);
      expect(completedCall).toBeDefined();
    });

    it('should transition session through PENDING → ACTIVE → COMPLETED', async () => {
      const session = makeSession();
      (session as any).type = 'COMPARISON';
      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(session);

      const response = makeLLMResponse();
      const driver = { chat: jest.fn().mockResolvedValue(response), streamChat: jest.fn() };
      driverFactory.createDriver.mockReturnValue(driver as any);

      messageService.create.mockResolvedValue(
        new MessageResponseDto({
          id: 'msg-1',
          sessionId,
          expertId: 'expert-a',
          content: 'response',
          role: MessageRole.ASSISTANT,
          isIntervention: false,
          timestamp: new Date(),
        }),
      );

      await service.startComparison(sessionId);

      const updateCalls = sessionService.update.mock.calls;

      // First update: PENDING → ACTIVE
      expect(updateCalls[0]).toEqual([
        sessionId,
        expect.objectContaining({ status: SessionStatus.ACTIVE }),
      ]);

      // Last update: ACTIVE → COMPLETED
      const lastCall = updateCalls[updateCalls.length - 1];
      expect(lastCall).toEqual([
        sessionId,
        expect.objectContaining({ status: SessionStatus.COMPLETED }),
      ]);
    });

    it('should reject sessions that are not type COMPARISON', async () => {
      const session = makeSession();
      // type is DISCUSSION (or undefined for legacy sessions)
      (session as any).type = 'DISCUSSION';
      sessionService.findOne.mockResolvedValue(session);

      await expect(service.startComparison(sessionId)).rejects.toThrow(BadRequestException);
      await expect(service.startComparison(sessionId)).rejects.toThrow(/COMPARISON/);

      // No drivers should have been created
      expect(driverFactory.createDriver).not.toHaveBeenCalled();
    });

    it('should reject sessions that are not status PENDING', async () => {
      const session = makeSession({ status: SessionStatus.ACTIVE, statusDisplay: 'active' });
      (session as any).type = 'COMPARISON';
      sessionService.findOne.mockResolvedValue(session);

      await expect(service.startComparison(sessionId)).rejects.toThrow(BadRequestException);
      await expect(service.startComparison(sessionId)).rejects.toThrow(/pending|PENDING/i);

      // Session should not have been updated
      expect(sessionService.update).not.toHaveBeenCalled();
    });

    it('should populate messages with correct durationMs, tokenCount, and modelUsed', async () => {
      const session = makeSession();
      (session as any).type = 'COMPARISON';
      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(session);

      const response = makeLLMResponse({
        content: 'Expert analysis here.',
        model: 'gpt-5.4',
        usage: { promptTokens: 200, completionTokens: 400, totalTokens: 600 },
      });

      // Simulate a driver that takes ~50ms
      const driver = {
        chat: jest.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return response;
        }),
        streamChat: jest.fn(),
      };
      driverFactory.createDriver.mockReturnValue(driver as any);

      messageService.create.mockResolvedValue(
        new MessageResponseDto({
          id: 'msg-1',
          sessionId,
          expertId: 'expert-a',
          content: 'Expert analysis here.',
          role: MessageRole.ASSISTANT,
          isIntervention: false,
          timestamp: new Date(),
        }),
      );

      await service.startComparison(sessionId);

      // Verify each create call has the right metric fields
      // (These fields don't exist on CreateMessageDto yet — cast to any)
      for (const [createDto] of messageService.create.mock.calls) {
        const dto = createDto as any;
        // durationMs should be a positive number (at least ~50ms from our mock delay)
        expect(dto.durationMs).toBeGreaterThanOrEqual(40); // allow some margin
        expect(dto.tokenCount).toBe(600);
        expect(dto.modelUsed).toBe('gpt-5.4');
      }
    });

    it('should treat null/undefined response from driver as a rejected promise', async () => {
      const session = makeSession();
      (session as any).type = 'COMPARISON';
      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(session);

      const responseA = makeLLMResponse({ content: 'Valid response from A' });
      const driverA = { chat: jest.fn().mockResolvedValue(responseA), streamChat: jest.fn() };
      const driverB = { chat: jest.fn().mockResolvedValue(undefined), streamChat: jest.fn() };

      driverFactory.createDriver
        .mockReturnValueOnce(driverA as any)
        .mockReturnValueOnce(driverB as any);

      messageService.create.mockResolvedValue(
        new MessageResponseDto({
          id: 'msg-1',
          sessionId,
          expertId: mockExpertA.id,
          content: 'Valid response from A',
          role: MessageRole.ASSISTANT,
          isIntervention: false,
          timestamp: new Date(),
        }),
      );

      await service.startComparison(sessionId);

      // Only Expert A's message should have been created
      expect(messageService.create).toHaveBeenCalledTimes(1);

      // Error event should have been emitted for Expert B
      const errorEvents = eventEmitter.emit.mock.calls.filter(
        ([event]) => event === COMPARISON_EVENTS.COMPARISON_ERROR,
      );
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0][1]).toMatchObject({
        sessionId,
        expertId: mockExpertB.id,
      });
    });

    it('should ensure context isolation — each expert receives only system prompt + problem statement', async () => {
      const session = makeSession();
      (session as any).type = 'COMPARISON';
      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(session);

      const response = makeLLMResponse();
      const driverA = { chat: jest.fn().mockResolvedValue(response), streamChat: jest.fn() };
      const driverB = { chat: jest.fn().mockResolvedValue(response), streamChat: jest.fn() };

      driverFactory.createDriver
        .mockReturnValueOnce(driverA as any)
        .mockReturnValueOnce(driverB as any);

      messageService.create.mockResolvedValue(
        new MessageResponseDto({
          id: 'msg-1',
          sessionId,
          expertId: 'expert-a',
          content: 'response',
          role: MessageRole.ASSISTANT,
          isIntervention: false,
          timestamp: new Date(),
        }),
      );

      await service.startComparison(sessionId);

      // Expert A's context
      const contextA = driverA.chat.mock.calls[0][0];
      expect(contextA).toHaveLength(2); // system prompt + user message
      expect(contextA[0].role).toBe('system');
      expect(contextA[0].content).toContain(mockExpertA.systemPrompt);
      expect(contextA[1].role).toBe('user');
      expect(contextA[1].content).toContain(session.problemStatement);

      // Expert B's context — should NOT contain Expert A's response
      const contextB = driverB.chat.mock.calls[0][0];
      expect(contextB).toHaveLength(2); // system prompt + user message
      expect(contextB[0].role).toBe('system');
      expect(contextB[0].content).toContain(mockExpertB.systemPrompt);
      expect(contextB[1].role).toBe('user');
      expect(contextB[1].content).toContain(session.problemStatement);

      // Crucially: Expert B should NOT see Expert A's response
      const contextBContent = contextB.map((m: any) => m.content).join(' ');
      expect(contextBContent).not.toContain('Response from Expert A');
    });
  });
});
