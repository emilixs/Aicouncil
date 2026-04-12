import { Test, TestingModule } from '@nestjs/testing';
import { SessionStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
// Note: DISCUSSION_EVENTS.SESSION_PAUSED and SESSION_RESUMED don't exist yet.
// We use expected string literals in assertions.
import { DISCUSSION_EVENTS } from './events/discussion.events';

/**
 * TDD RED phase: Integration tests for pause/resume/stop flow.
 *
 * Tests the full lifecycle: start -> pause -> resume -> stop
 * Uses mocked dependencies but tests the real CouncilService orchestration logic.
 *
 * Expected to FAIL until the async refactor and control methods are implemented.
 * Uses (service as any) to avoid TS compilation errors for non-existent methods.
 */
// Set shorter timeout since these tests will timeout until the async refactor is done
// (startDiscussion currently blocks synchronously)
jest.setTimeout(10000);

describe('CouncilService - pause/resume/stop integration flow', () => {
  let service: CouncilService;
  let sessionService: SessionService;
  let messageService: MessageService;
  let eventEmitter: EventEmitter2;

  // Track emitted events
  let emittedEvents: Array<{ event: string; payload: any }>;

  // Track session status updates
  let currentStatus: SessionStatus;

  const sessionId = 'integration-test-session';

  beforeEach(async () => {
    emittedEvents = [];
    currentStatus = SessionStatus.PENDING;

    const mockDriver = {
      chat: jest.fn().mockImplementation(async () => {
        // Simulate LLM response time
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { content: 'Expert response for discussion turn' };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouncilService,
        {
          provide: SessionService,
          useValue: {
            findOne: jest.fn().mockImplementation(async () => ({
              id: sessionId,
              problemStatement: 'Integration test problem',
              status: currentStatus,
              statusDisplay: currentStatus.toLowerCase(),
              maxMessages: 100,
              consensusReached: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              experts: [
                {
                  id: 'expert-1',
                  name: 'Expert A',
                  specialty: 'Testing',
                  systemPrompt: 'You are an expert',
                  driverType: 'OPENAI',
                  config: { model: 'gpt-4' },
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
                {
                  id: 'expert-2',
                  name: 'Expert B',
                  specialty: 'Review',
                  systemPrompt: 'You are a reviewer',
                  driverType: 'OPENAI',
                  config: { model: 'gpt-4' },
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ],
              messageCount: 0,
            })),
            update: jest.fn().mockImplementation(async (id, dto) => {
              if (dto.status) {
                currentStatus = dto.status;
              }
              return {
                id,
                status: currentStatus,
                problemStatement: 'Integration test problem',
                maxMessages: 100,
                consensusReached: dto.consensusReached || false,
                createdAt: new Date(),
                updatedAt: new Date(),
                experts: [],
                _count: { messages: 0 },
              };
            }),
          },
        },
        {
          provide: MessageService,
          useValue: {
            create: jest.fn().mockResolvedValue({
              id: 'msg-1',
              sessionId,
              content: 'Test message',
              role: 'ASSISTANT',
              expertId: 'expert-1',
              expertName: 'Expert A',
              expertSpecialty: 'Testing',
              isIntervention: false,
              timestamp: new Date().toISOString(),
            }),
            countBySession: jest.fn().mockResolvedValue(0),
            findLatestBySession: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DriverFactory,
          useValue: {
            createDriver: jest.fn().mockReturnValue(mockDriver),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn().mockImplementation((event: string, payload: any) => {
              emittedEvents.push({ event, payload });
            }),
            on: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CouncilService>(CouncilService);
    sessionService = module.get<SessionService>(SessionService);
    messageService = module.get<MessageService>(MessageService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should start discussion and return immediately without blocking', async () => {
    // After the async refactor, startDiscussion should return immediately
    // with the session in ACTIVE status while the loop runs in background
    const result = await service.startDiscussion(sessionId);

    expect(result).toBeDefined();
    // Session should have been transitioned to ACTIVE
    expect(sessionService.update).toHaveBeenCalledWith(sessionId, {
      status: SessionStatus.ACTIVE,
    });

    // Give the background loop a moment to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The loop should be running in background (messages being created)
    // but startDiscussion already returned
  });

  it('should pause discussion and stop producing messages', async () => {
    // Start the discussion (returns immediately after refactor)
    await service.startDiscussion(sessionId);

    // Wait for a couple of turns to happen
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Record message count before pause
    const messagesBeforePause = (messageService.create as jest.Mock).mock.calls.length;

    // Pause the discussion
    currentStatus = SessionStatus.ACTIVE;
    await (service as any).pauseDiscussion(sessionId);

    // Wait to verify no new messages are created
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messagesAfterPause = (messageService.create as jest.Mock).mock.calls.length;

    // At most one additional message may be created after pause —
    // the in-flight LLM response is saved before the signal is checked (by design).
    expect(messagesAfterPause - messagesBeforePause).toBeLessThanOrEqual(1);

    // SESSION_PAUSED event should have been emitted
    const pausedEvents = emittedEvents.filter(
      (e) => e.event === 'discussion.session.paused',
    );
    expect(pausedEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('should resume discussion and continue producing messages after pause', async () => {
    // Start discussion
    await service.startDiscussion(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Pause
    currentStatus = SessionStatus.ACTIVE;
    await (service as any).pauseDiscussion(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const messagesAtPause = (messageService.create as jest.Mock).mock.calls.length;

    // Resume
    currentStatus = 'PAUSED' as SessionStatus;
    await (service as any).resumeDiscussion(sessionId);

    // Wait for more messages to be produced
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messagesAfterResume = (messageService.create as jest.Mock).mock.calls.length;

    // Messages should have increased after resume
    expect(messagesAfterResume).toBeGreaterThan(messagesAtPause);

    // SESSION_RESUMED event should have been emitted
    const resumedEvents = emittedEvents.filter(
      (e) => e.event === 'discussion.session.resumed',
    );
    expect(resumedEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('should stop discussion and transition to CANCELLED', async () => {
    // Start discussion
    await service.startDiscussion(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Stop the discussion
    currentStatus = SessionStatus.ACTIVE;
    await (service as any).stopDiscussion(sessionId);

    // Wait for the loop to process the stop signal
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Session should have been set to CANCELLED
    const updateCalls = (sessionService.update as jest.Mock).mock.calls;
    const cancelledCall = updateCalls.find(
      (call: any[]) => call[1]?.status === SessionStatus.CANCELLED,
    );
    expect(cancelledCall).toBeDefined();
  });

  it('should stop a paused discussion', async () => {
    // Start
    await service.startDiscussion(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Pause
    currentStatus = SessionStatus.ACTIVE;
    await (service as any).pauseDiscussion(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Stop while paused
    currentStatus = 'PAUSED' as SessionStatus;
    await (service as any).stopDiscussion(sessionId);

    // Wait for the stop to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Session should end up CANCELLED
    const updateCalls = (sessionService.update as jest.Mock).mock.calls;
    const cancelledCall = updateCalls.find(
      (call: any[]) => call[1]?.status === SessionStatus.CANCELLED,
    );
    expect(cancelledCall).toBeDefined();
  });

  it('should emit SESSION_ENDED with reason "stopped" when stopped', async () => {
    // Start
    await service.startDiscussion(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Stop
    currentStatus = SessionStatus.ACTIVE;
    await (service as any).stopDiscussion(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check for session ended event with 'stopped' reason
    const endedEvents = emittedEvents.filter(
      (e) => e.event === DISCUSSION_EVENTS.SESSION_ENDED,
    );
    if (endedEvents.length > 0) {
      expect(endedEvents[0].payload.reason).toBe('stopped');
    }
    // If no ended event, the test still fails because the feature isn't implemented
    expect(endedEvents.length).toBeGreaterThanOrEqual(1);
  });
});
