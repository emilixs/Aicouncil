import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
          config: { model: 'gpt-5.4-mini' },
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

      await controller.startDiscussion(sessionId);

      expect(councilService.startDiscussion).toHaveBeenCalledWith(sessionId);
      expect(comparisonService.startComparison).not.toHaveBeenCalled();
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
    it('should call CouncilService.pauseDiscussion and return session', async () => {
      const session = makeSession({ status: SessionStatus.PAUSED });
      councilService.pauseDiscussion.mockResolvedValue(undefined);
      sessionService.findOne.mockResolvedValue(session);

      const result = await controller.pauseDiscussion(sessionId);

      expect(councilService.pauseDiscussion).toHaveBeenCalledWith(sessionId);
      expect(sessionService.findOne).toHaveBeenCalledWith(sessionId);
      expect(result).toBe(session);
    });
  });

  describe('POST /sessions/:id/resume', () => {
    it('should call CouncilService.resumeDiscussion and return session', async () => {
      const session = makeSession({ status: SessionStatus.ACTIVE });
      councilService.resumeDiscussion.mockResolvedValue(undefined);
      sessionService.findOne.mockResolvedValue(session);

      const result = await controller.resumeDiscussion(sessionId);

      expect(councilService.resumeDiscussion).toHaveBeenCalledWith(sessionId);
      expect(sessionService.findOne).toHaveBeenCalledWith(sessionId);
      expect(result).toBe(session);
    });
  });

  describe('POST /sessions/:id/stop', () => {
    it('should call CouncilService.stopDiscussion and return session', async () => {
      const session = makeSession({ status: SessionStatus.CANCELLED });
      councilService.stopDiscussion.mockResolvedValue(undefined);
      sessionService.findOne.mockResolvedValue(session);

      const result = await controller.stopDiscussion(sessionId);

      expect(councilService.stopDiscussion).toHaveBeenCalledWith(sessionId);
      expect(sessionService.findOne).toHaveBeenCalledWith(sessionId);
      expect(result).toBe(session);
    });
  });

  describe('invalid state transitions', () => {
    it('should propagate BadRequestException when pausing a non-running session', async () => {
      councilService.pauseDiscussion.mockRejectedValue(
        new BadRequestException('Cannot pause session'),
      );

      await expect(controller.pauseDiscussion(sessionId)).rejects.toThrow(BadRequestException);
    });

    it('should propagate BadRequestException when resuming a non-paused session', async () => {
      councilService.resumeDiscussion.mockRejectedValue(
        new BadRequestException('Cannot resume session'),
      );

      await expect(controller.resumeDiscussion(sessionId)).rejects.toThrow(BadRequestException);
    });

    it('should propagate BadRequestException when stopping an inactive session', async () => {
      councilService.stopDiscussion.mockRejectedValue(
        new BadRequestException('Cannot stop session'),
      );

      await expect(controller.stopDiscussion(sessionId)).rejects.toThrow(BadRequestException);
    });
  });
});
