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

  describe('generateSummary', () => {
    const sessionId = 'session-1';
    const session = { problemStatement: 'How should we design the API?' };
    const experts = [
      { id: 'e1', name: 'Alice', specialty: 'Backend' },
      { id: 'e2', name: 'Bob', specialty: 'Frontend' },
    ];

    it('should generate and store a discussion summary', async () => {
      const summaryJson = {
        executiveSummary: 'Experts agreed on REST API design.',
        decisions: ['Use REST', 'JWT for auth'],
        actionItems: [{ description: 'Draft API spec', priority: 'high', suggestedOwner: 'Alice' }],
        keyArguments: [
          { expertName: 'Alice', position: 'REST is simpler' },
          { expertName: 'Bob', position: 'Agreed, REST works for frontend' },
        ],
        openQuestions: [],
      };

      messageService.findBySession.mockResolvedValue([
        { expertName: 'Alice', content: 'I propose REST.', role: 'ASSISTANT' },
        { expertName: 'Bob', content: 'Agreed.', role: 'ASSISTANT' },
      ] as any);

      mockDriver.chat.mockResolvedValue({
        content: JSON.stringify(summaryJson),
        model: 'claude-sonnet-4-20250514',
        finishReason: 'stop',
      });

      prisma.discussionOutcome.create.mockResolvedValue({
        id: 'outcome-1',
        sessionId,
        ...summaryJson,
        finalEvaluation: null,
        generatedAt: new Date(),
        generatedBy: 'claude-sonnet-4-20250514',
      } as any);

      const result = await service.generateSummary(
        sessionId,
        session as any,
        experts as any,
        'consensus',
      );

      expect(result!.executiveSummary).toBe('Experts agreed on REST API design.');
      expect(result!.decisions).toHaveLength(2);
      expect(prisma.discussionOutcome.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discussion.summary',
        expect.objectContaining({ sessionId }),
      );
    });

    it('should use two-pass summarization for long discussions', async () => {
      const manyMessages = Array.from({ length: 60 }, (_, i) => ({
        expertName: i % 2 === 0 ? 'Alice' : 'Bob',
        content: `Message ${i} with substantial content that contributes to length.`,
        role: 'ASSISTANT',
      }));

      messageService.findBySession.mockResolvedValue(manyMessages as any);

      const summaryJson = {
        executiveSummary: 'Long discussion summary.',
        decisions: ['Decision 1'],
        actionItems: [],
        keyArguments: [{ expertName: 'Alice', position: 'Position A' }],
        openQuestions: ['Question 1'],
      };

      mockDriver.chat.mockResolvedValue({
        content: JSON.stringify(summaryJson),
        model: 'claude-sonnet-4-20250514',
        finishReason: 'stop',
      });

      prisma.discussionOutcome.create.mockResolvedValue({
        id: 'outcome-2',
        sessionId,
        ...summaryJson,
        finalEvaluation: null,
        generatedAt: new Date(),
        generatedBy: 'claude-sonnet-4-20250514',
      } as any);

      await service.generateSummary(sessionId, session as any, experts as any, 'max_messages');

      expect(mockDriver.chat.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('createPoll', () => {
    it('should create a poll and emit event', async () => {
      prisma.poll.create.mockResolvedValue({
        id: 'poll-1',
        sessionId: 'session-1',
        proposal: 'Use REST for the API',
        createdBy: 'user',
        status: 'open',
        createdAt: new Date(),
        closedAt: null,
      } as any);

      const result = await service.createPoll('session-1', 'Use REST for the API', 'user');

      expect(result.id).toBe('poll-1');
      expect(result.proposal).toBe('Use REST for the API');
      expect(prisma.poll.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          proposal: 'Use REST for the API',
          createdBy: 'user',
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discussion.poll.created',
        expect.objectContaining({ sessionId: 'session-1', pollId: 'poll-1' }),
      );
    });
  });

  describe('extractVote', () => {
    it('should extract a structured vote from expert response', async () => {
      const voteJson = { vote: 'agree', reasoning: 'REST is the right choice.' };

      mockDriver.chat.mockResolvedValue({
        content: JSON.stringify(voteJson),
        model: 'claude-sonnet-4-20250514',
        finishReason: 'stop',
      });

      prisma.pollVote.create.mockResolvedValue({
        id: 'vote-1',
        pollId: 'poll-1',
        expertId: 'e1',
        vote: 'agree',
        reasoning: 'REST is the right choice.',
        createdAt: new Date(),
      } as any);

      const result = await service.extractVote(
        'poll-1',
        'Use REST for the API',
        'e1',
        'Alice',
        'session-1',
        'Yes, I fully support using REST.',
      );

      expect(result.vote).toBe('agree');
      expect(prisma.pollVote.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discussion.poll.vote',
        expect.objectContaining({ pollId: 'poll-1', expertId: 'e1', vote: 'agree' }),
      );
    });
  });

  describe('closePoll', () => {
    it('should close poll and emit results', async () => {
      prisma.poll.update.mockResolvedValue({
        id: 'poll-1',
        sessionId: 'session-1',
        status: 'closed',
        closedAt: new Date(),
        votes: [
          { expertId: 'e1', vote: 'agree', reasoning: 'Good idea' },
          { expertId: 'e2', vote: 'disagree', reasoning: 'Prefer GraphQL' },
        ],
      } as any);

      const result = await service.closePoll('poll-1', 'session-1');

      expect(result.status).toBe('closed');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discussion.poll.closed',
        expect.objectContaining({
          pollId: 'poll-1',
          results: { agree: 1, disagree: 1, agreeWithReservations: 0 },
        }),
      );
    });
  });

  describe('hasAutoPolledSession', () => {
    it('should return false when no system polls exist', async () => {
      prisma.poll.findFirst.mockResolvedValue(null);
      const result = await service.hasAutoPolledSession('session-1');
      expect(result).toBe(false);
    });

    it('should return true when a system poll exists', async () => {
      prisma.poll.findFirst.mockResolvedValue({ id: 'poll-1' } as any);
      const result = await service.hasAutoPolledSession('session-1');
      expect(result).toBe(true);
    });
  });

  describe('checkStallDetection', () => {
    it('should emit stalled event after 2 consecutive stalled rounds', () => {
      const stalledEval = {
        convergenceScore: 0.4,
        consensusReached: false,
        areasOfAgreement: [],
        areasOfDisagreement: ['Everything'],
        progressAssessment: 'stalled' as const,
        reasoning: 'No progress.',
      };

      service.checkStallDetection('s1', stalledEval);
      expect(eventEmitter.emit).not.toHaveBeenCalled();

      service.checkStallDetection('s1', stalledEval);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discussion.stalled',
        expect.objectContaining({ sessionId: 's1', stalledRounds: 2 }),
      );
    });

    it('should auto-end after 3 consecutive stalled rounds', () => {
      const stalledEval = {
        convergenceScore: 0.3,
        consensusReached: false,
        areasOfAgreement: [],
        areasOfDisagreement: [],
        progressAssessment: 'stalled' as const,
        reasoning: 'Going in circles.',
      };

      service.checkStallDetection('s2', stalledEval);
      service.checkStallDetection('s2', stalledEval);
      const result = service.checkStallDetection('s2', stalledEval);

      expect(result.stalled).toBe(true);
      expect(result.stalledRounds).toBe(3);
    });

    it('should reset stall count when progress resumes', () => {
      const stalledEval = {
        convergenceScore: 0.4,
        consensusReached: false,
        areasOfAgreement: [],
        areasOfDisagreement: [],
        progressAssessment: 'stalled' as const,
        reasoning: 'Stuck.',
      };
      const convergingEval = {
        convergenceScore: 0.6,
        consensusReached: false,
        areasOfAgreement: ['Point A'],
        areasOfDisagreement: [],
        progressAssessment: 'converging' as const,
        reasoning: 'Making progress.',
      };

      service.checkStallDetection('s3', stalledEval);
      service.checkStallDetection('s3', stalledEval);
      service.checkStallDetection('s3', convergingEval);
      const result = service.checkStallDetection('s3', stalledEval);

      expect(result.stalledRounds).toBe(1);
    });
  });
});
