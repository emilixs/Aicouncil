import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionStatus, MessageRole, DriverType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { SessionResponseDto } from '../session/dto';
import { ExpertResponseDto } from '../expert/dto';
import { MessageResponseDto } from '../message/dto';
import { DISCUSSION_EVENTS } from './events/discussion.events';
import {
  LLMRateLimitException,
  LLMTimeoutException,
  LLMServiceException,
  LLMAuthenticationException,
  LLMInvalidRequestException,
} from '../llm/exceptions/llm.exception';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeExpert(overrides: Partial<ExpertResponseDto> = {}): ExpertResponseDto {
  return new ExpertResponseDto({
    id: 'expert-1',
    name: 'Alice',
    specialty: 'Architecture',
    systemPrompt: 'You are an expert architect.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-4' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function makeSession(overrides: Partial<SessionResponseDto> = {}): SessionResponseDto {
  return new SessionResponseDto({
    id: 'session-1',
    problemStatement: 'How do we scale the system?',
    status: SessionStatus.PENDING,
    statusDisplay: 'pending',
    maxMessages: 10,
    consensusReached: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    experts: [makeExpert()],
    ...overrides,
  });
}

function makeMessage(overrides: Partial<MessageResponseDto> = {}): MessageResponseDto {
  return new MessageResponseDto({
    id: 'msg-1',
    sessionId: 'session-1',
    expertId: 'expert-1',
    content: 'My analysis is...',
    role: MessageRole.ASSISTANT,
    isIntervention: false,
    timestamp: new Date(),
    expertName: 'Alice',
    expertSpecialty: 'Architecture',
    ...overrides,
  });
}

function makeMockDriver() {
  return {
    chat: jest.fn(),
    streamChat: jest.fn(),
  };
}

/**
 * Run all pending timers and flush the microtask queue so that
 * Promise chains awaiting setTimeout (e.g. sleep()) can resolve.
 *
 * Jest 29 ships `runAllTimersAsync` which does exactly this.
 */
async function drainTimers(): Promise<void> {
  await jest.runAllTimersAsync();
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CouncilService', () => {
  let service: CouncilService;
  let sessionService: jest.Mocked<SessionService>;
  let messageService: jest.Mocked<MessageService>;
  let driverFactory: jest.Mocked<DriverFactory>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouncilService,
        {
          provide: SessionService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: MessageService,
          useValue: {
            create: jest.fn(),
            countBySession: jest.fn(),
            findLatestBySession: jest.fn(),
          },
        },
        {
          provide: DriverFactory,
          useValue: {
            createDriver: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CouncilService>(CouncilService);
    sessionService = module.get(SessionService);
    messageService = module.get(MessageService);
    driverFactory = module.get(DriverFactory);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // queueIntervention
  // -------------------------------------------------------------------------

  describe('queueIntervention', () => {
    it('returns true when session is ACTIVE', async () => {
      sessionService.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.ACTIVE, statusDisplay: 'active' }),
      );

      const result = await service.queueIntervention('session-1', 'Hello');

      expect(result).toBe(true);
    });

    it('returns false when session is PENDING (not ACTIVE)', async () => {
      sessionService.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.PENDING, statusDisplay: 'pending' }),
      );

      const result = await service.queueIntervention('session-1', 'Hello');

      expect(result).toBe(false);
    });

    it('returns false when session is COMPLETED', async () => {
      sessionService.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.COMPLETED, statusDisplay: 'concluded' }),
      );

      const result = await service.queueIntervention('session-1', 'Hello');

      expect(result).toBe(false);
    });

    it('returns false when session is CANCELLED', async () => {
      sessionService.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.CANCELLED, statusDisplay: 'cancelled' }),
      );

      const result = await service.queueIntervention('session-1', 'Hello');

      expect(result).toBe(false);
    });

    it('returns false when sessionService.findOne throws', async () => {
      sessionService.findOne.mockRejectedValue(new Error('DB error'));

      const result = await service.queueIntervention('session-1', 'Hello');

      expect(result).toBe(false);
    });

    it('queues multiple interventions for the same session', async () => {
      sessionService.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.ACTIVE, statusDisplay: 'active' }),
      );

      const r1 = await service.queueIntervention('session-1', 'First');
      const r2 = await service.queueIntervention('session-1', 'Second');
      const r3 = await service.queueIntervention('session-1', 'Third');

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(r3).toBe(true);
    });

    it('passes userId when provided', async () => {
      sessionService.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.ACTIVE, statusDisplay: 'active' }),
      );

      const result = await service.queueIntervention('session-1', 'Hello', 'user-42');

      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // startDiscussion — validation guard-clauses (no discussion loop reached)
  // -------------------------------------------------------------------------

  describe('startDiscussion — pre-flight validation', () => {
    it('throws BadRequestException if session status is not PENDING', async () => {
      sessionService.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.ACTIVE, statusDisplay: 'active' }),
      );

      await expect(service.startDiscussion('session-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if session has no experts', async () => {
      sessionService.findOne.mockResolvedValue(makeSession({ experts: [] }));

      await expect(service.startDiscussion('session-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if expert config is missing model field', async () => {
      const badExpert = makeExpert({ config: {} }); // no model key
      sessionService.findOne.mockResolvedValue(makeSession({ experts: [badExpert] }));

      await expect(service.startDiscussion('session-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if expert config has null model', async () => {
      const badExpert = makeExpert({ config: { model: null } });
      sessionService.findOne.mockResolvedValue(makeSession({ experts: [badExpert] }));

      await expect(service.startDiscussion('session-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if driverFactory.createDriver throws (missing API key)', async () => {
      sessionService.findOne.mockResolvedValue(makeSession());
      driverFactory.createDriver.mockImplementation(() => {
        throw new LLMAuthenticationException('OpenAI API key not configured');
      });

      await expect(service.startDiscussion('session-1')).rejects.toThrow(BadRequestException);
    });

    it('does NOT transition to ACTIVE when pre-validation fails', async () => {
      sessionService.findOne.mockResolvedValue(makeSession({ experts: [] }));

      await expect(service.startDiscussion('session-1')).rejects.toThrow(BadRequestException);

      expect(sessionService.update).not.toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ status: SessionStatus.ACTIVE }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Shared helper: wire up a minimal single-turn discussion ending at maxMessages
  // -------------------------------------------------------------------------

  /**
   * Sets up mocks so that one expert takes one turn, then maxMessages is
   * reached and the session concludes with COMPLETED + reason max_messages.
   *
   * The driver's chat returns a non-consensus response.
   * Returns the mock driver so callers can add extra assertions on it.
   */
  function setupSingleTurnMaxMessages(sessionId = 'session-1') {
    const expert = makeExpert();
    const session = makeSession({ id: sessionId, experts: [expert], maxMessages: 1 });
    const completedSession = makeSession({
      id: sessionId,
      experts: [expert],
      status: SessionStatus.COMPLETED,
      statusDisplay: 'concluded',
      maxMessages: 1,
      consensusReached: false,
    });

    sessionService.findOne
      .mockResolvedValueOnce(session)           // startDiscussion initial fetch
      .mockResolvedValueOnce(completedSession); // final findOne after concludeSession

    sessionService.update.mockResolvedValue(undefined as any);

    const driver = makeMockDriver();
    driver.chat.mockResolvedValue({
      content: 'This is my analysis.',
      finishReason: 'stop',
      model: 'gpt-4',
    });
    driverFactory.createDriver.mockReturnValue(driver as any);

    // Loop iteration: count=0 → run expert turn; after turn count=1 → at maxMessages=1 → stop
    // Final count for SESSION_ENDED event: 1
    messageService.countBySession
      .mockResolvedValueOnce(0) // before expert turn (maxMessages check)
      .mockResolvedValueOnce(1) // finalMessageCount after concludeSession
      .mockResolvedValue(1);    // fallback for any extra calls

    messageService.findLatestBySession.mockResolvedValue([]);
    messageService.create.mockResolvedValue(makeMessage({ sessionId }));

    return { expert, session, completedSession, driver };
  }

  // -------------------------------------------------------------------------
  // startDiscussion — session lifecycle transitions
  // -------------------------------------------------------------------------

  describe('startDiscussion — session lifecycle', () => {
    it('transitions session PENDING → ACTIVE before the discussion loop', async () => {
      const { driver } = setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      // First update call must set ACTIVE
      expect(sessionService.update).toHaveBeenCalledWith('session-1', {
        status: SessionStatus.ACTIVE,
      });

      // ACTIVE update comes before any driver.chat call
      const updateOrder = sessionService.update.mock.invocationCallOrder[0];
      const chatOrder = driver.chat.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(chatOrder);
    });

    it('concludes session with COMPLETED status when maxMessages reached', async () => {
      setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(sessionService.update).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ status: SessionStatus.COMPLETED }),
      );
    });

    it('sets session to CANCELLED on unhandled fatal error during discussion loop', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert] });

      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(undefined as any);

      // Pre-validation call returns a real driver; loop call throws fatal error
      let calls = 0;
      driverFactory.createDriver.mockImplementation(() => {
        calls++;
        if (calls === 1) {
          // Validation phase: succeed
          return makeMockDriver() as any;
        }
        // Discussion loop: fatal error thrown synchronously from createDriver
        throw new LLMAuthenticationException('Invalid API key');
      });

      messageService.countBySession.mockResolvedValue(0);
      messageService.findLatestBySession.mockResolvedValue([]);

      // Fatal errors propagate without needing timer advancement
      await expect(service.startDiscussion('session-1')).rejects.toThrow();

      expect(sessionService.update).toHaveBeenCalledWith('session-1', {
        status: SessionStatus.CANCELLED,
      });
    });

    it('cleans up intervention queue after discussion ends successfully', async () => {
      setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      // After completion: queueIntervention should fail because session is no longer ACTIVE
      sessionService.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.PENDING, statusDisplay: 'pending' }),
      );
      const queued = await service.queueIntervention('session-1', 'post-discussion');
      expect(queued).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // startDiscussion — round-robin expert turns
  // -------------------------------------------------------------------------

  describe('startDiscussion — round-robin expert ordering', () => {
    it('calls driver.chat for each expert in round-robin order across 4 turns', async () => {
      const expertA = makeExpert({ id: 'e-a', name: 'Alice' });
      const expertB = makeExpert({ id: 'e-b', name: 'Bob' });
      const session = makeSession({ experts: [expertA, expertB], maxMessages: 4 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expertA, expertB],
        maxMessages: 4,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      driver.chat.mockResolvedValue({
        content: 'Normal response without consensus keywords.',
        finishReason: 'stop',
        model: 'gpt-4',
      });
      driverFactory.createDriver.mockReturnValue(driver as any);

      // 4 turns: counts 0,1,2,3 keep loop alive; count=4 after 4th turn hits maxMessages=4
      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4); // finalMessageCount
      messageService.findLatestBySession.mockResolvedValue([]);
      messageService.create.mockResolvedValue(makeMessage());

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(driver.chat).toHaveBeenCalledTimes(4);
    });

    it('emits EXPERT_TURN_START event for each turn', async () => {
      setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.EXPERT_TURN_START,
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // startDiscussion — consensus detection
  // -------------------------------------------------------------------------

  describe('startDiscussion — consensus detection', () => {
    const consensusPhrases = [
      'i agree with this approach',
      'consensus reached between us',
      'we agree on the solution',
      'i concur with the assessment',
      'agreed, let us proceed',
      'we have consensus on this matter',
      'we reached consensus finally',
      'in agreement with the proposal',
    ];

    for (const phrase of consensusPhrases) {
      it(`detects consensus when response contains "${phrase}"`, async () => {
        const expert = makeExpert();
        const session = makeSession({ experts: [expert], maxMessages: 20 });
        const completedSession = makeSession({
          status: SessionStatus.COMPLETED,
          statusDisplay: 'concluded',
          consensusReached: true,
          experts: [expert],
          maxMessages: 20,
        });

        sessionService.findOne
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce(completedSession);
        sessionService.update.mockResolvedValue(undefined as any);

        const driver = makeMockDriver();
        driver.chat.mockResolvedValue({ content: phrase, finishReason: 'stop', model: 'gpt-4' });
        driverFactory.createDriver.mockReturnValue(driver as any);

        messageService.countBySession
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1);
        messageService.findLatestBySession.mockResolvedValue([]);
        messageService.create.mockResolvedValue(makeMessage({ content: phrase }));

        const promise = service.startDiscussion('session-1');
        await drainTimers();
        await promise;

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          DISCUSSION_EVENTS.CONSENSUS_REACHED,
          expect.objectContaining({ sessionId: 'session-1', consensusReached: true }),
        );
      });
    }

    it('is case-insensitive for consensus detection', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 20 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        consensusReached: true,
        experts: [expert],
        maxMessages: 20,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      driver.chat.mockResolvedValue({
        content: 'I AGREE with all the points raised.',
        finishReason: 'stop',
        model: 'gpt-4',
      });
      driverFactory.createDriver.mockReturnValue(driver as any);

      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      messageService.findLatestBySession.mockResolvedValue([]);
      messageService.create.mockResolvedValue(makeMessage());

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.CONSENSUS_REACHED,
        expect.objectContaining({ consensusReached: true }),
      );
    });

    it('emits SESSION_ENDED with reason "consensus" when consensus detected', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 20 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        consensusReached: true,
        experts: [expert],
        maxMessages: 20,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      driver.chat.mockResolvedValue({
        content: 'i agree, great discussion.',
        finishReason: 'stop',
        model: 'gpt-4',
      });
      driverFactory.createDriver.mockReturnValue(driver as any);

      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      messageService.findLatestBySession.mockResolvedValue([]);
      messageService.create.mockResolvedValue(makeMessage());

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.SESSION_ENDED,
        expect.objectContaining({ reason: 'consensus', consensusReached: true }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // startDiscussion — max messages limit
  // -------------------------------------------------------------------------

  describe('startDiscussion — max messages', () => {
    it('stops discussion when maxMessages is reached', async () => {
      setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(sessionService.update).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ status: SessionStatus.COMPLETED }),
      );
    });

    it('emits SESSION_ENDED with reason "max_messages" when limit reached', async () => {
      setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.SESSION_ENDED,
        expect.objectContaining({ reason: 'max_messages', consensusReached: false }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // startDiscussion — empty/whitespace-only responses
  // -------------------------------------------------------------------------

  describe('startDiscussion — empty LLM responses', () => {
    it('skips message creation for empty response and continues to next iteration', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 2 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expert],
        maxMessages: 2,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      // First turn: empty → skip; Second turn: real response, then count hits maxMessages
      driver.chat
        .mockResolvedValueOnce({ content: '   ', finishReason: 'stop', model: 'gpt-4' })
        .mockResolvedValueOnce({ content: 'Actual response', finishReason: 'stop', model: 'gpt-4' });
      driverFactory.createDriver.mockReturnValue(driver as any);

      // count=0 before empty turn (skip create), count=0 before real turn (still 0), count=2 final
      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2);
      messageService.findLatestBySession.mockResolvedValue([]);
      messageService.create.mockResolvedValue(makeMessage());

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      // Only one ASSISTANT message created (for the non-empty second turn)
      const assistantCreates = (messageService.create.mock.calls as any[]).filter(
        (call) => call[0]?.role === MessageRole.ASSISTANT,
      );
      expect(assistantCreates).toHaveLength(1);
      expect(assistantCreates[0][0].content).toBe('Actual response');
    });

    it('skips whitespace-only responses without creating messages', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 1 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expert],
        maxMessages: 1,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      driver.chat.mockResolvedValue({ content: '\n\t\n', finishReason: 'stop', model: 'gpt-4' });
      driverFactory.createDriver.mockReturnValue(driver as any);

      // After skipping empty response, count hits maxMessages on the second loop check
      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      messageService.findLatestBySession.mockResolvedValue([]);

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      const assistantCreates = (messageService.create.mock.calls as any[]).filter(
        (call) => call[0]?.role === MessageRole.ASSISTANT,
      );
      expect(assistantCreates).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // startDiscussion — transient LLM errors
  // -------------------------------------------------------------------------

  describe('startDiscussion — transient LLM errors', () => {
    async function setupTransientErrorRun(
      ErrorClass: new (msg: string, cause?: Error) => Error,
    ) {
      const expertA = makeExpert({ id: 'e-a', name: 'Alice' });
      const expertB = makeExpert({ id: 'e-b', name: 'Bob' });
      const session = makeSession({ experts: [expertA, expertB], maxMessages: 3 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expertA, expertB],
        maxMessages: 3,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      // First expert throws transient error; subsequent calls succeed
      driver.chat
        .mockRejectedValueOnce(new ErrorClass('transient error'))
        .mockResolvedValue({ content: 'Recovery response', finishReason: 'stop', model: 'gpt-4' });
      driverFactory.createDriver.mockReturnValue(driver as any);

      // counts: 0,0,0 during loop turns (errors don't create messages), then 3 for finalMessageCount
      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3);
      messageService.findLatestBySession.mockResolvedValue([]);
      messageService.create.mockResolvedValue(makeMessage());

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      return promise;
    }

    it('continues to next expert on LLMRateLimitException without cancelling', async () => {
      await expect(setupTransientErrorRun(LLMRateLimitException)).resolves.toBeDefined();
      expect(sessionService.update).not.toHaveBeenCalledWith('session-1', {
        status: SessionStatus.CANCELLED,
      });
    });

    it('continues to next expert on LLMTimeoutException without cancelling', async () => {
      await expect(setupTransientErrorRun(LLMTimeoutException)).resolves.toBeDefined();
      expect(sessionService.update).not.toHaveBeenCalledWith('session-1', {
        status: SessionStatus.CANCELLED,
      });
    });

    it('continues to next expert on LLMServiceException without cancelling', async () => {
      await expect(setupTransientErrorRun(LLMServiceException)).resolves.toBeDefined();
      expect(sessionService.update).not.toHaveBeenCalledWith('session-1', {
        status: SessionStatus.CANCELLED,
      });
    });

    it('emits ERROR event for transient LLM errors', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 2 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expert],
        maxMessages: 2,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      // All chat calls throw transient errors
      driver.chat.mockRejectedValue(new LLMRateLimitException('rate limited'));
      driverFactory.createDriver.mockReturnValue(driver as any);

      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2);
      messageService.findLatestBySession.mockResolvedValue([]);

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.ERROR,
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // startDiscussion — fatal LLM errors
  // -------------------------------------------------------------------------

  describe('startDiscussion — fatal LLM errors', () => {
    it('throws on LLMAuthenticationException during discussion loop', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 10 });

      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(undefined as any);

      // Validation call returns a dummy driver; loop call throws synchronously
      let calls = 0;
      driverFactory.createDriver.mockImplementation(() => {
        calls++;
        if (calls === 1) return makeMockDriver() as any; // validation phase
        // Discussion loop call: throw fatal error synchronously
        throw new LLMAuthenticationException('bad key');
      });

      messageService.countBySession.mockResolvedValue(0);
      messageService.findLatestBySession.mockResolvedValue([]);

      // Fatal errors propagate as Promise rejections without needing timer advancement
      await expect(service.startDiscussion('session-1')).rejects.toBeInstanceOf(LLMAuthenticationException);
    });

    it('throws on LLMInvalidRequestException during discussion loop', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 10 });

      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(undefined as any);

      let calls = 0;
      driverFactory.createDriver.mockImplementation(() => {
        calls++;
        if (calls === 1) return makeMockDriver() as any;
        throw new LLMInvalidRequestException('invalid params');
      });

      messageService.countBySession.mockResolvedValue(0);
      messageService.findLatestBySession.mockResolvedValue([]);

      await expect(service.startDiscussion('session-1')).rejects.toBeInstanceOf(LLMInvalidRequestException);
    });

    it('sets session to CANCELLED when a fatal error propagates', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 10 });

      sessionService.findOne.mockResolvedValue(session);
      sessionService.update.mockResolvedValue(undefined as any);

      let calls = 0;
      driverFactory.createDriver.mockImplementation(() => {
        calls++;
        if (calls === 1) return makeMockDriver() as any;
        throw new LLMAuthenticationException('bad key');
      });

      messageService.countBySession.mockResolvedValue(0);
      messageService.findLatestBySession.mockResolvedValue([]);

      await expect(service.startDiscussion('session-1')).rejects.toThrow();

      expect(sessionService.update).toHaveBeenCalledWith('session-1', {
        status: SessionStatus.CANCELLED,
      });
    });
  });

  // -------------------------------------------------------------------------
  // startDiscussion — events
  // -------------------------------------------------------------------------

  describe('startDiscussion — events', () => {
    it('emits MESSAGE_CREATED for each expert response', async () => {
      setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.MESSAGE_CREATED,
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });

    it('emits SESSION_ENDED when discussion completes', async () => {
      setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.SESSION_ENDED,
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });

    it('emits EXPERT_TURN_START at the beginning of each expert turn', async () => {
      setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.EXPERT_TURN_START,
        expect.objectContaining({
          sessionId: 'session-1',
          expertName: 'Alice',
          turnNumber: 1,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // startDiscussion — queued interventions processed during loop
  // -------------------------------------------------------------------------

  describe('startDiscussion — intervention processing', () => {
    it('processes queued interventions before each expert turn by creating USER messages', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 1 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expert],
        maxMessages: 1,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      driver.chat.mockResolvedValue({ content: 'Expert response', finishReason: 'stop', model: 'gpt-4' });
      driverFactory.createDriver.mockReturnValue(driver as any);

      // The service calls interventionQueues.set(sessionId, []) at line 184,
      // then calls processInterventions() which reads the queue, then calls
      // messageService.countBySession. We inject the intervention by hooking
      // the first countBySession call — by that point the queue has been initialized
      // but processInterventions() hasn't yet drained it (it runs BEFORE countBySession).
      //
      // Since processInterventions runs BEFORE countBySession in each loop iteration,
      // we need to inject BEFORE processInterventions is called. We do this by
      // accessing the private map and pushing after the queue is set up (line 184),
      // which happens synchronously between the update() awaitable and the loop start.
      // We hook this via the `messageService.findLatestBySession` which isn't called
      // until after processInterventions completes. Instead, we directly push into
      // the queue using a mock on the Map object.

      // Replace interventionQueues with a proxy that captures the set() to [] call
      // and immediately pushes an intervention after initialization.
      const originalMap = (service as any).interventionQueues as Map<string, any[]>;
      const proxyMap = new Map(originalMap);
      const originalSet = proxyMap.set.bind(proxyMap);
      jest.spyOn(proxyMap, 'set').mockImplementation((key: string, value: any[]) => {
        originalSet(key, value);
        if (value.length === 0) {
          // This is the initialization call at line 184; push our intervention
          originalSet(key, [{ content: 'User intervention message', userId: 'user-1' }]);
        }
        return proxyMap;
      });
      (service as any).interventionQueues = proxyMap;

      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValue(1);
      messageService.findLatestBySession.mockResolvedValue([]);
      messageService.create.mockResolvedValue(makeMessage());

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(messageService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: MessageRole.USER,
          isIntervention: true,
          content: 'User intervention message',
        }),
      );
    });

    it('emits MESSAGE_CREATED for processed intervention messages', async () => {
      const expert = makeExpert();
      const session = makeSession({ experts: [expert], maxMessages: 1 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expert],
        maxMessages: 1,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);

      sessionService.update.mockResolvedValue(undefined as any);

      // Same proxy technique: intercept interventionQueues.set([]) to inject the intervention
      const originalMap2 = (service as any).interventionQueues as Map<string, any[]>;
      const proxyMap2 = new Map(originalMap2);
      const originalSet2 = proxyMap2.set.bind(proxyMap2);
      jest.spyOn(proxyMap2, 'set').mockImplementation((key: string, value: any[]) => {
        originalSet2(key, value);
        if (value.length === 0) {
          originalSet2(key, [{ content: 'Intervention content' }]);
        }
        return proxyMap2;
      });
      (service as any).interventionQueues = proxyMap2;

      const driver = makeMockDriver();
      driver.chat.mockResolvedValue({ content: 'Expert reply', finishReason: 'stop', model: 'gpt-4' });
      driverFactory.createDriver.mockReturnValue(driver as any);

      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValue(1);
      messageService.findLatestBySession.mockResolvedValue([]);

      const interventionMsg = makeMessage({
        role: MessageRole.USER,
        isIntervention: true,
        content: 'Intervention content',
      });
      const expertMsg = makeMessage();
      messageService.create
        .mockResolvedValueOnce(interventionMsg)
        .mockResolvedValueOnce(expertMsg);

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DISCUSSION_EVENTS.MESSAGE_CREATED,
        expect.objectContaining({ message: interventionMsg }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // buildExpertContext (tested indirectly through startDiscussion)
  // -------------------------------------------------------------------------

  describe('buildExpertContext (indirect)', () => {
    it('passes a system message as the first element of the context array', async () => {
      const { driver } = setupSingleTurnMaxMessages();

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      const chatCallMessages = driver.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
      expect(chatCallMessages[0].role).toBe('system');
    });

    it('system message includes expert systemPrompt and problemStatement', async () => {
      const expert = makeExpert({ systemPrompt: 'You are a security expert.' });
      const session = makeSession({
        problemStatement: 'How do we prevent SQL injection?',
        experts: [expert],
        maxMessages: 1,
      });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expert],
        problemStatement: 'How do we prevent SQL injection?',
        maxMessages: 1,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      driver.chat.mockResolvedValue({ content: 'Response', finishReason: 'stop', model: 'gpt-4' });
      driverFactory.createDriver.mockReturnValue(driver as any);

      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValue(1);
      messageService.findLatestBySession.mockResolvedValue([]);
      messageService.create.mockResolvedValue(makeMessage());

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      const chatCallMessages = driver.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
      expect(chatCallMessages[0].role).toBe('system');
      expect(chatCallMessages[0].content).toContain('You are a security expert.');
      expect(chatCallMessages[0].content).toContain('How do we prevent SQL injection?');
    });

    it('system message includes the list of all participating experts', async () => {
      const expertA = makeExpert({ id: 'e-a', name: 'Alice', specialty: 'Architecture' });
      const expertB = makeExpert({ id: 'e-b', name: 'Bob', specialty: 'Security' });
      const session = makeSession({ experts: [expertA, expertB], maxMessages: 10 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expertA, expertB],
        maxMessages: 10,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      driver.chat.mockResolvedValue({ content: 'i agree', finishReason: 'stop', model: 'gpt-4' });
      driverFactory.createDriver.mockReturnValue(driver as any);

      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      messageService.findLatestBySession.mockResolvedValue([]);
      messageService.create.mockResolvedValue(makeMessage());

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      const chatCallMessages = driver.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
      const systemContent = chatCallMessages[0].content;
      expect(systemContent).toContain('Alice');
      expect(systemContent).toContain('Architecture');
      expect(systemContent).toContain('Bob');
      expect(systemContent).toContain('Security');
    });

    it('recent messages are prepended with expert name prefix in context', async () => {
      const expert = makeExpert({ name: 'Alice' });
      const session = makeSession({ experts: [expert], maxMessages: 1 });
      const completedSession = makeSession({
        status: SessionStatus.COMPLETED,
        statusDisplay: 'concluded',
        experts: [expert],
        maxMessages: 1,
      });

      sessionService.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      sessionService.update.mockResolvedValue(undefined as any);

      const driver = makeMockDriver();
      driver.chat.mockResolvedValue({ content: 'Response', finishReason: 'stop', model: 'gpt-4' });
      driverFactory.createDriver.mockReturnValue(driver as any);

      const prevMessage = makeMessage({
        id: 'prev-msg',
        content: 'My previous point.',
        role: MessageRole.ASSISTANT,
        expertName: 'Alice',
      });

      messageService.countBySession
        .mockResolvedValueOnce(0)
        .mockResolvedValue(1);
      messageService.findLatestBySession.mockResolvedValue([prevMessage]);
      messageService.create.mockResolvedValue(makeMessage());

      const promise = service.startDiscussion('session-1');
      await drainTimers();
      await promise;

      const chatCallMessages = driver.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
      // Index 0 is system message; subsequent entries are conversation history
      const conversationMessages = chatCallMessages.slice(1);
      expect(conversationMessages.length).toBeGreaterThan(0);
      expect(conversationMessages[0].content).toContain('[Alice]');
      expect(conversationMessages[0].content).toContain('My previous point.');
    });
  });
});
