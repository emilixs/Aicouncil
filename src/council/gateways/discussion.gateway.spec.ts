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
              statusDisplay: 'pending',
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

    it('emits intervention-error when content is empty', async () => {
      await gateway.handleIntervention(
        { sessionId: 'session-1', content: '   ' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('intervention-error', {
        message: 'Invalid intervention content',
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

  describe('afterInit - auth middleware', () => {
    it('registers middleware on the server', () => {
      gateway.afterInit(mockServer as any);

      expect(mockServer.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('authenticates via handshake.auth.token', async () => {
      const authService = (gateway as any).authService;
      gateway.afterInit(mockServer as any);

      const middleware = mockServer.use.mock.calls[0][0];
      const socket = {
        handshake: { auth: { token: 'valid-token' }, headers: {} },
        data: {},
      };
      const next = jest.fn();

      await middleware(socket, next);

      expect(authService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(next).toHaveBeenCalledWith();
    });

    it('authenticates via Authorization bearer header as fallback', async () => {
      const authService = (gateway as any).authService;
      gateway.afterInit(mockServer as any);

      const middleware = mockServer.use.mock.calls[0][0];
      const socket = {
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-token' },
        },
        data: {},
      };
      const next = jest.fn();

      await middleware(socket, next);

      expect(authService.verifyToken).toHaveBeenCalledWith('header-token');
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects connection when no token is provided', async () => {
      gateway.afterInit(mockServer as any);

      const middleware = mockServer.use.mock.calls[0][0];
      const socket = {
        handshake: { auth: {}, headers: {} },
        data: {},
      };
      const next = jest.fn();

      await middleware(socket, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Unauthorized: No token provided',
      }));
    });

    it('rejects connection when token verification returns null', async () => {
      const authService = (gateway as any).authService;
      authService.verifyToken.mockReturnValue(null);
      gateway.afterInit(mockServer as any);

      const middleware = mockServer.use.mock.calls[0][0];
      const socket = {
        handshake: { auth: { token: 'invalid' }, headers: {} },
        data: {},
      };
      const next = jest.fn();

      await middleware(socket, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Unauthorized: Invalid token',
      }));
    });

    it('rejects connection when token verification throws', async () => {
      const authService = (gateway as any).authService;
      authService.verifyToken.mockImplementation(() => {
        throw new Error('verification failed');
      });
      gateway.afterInit(mockServer as any);

      const middleware = mockServer.use.mock.calls[0][0];
      const socket = {
        handshake: { auth: { token: 'bad' }, headers: {} },
        data: {},
      };
      const next = jest.fn();

      await middleware(socket, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Unauthorized: Token verification failed',
      }));
    });

    it('ignores non-bearer Authorization header', async () => {
      gateway.afterInit(mockServer as any);

      const middleware = mockServer.use.mock.calls[0][0];
      const socket = {
        handshake: {
          auth: {},
          headers: { authorization: 'Basic dXNlcjpwYXNz' },
        },
        data: {},
      };
      const next = jest.fn();

      await middleware(socket, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Unauthorized: No token provided',
      }));
    });
  });

  describe('handleConnection - edge cases', () => {
    it('disconnects client with no user data', () => {
      const noAuthClient = {
        id: 'socket-2',
        data: {},
        join: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      gateway.handleConnection(noAuthClient as any);

      expect(noAuthClient.disconnect).toHaveBeenCalled();
      expect(noAuthClient.join).not.toHaveBeenCalled();
    });

    it('emits connected event with sessionId and status', async () => {
      await gateway.handleConnection(mockClient as any);

      expect(mockClient.emit).toHaveBeenCalledWith('connected', { sessionId: 'session-1', status: 'pending' });
    });

    it('emits connected with active status when session is active', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue({
        id: 'session-1',
        type: 'DISCUSSION',
        status: 'ACTIVE',
        statusDisplay: 'active',
      });

      await gateway.handleConnection(mockClient as any);

      expect(mockClient.emit).toHaveBeenCalledWith('connected', { sessionId: 'session-1', status: 'active' });
    });

    it('emits connected with paused status when session is paused', async () => {
      (sessionService.findOne as jest.Mock).mockResolvedValue({
        id: 'session-1',
        type: 'DISCUSSION',
        status: 'PAUSED',
        statusDisplay: 'paused',
      });

      await gateway.handleConnection(mockClient as any);

      expect(mockClient.emit).toHaveBeenCalledWith('connected', { sessionId: 'session-1', status: 'paused' });
    });

    it('emits connected without status when session lookup fails', async () => {
      (sessionService.findOne as jest.Mock).mockRejectedValue(new Error('not found'));

      await gateway.handleConnection(mockClient as any);

      expect(mockClient.emit).toHaveBeenCalledWith('connected', { sessionId: 'session-1' });
    });

    it('tracks subscription for connected client', () => {
      gateway.handleConnection(mockClient as any);

      const subs = (gateway as any).sessionSubscriptions.get('session-1');
      expect(subs).toBeDefined();
      expect(subs.has('socket-1')).toBe(true);
    });
  });

  describe('handleDisconnect - subscription cleanup', () => {
    it('removes client from subscription tracking', () => {
      gateway.handleConnection(mockClient as any);
      gateway.handleDisconnect(mockClient as any);

      const subs = (gateway as any).sessionSubscriptions.get('session-1');
      expect(subs).toBeUndefined();
    });

    it('handles disconnect when client has no user data', () => {
      const noAuthClient = { id: 'socket-3', data: {} };

      expect(() => gateway.handleDisconnect(noAuthClient as any)).not.toThrow();
    });
  });

  describe('handleStartDiscussion - session ID mismatch', () => {
    it('emits error when sessionId does not match client session', async () => {
      await gateway.handleStartDiscussion(
        { sessionId: 'different-session' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Session ID mismatch',
      });
    });
  });

  describe('handleIntervention - edge cases', () => {
    it('emits intervention-error when session ID mismatches', async () => {
      await gateway.handleIntervention(
        { sessionId: 'wrong-session', content: 'text' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('intervention-error', {
        message: 'Session ID mismatch',
      });
    });

    it('emits intervention-error when client has no user data', async () => {
      const noAuthClient = {
        id: 'socket-4',
        data: {},
        emit: jest.fn(),
      };

      await gateway.handleIntervention(
        { sessionId: 'session-1', content: 'text' },
        noAuthClient as any,
      );

      expect(noAuthClient.emit).toHaveBeenCalledWith('intervention-error', {
        message: 'Unauthorized',
      });
    });

    it('emits intervention-error when queueIntervention returns false', async () => {
      (councilService.queueIntervention as jest.Mock).mockResolvedValue(false);

      await gateway.handleIntervention(
        { sessionId: 'session-1', content: 'valid content' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('intervention-error', {
        message: 'Intervention rejected: session not ACTIVE or failed to queue',
      });
    });

    it('emits intervention-queued on success', async () => {
      (councilService.queueIntervention as jest.Mock).mockResolvedValue(true);

      await gateway.handleIntervention(
        { sessionId: 'session-1', content: 'valid content' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('intervention-queued', {
        sessionId: 'session-1',
      });
    });

    it('handles null content', async () => {
      await gateway.handleIntervention(
        { sessionId: 'session-1', content: null as any },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('intervention-error', {
        message: 'Invalid intervention content',
      });
    });
  });

  describe('handlePauseDiscussion - session ID mismatch', () => {
    it('emits error when session ID mismatches', async () => {
      await gateway.handlePauseDiscussion(
        { sessionId: 'wrong-session' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Session ID mismatch',
      });
    });

    it('emits error when councilService throws', async () => {
      (councilService.pauseDiscussion as jest.Mock).mockRejectedValue(
        new Error('not running'),
      );

      await gateway.handlePauseDiscussion(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'not running',
      });
    });
  });

  describe('handleResumeDiscussion - session ID mismatch', () => {
    it('emits error when session ID mismatches', async () => {
      await gateway.handleResumeDiscussion(
        { sessionId: 'wrong-session' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Session ID mismatch',
      });
    });

    it('emits error when councilService throws', async () => {
      (councilService.resumeDiscussion as jest.Mock).mockRejectedValue(
        new Error('not paused'),
      );

      await gateway.handleResumeDiscussion(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'not paused',
      });
    });
  });

  describe('handleStopDiscussion - session ID mismatch', () => {
    it('emits error when session ID mismatches', async () => {
      await gateway.handleStopDiscussion(
        { sessionId: 'wrong-session' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Session ID mismatch',
      });
    });

    it('emits error when councilService throws', async () => {
      (councilService.stopDiscussion as jest.Mock).mockRejectedValue(
        new Error('not active'),
      );

      await gateway.handleStopDiscussion(
        { sessionId: 'session-1' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'not active',
      });
    });
  });

  describe('handleJoinSession - session ID mismatch', () => {
    it('emits error when session ID mismatches', async () => {
      await gateway.handleJoinSession(
        { sessionId: 'wrong-session' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Session ID mismatch',
      });
    });
  });

  describe('handleLeaveSession - session ID mismatch', () => {
    it('emits error when session ID mismatches', async () => {
      await gateway.handleLeaveSession(
        { sessionId: 'wrong-session' },
        mockClient as any,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Session ID mismatch',
      });
    });
  });

  describe('onModuleInit - event listeners', () => {
    it('registers all discussion and comparison event listeners', () => {
      const eventEmitter = (gateway as any).eventEmitter;

      gateway.onModuleInit();

      expect(eventEmitter.on).toHaveBeenCalledTimes(18);
    });

    it('broadcasts MESSAGE_CREATED to session room', () => {
      const eventEmitter = (gateway as any).eventEmitter;
      gateway.onModuleInit();

      const messageHandler = eventEmitter.on.mock.calls.find(
        (call: any[]) => call[0] === 'discussion.message.created',
      );
      if (messageHandler) {
        messageHandler[1]({
          sessionId: 'session-1',
          message: { id: 'msg-1', content: 'hello' },
        });

        expect(mockServer.to).toHaveBeenCalledWith('session:session-1');
        expect(mockServer.emit).toHaveBeenCalledWith('message', {
          id: 'msg-1',
          content: 'hello',
        });
      }
    });

    it('broadcasts SESSION_ENDED to session room', () => {
      const eventEmitter = (gateway as any).eventEmitter;
      gateway.onModuleInit();

      const endedHandler = eventEmitter.on.mock.calls.find(
        (call: any[]) => call[0] === 'discussion.session.ended',
      );
      if (endedHandler) {
        endedHandler[1]({
          sessionId: 'session-1',
          reason: 'consensus',
          consensusReached: true,
          messageCount: 10,
        });

        expect(mockServer.to).toHaveBeenCalledWith('session:session-1');
        expect(mockServer.emit).toHaveBeenCalledWith('session-ended', {
          reason: 'consensus',
          consensusReached: true,
          messageCount: 10,
        });
      }
    });

    it('broadcasts ERROR to session room', () => {
      const eventEmitter = (gateway as any).eventEmitter;
      gateway.onModuleInit();

      const errorHandler = eventEmitter.on.mock.calls.find(
        (call: any[]) => call[0] === 'discussion.error',
      );
      if (errorHandler) {
        errorHandler[1]({
          sessionId: 'session-1',
          error: 'something failed',
          expertId: 'expert-1',
        });

        expect(mockServer.to).toHaveBeenCalledWith('session:session-1');
        expect(mockServer.emit).toHaveBeenCalledWith('error', {
          message: 'something failed',
          expertId: 'expert-1',
        });
      }
    });
  });
});
