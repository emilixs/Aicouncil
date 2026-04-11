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
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
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
      // Legacy sessions created before the type field was added
      const session = makeSession(); // no type field
      sessionService.findOne.mockResolvedValue(session);

      const returnedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
      });
      councilService.startDiscussion.mockResolvedValue(returnedSession);

      await controller.startDiscussion(sessionId);

      expect(councilService.startDiscussion).toHaveBeenCalledWith(sessionId);
      expect(comparisonService.startComparison).not.toHaveBeenCalled();
    });
  });
});
