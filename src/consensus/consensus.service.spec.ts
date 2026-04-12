import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConsensusService } from './consensus.service';
import { PrismaService } from '../common/prisma.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { MessageService } from '../message/message.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ConsensusService', () => {
  let service: ConsensusService;
  let prisma: any;
  let driverFactory: jest.Mocked<DriverFactory>;
  let messageService: jest.Mocked<MessageService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let configService: jest.Mocked<ConfigService>;

  const mockDriver = {
    chat: jest.fn(),
    streamChat: jest.fn(),
  };

  beforeEach(async () => {
    prisma = {
      consensusEvaluation: { create: jest.fn(), findMany: jest.fn() },
      discussionOutcome: { create: jest.fn(), findUnique: jest.fn() },
      poll: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      pollVote: { create: jest.fn() },
    } as any;

    driverFactory = { createDriver: jest.fn().mockReturnValue(mockDriver) } as any;
    messageService = {
      findBySession: jest.fn(),
      findLatestBySession: jest.fn(),
    } as any;
    eventEmitter = { emit: jest.fn() } as any;
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'CONSENSUS_EVALUATOR_MODEL') return 'claude-sonnet-4-20250514';
        if (key === 'CONSENSUS_EVALUATOR_DRIVER') return 'ANTHROPIC';
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsensusService,
        { provide: PrismaService, useValue: prisma },
        { provide: DriverFactory, useValue: driverFactory },
        { provide: MessageService, useValue: messageService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ConsensusService>(ConsensusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateConsensus', () => {
    const sessionId = 'session-1';
    const session = {
      id: sessionId,
      problemStatement: 'How should we design the API?',
      consensusThreshold: 0.8,
    };
    const experts = [
      { id: 'e1', name: 'Alice', specialty: 'Backend' },
      { id: 'e2', name: 'Bob', specialty: 'Frontend' },
    ];

    it('should return consensus evaluation with convergence score', async () => {
      const evaluationJson = {
        convergenceScore: 0.85,
        consensusReached: true,
        areasOfAgreement: ['REST API design', 'Authentication approach'],
        areasOfDisagreement: [],
        progressAssessment: 'converging',
        reasoning: 'Experts agree on core design.',
      };

      messageService.findBySession.mockResolvedValue([
        { expertName: 'Alice', content: 'I propose REST.', role: 'ASSISTANT', roundNumber: 1 },
        { expertName: 'Bob', content: 'REST works for me.', role: 'ASSISTANT', roundNumber: 1 },
      ] as any);

      mockDriver.chat.mockResolvedValue({
        content: JSON.stringify(evaluationJson),
        model: 'claude-sonnet-4-20250514',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      prisma.consensusEvaluation.create.mockResolvedValue({
        id: 'eval-1',
        sessionId,
        roundNumber: 1,
        ...evaluationJson,
        evaluatedAt: new Date(),
      } as any);

      const result = await service.evaluateConsensus(sessionId, session as any, experts as any, 1);

      expect(result.convergenceScore).toBe(0.85);
      expect(result.consensusReached).toBe(true);
      expect(result.progressAssessment).toBe('converging');
      expect(prisma.consensusEvaluation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId,
          roundNumber: 1,
          convergenceScore: 0.85,
          consensusReached: true,
        }),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discussion.consensus.evaluation',
        expect.objectContaining({ sessionId }),
      );
    });

    it('should handle malformed JSON from LLM gracefully', async () => {
      messageService.findBySession.mockResolvedValue([
        { expertName: 'Alice', content: 'I propose REST.', role: 'ASSISTANT', roundNumber: 1 },
      ] as any);

      mockDriver.chat.mockResolvedValue({
        content: 'This is not valid JSON at all',
        model: 'claude-sonnet-4-20250514',
        finishReason: 'stop',
      });

      const result = await service.evaluateConsensus(sessionId, session as any, experts as any, 1);

      expect(result.convergenceScore).toBe(0);
      expect(result.consensusReached).toBe(false);
      expect(result.progressAssessment).toBe('stalled');
    });
  });
});
