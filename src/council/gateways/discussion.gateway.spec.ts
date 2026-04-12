import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DiscussionGateway } from './discussion.gateway';
import { CouncilService } from '../council.service';
import { ComparisonService } from '../comparison.service';
import { SessionService } from '../../session/session.service';
import { AuthService } from '../../common/auth/auth.service';

describe('DiscussionGateway', () => {
  let gateway: DiscussionGateway;
  let councilService: CouncilService;
  let comparisonService: ComparisonService;
  let sessionService: SessionService;

  const mockClient = {
    id: 'socket-1',
    data: { user: { sessionId: 'session-1', userId: 'user-1' } },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    handshake: {
      auth: { token: 'valid-token' },
      headers: {},
    },
  };

  const mockServer = {
    use: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionGateway,
        {
          provide: CouncilService,
          useValue: {
            startDiscussion: jest.fn().mockResolvedValue(undefined),
            queueIntervention: jest.fn().mockResolvedValue(true),
            pauseDiscussion: jest.fn().mockResolvedValue(undefined),
            resumeDiscussion: jest.fn().mockResolvedValue(undefined),
            stopDiscussion: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ComparisonService,
          useValue: {
            startComparison: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SessionService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 'session-1',
              type: 'DISCUSSION',
              status: 'PENDING',
            }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            verifyToken: jest.fn().mockReturnValue({ sessionId: 'session-1', userId: 'user-1' }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            on: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<DiscussionGateway>(DiscussionGateway);
    councilService = module.get<CouncilService>(CouncilService);
    comparisonService = module.get<ComparisonService>(ComparisonService);
    sessionService = module.get<SessionService>(SessionService);

    // Inject mock server
    (gateway as any).server = mockServer;
  });

  describe('handleConnection', () => {
    it('joins client to session:<sessionId> room on connection', () => {
      gateway.handleConnection(mockClient as any);

      expect(mockClient.join).toHaveBeenCalledWith('session:session-1');
    });
  });

  describe('handleDisconnect', () => {
    it('cleans up without throwing when client disconnects', () => {
      // First connect so there is something to clean up
      gateway.handleConnection(mockClient as any);

      expect(() => gateway.handleDisconnect(mockClient as any)).not.toThrow();
    });
  });

  describe('handleStartDiscussion', () => {
    it('calls councilService.startDiscussion for DISCUSSION type session', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue({
        id: 'session-1',
        type: 'DISCUSSION',
        status: 'PENDING',
      });

      await gateway.handleStartDiscussion(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      // startDiscussion is called in a fire-and-forget catch chain; wait a tick
      await Promise.resolve();

      expect(councilService.startDiscussion).toHaveBeenCalledWith('session-1');
      expect(comparisonService.startComparison).not.toHaveBeenCalled();
    });

    it('calls comparisonService.startComparison for COMPARISON type session', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue({
        id: 'session-1',
        type: 'COMPARISON',
        status: 'PENDING',
      });

      await gateway.handleStartDiscussion(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      await Promise.resolve();

      expect(comparisonService.startComparison).toHaveBeenCalledWith('session-1');
      expect(councilService.startDiscussion).not.toHaveBeenCalled();
    });
  });

  describe('handleIntervention', () => {
    it('calls councilService.queueIntervention with content', async () => {
      await gateway.handleIntervention(
        { sessionId: 'session-1', content: 'My intervention' },
        mockClient as any,
      );

      expect(councilService.queueIntervention).toHaveBeenCalledWith(
        'session-1',
        'My intervention',
        'user-1',
      );
    });

    it('emits error when content is empty', async () => {
      await gateway.handleIntervention(
        { sessionId: 'session-1', content: '   ' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        error: 'Invalid intervention content',
      });
      expect(councilService.queueIntervention).not.toHaveBeenCalled();
    });
  });

  describe('handlePauseDiscussion', () => {
    it('calls councilService.pauseDiscussion', async () => {
      await gateway.handlePauseDiscussion(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      expect(councilService.pauseDiscussion).toHaveBeenCalledWith('session-1');
    });
  });

  describe('handleResumeDiscussion', () => {
    it('calls councilService.resumeDiscussion', async () => {
      await gateway.handleResumeDiscussion(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      expect(councilService.resumeDiscussion).toHaveBeenCalledWith('session-1');
    });
  });

  describe('handleStopDiscussion', () => {
    it('calls councilService.stopDiscussion', async () => {
      await gateway.handleStopDiscussion(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      expect(councilService.stopDiscussion).toHaveBeenCalledWith('session-1');
    });
  });

  describe('handleJoinSession', () => {
    it('joins room and emits joined-session', async () => {
      await gateway.handleJoinSession(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      expect(mockClient.join).toHaveBeenCalledWith('session:session-1');
      expect(mockClient.emit).toHaveBeenCalledWith('joined-session', { sessionId: 'session-1' });
    });
  });

  describe('handleLeaveSession', () => {
    it('leaves room and emits left-session', async () => {
      await gateway.handleLeaveSession(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      expect(mockClient.leave).toHaveBeenCalledWith('session:session-1');
      expect(mockClient.emit).toHaveBeenCalledWith('left-session', { sessionId: 'session-1' });
    });
  });
});
