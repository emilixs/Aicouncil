import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnModuleInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CouncilService } from '../council.service';
import { SessionService } from '../../session/session.service';
import { AuthService } from '../../common/auth/auth.service';
import { WsAuthGuard } from '../../common/auth/ws-auth.guard';
import {
  DISCUSSION_EVENTS,
  MessageCreatedEvent,
  ConsensusReachedEvent,
  SessionEndedEvent,
  ErrorEvent,
  ExpertTurnStartEvent,
} from '../events/discussion.events';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      sessionId: string;
      userId: string;
    };
  };
}

@WebSocketGateway({
  namespace: '/discussion',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class DiscussionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private sessionSubscriptions: Map<string, Set<string>> = new Map();

  constructor(
    private readonly councilService: CouncilService,
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  afterInit(server: Server) {
    // Register Socket.IO middleware for authentication
    server.use(async (socket: AuthenticatedSocket, next) => {
      try {
        // Extract token from auth field or Authorization header
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Unauthorized: No token provided'));
        }

        // Verify token
        const payload = await this.authService.verifyToken(token);

        if (!payload) {
          return next(new Error('Unauthorized: Invalid token'));
        }

        // Store user data in socket
        socket.data.user = {
          sessionId: payload.sessionId,
          userId: payload.userId,
        };

        next();
      } catch (error) {
        next(new Error('Unauthorized: Token verification failed'));
      }
    });
  }

  handleConnection(client: AuthenticatedSocket) {
    try {
      const { sessionId, userId } = client.data.user;

      // Auto-join client to session room
      const roomName = `session:${sessionId}`;
      client.join(roomName);

      // Track subscription
      if (!this.sessionSubscriptions.has(sessionId)) {
        this.sessionSubscriptions.set(sessionId, new Set());
      }
      this.sessionSubscriptions.get(sessionId).add(client.id);

      console.log(
        `Client ${client.id} (user: ${userId}) connected to session ${sessionId}`,
      );

      // Emit connected event to client
      client.emit('connected', { sessionId });
    } catch (error) {
      console.error('Error in handleConnection:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    try {
      const user = client.data.user;
      if (user) {
        const { sessionId } = user;

        // Cleanup tracking
        const subscribers = this.sessionSubscriptions.get(sessionId);
        if (subscribers) {
          subscribers.delete(client.id);
          if (subscribers.size === 0) {
            this.sessionSubscriptions.delete(sessionId);
          }
        }

        console.log(`Client ${client.id} disconnected from session ${sessionId}`);
      }
    } catch (error) {
      console.error('Error in handleDisconnect:', error);
    }
  }

  onModuleInit() {
    // Subscribe to CouncilService events and broadcast to session rooms

    this.eventEmitter.on(
      DISCUSSION_EVENTS.MESSAGE_CREATED,
      (event: MessageCreatedEvent) => {
        const roomName = `session:${event.sessionId}`;
        this.server.to(roomName).emit('message', event.message);
      },
    );

    this.eventEmitter.on(
      DISCUSSION_EVENTS.CONSENSUS_REACHED,
      (event: ConsensusReachedEvent) => {
        const roomName = `session:${event.sessionId}`;
        this.server.to(roomName).emit('consensus-reached', {
          finalMessage: event.finalMessage,
        });
      },
    );

    this.eventEmitter.on(
      DISCUSSION_EVENTS.SESSION_ENDED,
      (event: SessionEndedEvent) => {
        const roomName = `session:${event.sessionId}`;
        this.server.to(roomName).emit('session-ended', {
          reason: event.reason,
          consensusReached: event.consensusReached,
          messageCount: event.messageCount,
        });
      },
    );

    this.eventEmitter.on(DISCUSSION_EVENTS.ERROR, (event: ErrorEvent) => {
      const roomName = `session:${event.sessionId}`;
      this.server.to(roomName).emit('error', {
        error: event.error,
        expertId: event.expertId,
      });
    });

    this.eventEmitter.on(
      DISCUSSION_EVENTS.EXPERT_TURN_START,
      (event: ExpertTurnStartEvent) => {
        const roomName = `session:${event.sessionId}`;
        this.server.to(roomName).emit('expert-turn-start', {
          expertName: event.expertName,
          turnNumber: event.turnNumber,
        });
      },
    );

    console.log('DiscussionGateway event listeners registered');
  }

  @SubscribeMessage('start-discussion')
  @UseGuards(WsAuthGuard)
  async handleStartDiscussion(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { sessionId } = data;
      const userSessionId = client.data.user?.sessionId;

      // Validate sessionId matches client session
      if (sessionId !== userSessionId) {
        client.emit('error', {
          error: 'Session ID mismatch',
        });
        return;
      }

      // Start discussion in background (no await)
      this.councilService.startDiscussion(sessionId).catch((error) => {
        console.error('Error starting discussion:', error);
        const roomName = `session:${sessionId}`;
        this.server.to(roomName).emit('error', {
          error: error.message || 'Failed to start discussion',
        });
      });

      // Emit discussion-started to room
      const roomName = `session:${sessionId}`;
      this.server.to(roomName).emit('discussion-started', { sessionId });
    } catch (error) {
      console.error('Error in handleStartDiscussion:', error);
      client.emit('error', {
        error: error.message || 'Failed to start discussion',
      });
    }
  }

  @SubscribeMessage('intervention')
  @UseGuards(WsAuthGuard)
  async handleIntervention(
    @MessageBody() data: { sessionId: string; content: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { sessionId, content } = data;
      const { sessionId: userSessionId, userId } = client.data.user;

      // Validate sessionId matches client session
      if (sessionId !== userSessionId) {
        client.emit('error', {
          error: 'Session ID mismatch',
        });
        return;
      }

      // Validate content
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        client.emit('error', {
          error: 'Invalid intervention content',
        });
        return;
      }

      // Queue intervention
      await this.councilService.queueIntervention(sessionId, content, userId);

      // Emit intervention-queued to client
      client.emit('intervention-queued', { sessionId });
    } catch (error) {
      console.error('Error in handleIntervention:', error);
      client.emit('error', {
        error: error.message || 'Failed to queue intervention',
      });
    }
  }

  @SubscribeMessage('leave-session')
  async handleLeaveSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { sessionId } = data;
      const userSessionId = client.data.user?.sessionId;

      // Validate sessionId matches client session
      if (sessionId !== userSessionId) {
        client.emit('error', {
          error: 'Session ID mismatch',
        });
        return;
      }

      // Leave room
      const roomName = `session:${sessionId}`;
      client.leave(roomName);

      // Remove from tracking
      const subscribers = this.sessionSubscriptions.get(sessionId);
      if (subscribers) {
        subscribers.delete(client.id);
        if (subscribers.size === 0) {
          this.sessionSubscriptions.delete(sessionId);
        }
      }

      // Emit left-session to client
      client.emit('left-session', { sessionId });
    } catch (error) {
      console.error('Error in handleLeaveSession:', error);
      client.emit('error', {
        error: error.message || 'Failed to leave session',
      });
    }
  }
}

