import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DiscussionGateway } from './discussion.gateway';
import { CouncilService } from '../council.service';
import { AuthService } from '../../common/auth/auth.service';
import { DISCUSSION_EVENTS } from '../events/discussion.events';

function makeClient(overrides: Partial<{
  id: string;
  sessionId: string;
  userId: string;
}> = {}) {
  const { id = 'client-1', sessionId = 'session-abc', userId = 'user-1' } = overrides;
  return {
    id,
    data: {
      user: { sessionId, userId },
    },
    handshake: {
      auth: { token: 'valid-token' },
      headers: {},
    },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

function makeMockServer() {
  const room = { emit: jest.fn() };
  return {
    use: jest.fn(),
    to: jest.fn().mockReturnValue(room),
    _room: room,
  };
}

describe('DiscussionGateway', () => {
  let gateway: DiscussionGateway;
  let councilService: jest.Mocked<CouncilService>;
  let authService: jest.Mocked<AuthService>;
  let eventEmitter: EventEmitter2;
  let mockServer: ReturnType<typeof makeMockServer>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionGateway,
        {
          provide: CouncilService,
          useValue: {
            startDiscussion: jest.fn().mockResolvedValue(undefined),
            queueIntervention: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AuthService,
          useValue: {
            verifyToken: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: new EventEmitter2(),
        },
      ],
    }).compile();

    gateway = module.get<DiscussionGateway>(DiscussionGateway);
    councilService = module.get(CouncilService);
    authService = module.get(AuthService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    mockServer = makeMockServer();
    gateway.server = mockServer as any;
  });

  describe('handleConnection', () => {
    it('joins client to session room and tracks subscription', () => {
      const client = makeClient();
      gateway.handleConnection(client as any);

      expect(client.join).toHaveBeenCalledWith('session:session-abc');
      expect(client.emit).toHaveBeenCalledWith('connected', { sessionId: 'session-abc' });
    });

    it('disconnects client when user data is missing', () => {
      const client = makeClient();
      client.data.user = undefined as any;

      gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('tracks multiple clients for same session', () => {
      const client1 = makeClient({ id: 'c1' });
      const client2 = makeClient({ id: 'c2' });

      gateway.handleConnection(client1 as any);
      gateway.handleConnection(client2 as any);

      expect(client1.join).toHaveBeenCalledWith('session:session-abc');
      expect(client2.join).toHaveBeenCalledWith('session:session-abc');
    });
  });

  describe('handleDisconnect', () => {
    it('removes client from subscriptions on disconnect', () => {
      const client = makeClient();
      gateway.handleConnection(client as any);
      gateway.handleDisconnect(client as any);

      const client2 = makeClient({ id: 'c2' });
      gateway.handleConnection(client2 as any);
      expect(client2.join).toHaveBeenCalledWith('session:session-abc');
    });

    it('does not throw when client has no user data', () => {
      const client = makeClient();
      client.data.user = undefined as any;

      expect(() => gateway.handleDisconnect(client as any)).not.toThrow();
    });

    it('removes session entry when last subscriber disconnects', () => {
      const client = makeClient();
      gateway.handleConnection(client as any);
      gateway.handleDisconnect(client as any);
    });
  });

  describe('handleStartDiscussion', () => {
    it('starts discussion and emits discussion-started to room', async () => {
      const client = makeClient();
      await gateway.handleStartDiscussion({ sessionId: 'session-abc' }, client as any);

      expect(councilService.startDiscussion).toHaveBeenCalledWith('session-abc');
      expect(mockServer.to).toHaveBeenCalledWith('session:session-abc');
      expect(mockServer._room.emit).toHaveBeenCalledWith('discussion-started', { sessionId: 'session-abc' });
    });

    it('emits error when sessionId does not match client session', async () => {
      const client = makeClient({ sessionId: 'session-abc' });
      await gateway.handleStartDiscussion({ sessionId: 'session-other' }, client as any);

      expect(client.emit).toHaveBeenCalledWith('error', { error: 'Session ID mismatch' });
      expect(councilService.startDiscussion).not.toHaveBeenCalled();
    });

    it('broadcasts error to room when startDiscussion rejects', async () => {
      const client = makeClient();
      const rejection = new Error('boom');
      councilService.startDiscussion.mockReturnValue(Promise.reject(rejection));

      await gateway.handleStartDiscussion({ sessionId: 'session-abc' }, client as any);

      await Promise.resolve();

      expect(mockServer.to).toHaveBeenCalledWith('session:session-abc');
    });
  });

  describe('handleIntervention', () => {
    it('queues intervention and emits intervention-queued', async () => {
      const client = makeClient();
      councilService.queueIntervention.mockResolvedValue(true);

      await gateway.handleIntervention(
        { sessionId: 'session-abc', content: 'My point' },
        client as any,
      );

      expect(councilService.queueIntervention).toHaveBeenCalledWith(
        'session-abc',
        'My point',
        'user-1',
      );
      expect(client.emit).toHaveBeenCalledWith('intervention-queued', { sessionId: 'session-abc' });
    });

    it('emits error when sessionId mismatches', async () => {
      const client = makeClient({ sessionId: 'session-abc' });

      await gateway.handleIntervention(
        { sessionId: 'session-other', content: 'hello' },
        client as any,
      );

      expect(client.emit).toHaveBeenCalledWith('error', { error: 'Session ID mismatch' });
      expect(councilService.queueIntervention).not.toHaveBeenCalled();
    });

    it('emits error when content is empty string', async () => {
      const client = makeClient();

      await gateway.handleIntervention(
        { sessionId: 'session-abc', content: '   ' },
        client as any,
      );

      expect(client.emit).toHaveBeenCalledWith('error', { error: 'Invalid intervention content' });
    });

    it('emits error when content is missing', async () => {
      const client = makeClient();

      await gateway.handleIntervention(
        { sessionId: 'session-abc', content: '' },
        client as any,
      );

      expect(client.emit).toHaveBeenCalledWith('error', { error: 'Invalid intervention content' });
    });

    it('emits error when service rejects intervention', async () => {
      const client = makeClient();
      councilService.queueIntervention.mockResolvedValue(false);

      await gateway.handleIntervention(
        { sessionId: 'session-abc', content: 'My point' },
        client as any,
      );

      expect(client.emit).toHaveBeenCalledWith('error', {
        error: 'Intervention rejected: session not ACTIVE or failed to queue',
      });
    });
  });

  describe('handleJoinSession', () => {
    it('joins room and emits joined-session', async () => {
      const client = makeClient();

      await gateway.handleJoinSession({ sessionId: 'session-abc' }, client as any);

      expect(client.join).toHaveBeenCalledWith('session:session-abc');
      expect(client.emit).toHaveBeenCalledWith('joined-session', { sessionId: 'session-abc' });
    });

    it('emits error when sessionId mismatches', async () => {
      const client = makeClient({ sessionId: 'session-abc' });

      await gateway.handleJoinSession({ sessionId: 'wrong-session' }, client as any);

      expect(client.emit).toHaveBeenCalledWith('error', { error: 'Session ID mismatch' });
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleLeaveSession', () => {
    it('leaves room and emits left-session', async () => {
      const client = makeClient();
      gateway.handleConnection(client as any);

      await gateway.handleLeaveSession({ sessionId: 'session-abc' }, client as any);

      expect(client.leave).toHaveBeenCalledWith('session:session-abc');
      expect(client.emit).toHaveBeenCalledWith('left-session', { sessionId: 'session-abc' });
    });

    it('emits error when sessionId mismatches', async () => {
      const client = makeClient({ sessionId: 'session-abc' });

      await gateway.handleLeaveSession({ sessionId: 'wrong-session' }, client as any);

      expect(client.emit).toHaveBeenCalledWith('error', { error: 'Session ID mismatch' });
      expect(client.leave).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit event forwarding', () => {
    beforeEach(() => {
      gateway.onModuleInit();
    });

    it('broadcasts message event to session room', () => {
      const message = { id: 'm1', content: 'hello' } as any;
      eventEmitter.emit(DISCUSSION_EVENTS.MESSAGE_CREATED, { sessionId: 'session-abc', message });

      expect(mockServer.to).toHaveBeenCalledWith('session:session-abc');
      expect(mockServer._room.emit).toHaveBeenCalledWith('message', message);
    });

    it('broadcasts consensus-reached event to session room', () => {
      const finalMessage = { id: 'm2', content: 'consensus' } as any;
      eventEmitter.emit(DISCUSSION_EVENTS.CONSENSUS_REACHED, {
        sessionId: 'session-abc',
        consensusReached: true,
        finalMessage,
      });

      expect(mockServer.to).toHaveBeenCalledWith('session:session-abc');
      expect(mockServer._room.emit).toHaveBeenCalledWith('consensus-reached', { finalMessage });
    });

    it('broadcasts session-ended event to session room', () => {
      eventEmitter.emit(DISCUSSION_EVENTS.SESSION_ENDED, {
        sessionId: 'session-abc',
        consensusReached: false,
        reason: 'max_messages',
        messageCount: 10,
      });

      expect(mockServer.to).toHaveBeenCalledWith('session:session-abc');
      expect(mockServer._room.emit).toHaveBeenCalledWith('session-ended', {
        reason: 'max_messages',
        consensusReached: false,
        messageCount: 10,
      });
    });

    it('broadcasts error event to session room', () => {
      eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
        sessionId: 'session-abc',
        error: 'something went wrong',
        expertId: 'expert-1',
      });

      expect(mockServer.to).toHaveBeenCalledWith('session:session-abc');
      expect(mockServer._room.emit).toHaveBeenCalledWith('error', {
        error: 'something went wrong',
        expertId: 'expert-1',
      });
    });

    it('broadcasts expert-turn-start event to session room', () => {
      eventEmitter.emit(DISCUSSION_EVENTS.EXPERT_TURN_START, {
        sessionId: 'session-abc',
        expertId: 'expert-1',
        expertName: 'Alice',
        turnNumber: 3,
      });

      expect(mockServer.to).toHaveBeenCalledWith('session:session-abc');
      expect(mockServer._room.emit).toHaveBeenCalledWith('expert-turn-start', {
        sessionId: 'session-abc',
        expertId: 'expert-1',
        expertName: 'Alice',
        turnNumber: 3,
      });
    });
  });

  describe('afterInit auth middleware', () => {
    let middlewareFn: (socket: any, next: jest.Mock) => Promise<void>;

    beforeEach(() => {
      const captureServer = {
        use: jest.fn((fn) => { middlewareFn = fn; }),
      };
      gateway.afterInit(captureServer as any);
    });

    it('calls next() with no error for valid token', async () => {
      authService.verifyToken.mockReturnValue({ sessionId: 'session-abc', userId: 'user-1' });
      const next = jest.fn();
      const socket = {
        handshake: { auth: { token: 'valid-token' }, headers: {} },
        data: {},
      };

      await middlewareFn(socket, next);

      expect(authService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(socket.data).toEqual({ user: { sessionId: 'session-abc', userId: 'user-1' } });
      expect(next).toHaveBeenCalledWith();
    });

    it('calls next with error when no token provided', async () => {
      const next = jest.fn();
      const socket = {
        handshake: { auth: {}, headers: {} },
        data: {},
      };

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toMatch(/No token provided/);
    });

    it('calls next with error when token is invalid', async () => {
      authService.verifyToken.mockReturnValue(null);
      const next = jest.fn();
      const socket = {
        handshake: { auth: { token: 'bad-token' }, headers: {} },
        data: {},
      };

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toMatch(/Invalid token/);
    });

    it('extracts token from Authorization header as fallback', async () => {
      authService.verifyToken.mockReturnValue({ sessionId: 'session-abc', userId: 'user-1' });
      const next = jest.fn();
      const socket = {
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-token' },
        },
        data: {},
      };

      await middlewareFn(socket, next);

      expect(authService.verifyToken).toHaveBeenCalledWith('header-token');
      expect(next).toHaveBeenCalledWith();
    });

    it('calls next with error when verifyToken throws', async () => {
      authService.verifyToken.mockImplementation(() => { throw new Error('jwt error'); });
      const next = jest.fn();
      const socket = {
        handshake: { auth: { token: 'some-token' }, headers: {} },
        data: {},
      };

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toMatch(/Token verification failed/);
    });
  });
});
