import { Test, TestingModule } from '@nestjs/testing';
import { SessionStatus, DriverType } from '@prisma/client';
import { CouncilController } from './council.controller';
import { CouncilService } from './council.service';
import { ComparisonService } from './comparison.service';
import { SessionService } from '../session/session.service';
import { SessionResponseDto } from '../session/dto/session-response.dto';

describe('CouncilController', () => {
  let controller: CouncilController;
  let councilService: jest.Mocked<CouncilService>;
  let comparisonService: jest.Mocked<ComparisonService>;
  let sessionService: jest.Mocked<SessionService>;

  const sessionId = 'test-session-id';

  const makeSession = (overrides: Record<string, any> = {}): SessionResponseDto => {
    return new SessionResponseDto({
      id: sessionId,
      problemStatement: 'Test problem',
      status: SessionStatus.PENDING,
      statusDisplay: 'pending',
      maxMessages: 20,
      consensusReached: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      experts: [
        {
          id: 'expert-1',
          name: 'Expert 1',
          specialty: 'Testing',
          driverType: DriverType.OPENAI,
          config: { model: 'gpt-4' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      ...overrides,
    } as any);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouncilController],
      providers: [
        {
          provide: CouncilService,
          useValue: {
            startDiscussion: jest.fn(),
            pauseDiscussion: jest.fn(),
            resumeDiscussion: jest.fn(),
            stopDiscussion: jest.fn(),
          },
        },
        {
          provide: ComparisonService,
          useValue: {
            startComparison: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CouncilController>(CouncilController);
    councilService = module.get(CouncilService);
    comparisonService = module.get(ComparisonService);
    sessionService = module.get(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /sessions/:id/start', () => {
    it('should call CouncilService.startDiscussion for DISCUSSION type sessions', async () => {
      const session = makeSession({ type: 'DISCUSSION' });
      sessionService.findOne.mockResolvedValue(session);

      const returnedSession = makeSession({
        status: SessionStatus.ACTIVE,
        statusDisplay: 'active',
        type: 'DISCUSSION',
      });
      councilService.startDiscussion.mockResolvedValue(returnedSession);

      const result = await controller.startDiscussion(sessionId);

      expect(councilService.startDiscussion).toHaveBeenCalledWith(sessionId);
      expect(comparisonService.startComparison).not.toHaveBeenCalled();
      expect(result.status).toBe(SessionStatus.ACTIVE);
    });

    it('should call ComparisonService.startComparison for COMPARISON type sessions', async () => {
      const session = makeSession({ type: 'COMPARISON' });
      sessionService.findOne.mockResolvedValue(session);
      comparisonService.startComparison.mockResolvedValue(undefined);

      await controller.startDiscussion(sessionId);

      expect(comparisonService.startComparison).toHaveBeenCalledWith(sessionId);
      expect(councilService.startDiscussion).not.toHaveBeenCalled();
    });

    it('should default to DISCUSSION when session has no type field', async () => {
      const session = makeSession();
      sessionService.findOne.mockResolvedValue(session);

      const returnedSession = makeSession({
        status: SessionStatus.ACTIVE,
        statusDisplay: 'active',
      });
      councilService.startDiscussion.mockResolvedValue(returnedSession);

      await controller.startDiscussion(sessionId);

      expect(councilService.startDiscussion).toHaveBeenCalledWith(sessionId);
      expect(comparisonService.startComparison).not.toHaveBeenCalled();
    });
  });

  describe('POST /sessions/:id/pause', () => {
    it('should call councilService.pauseDiscussion and return session', async () => {
      councilService.pauseDiscussion.mockResolvedValue(undefined);
      const pausedSession = makeSession({ status: SessionStatus.PAUSED });
      sessionService.findOne.mockResolvedValue(pausedSession);

      const result = await controller.pauseDiscussion(sessionId);

      expect(councilService.pauseDiscussion).toHaveBeenCalledWith(sessionId);
      expect(sessionService.findOne).toHaveBeenCalledWith(sessionId);
      expect(result.status).toBe(SessionStatus.PAUSED);
    });
  });

  describe('POST /sessions/:id/resume', () => {
    it('should call councilService.resumeDiscussion and return session', async () => {
      councilService.resumeDiscussion.mockResolvedValue(undefined);
      const activeSession = makeSession({ status: SessionStatus.ACTIVE });
      sessionService.findOne.mockResolvedValue(activeSession);

      const result = await controller.resumeDiscussion(sessionId);

      expect(councilService.resumeDiscussion).toHaveBeenCalledWith(sessionId);
      expect(sessionService.findOne).toHaveBeenCalledWith(sessionId);
      expect(result.status).toBe(SessionStatus.ACTIVE);
    });
  });

  describe('POST /sessions/:id/stop', () => {
    it('should call councilService.stopDiscussion and return session', async () => {
      councilService.stopDiscussion.mockResolvedValue(undefined);
      const cancelledSession = makeSession({ status: SessionStatus.CANCELLED });
      sessionService.findOne.mockResolvedValue(cancelledSession);

      const result = await controller.stopDiscussion(sessionId);

      expect(councilService.stopDiscussion).toHaveBeenCalledWith(sessionId);
      expect(sessionService.findOne).toHaveBeenCalledWith(sessionId);
      expect(result.status).toBe(SessionStatus.CANCELLED);
    });
  });
});
