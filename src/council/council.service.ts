import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SessionStatus, MessageRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { ConsensusService } from '../consensus/consensus.service';
import { SessionResponseDto } from '../session/dto';
import { ExpertResponseDto } from '../expert/dto';
import { MessageResponseDto } from '../message/dto';
import { LLMMessage, LLMConfig } from '../llm/dto';
import {
  DISCUSSION_EVENTS,
  DiscussionMessageEvent,
  DiscussionConsensusEvent,
  DiscussionEndedEvent,
  DiscussionErrorEvent,
  ExpertTurnStartEvent,
  DiscussionPausedEvent,
  DiscussionResumedEvent,
} from './events/discussion.events';

/**
 * CouncilService - Core orchestration service for multi-agent discussions
 *
 * Manages the discussion loop between experts, handles consensus detection,
 * and coordinates session lifecycle transitions.
 */
@Injectable()
export class CouncilService {
  private readonly logger = new Logger(CouncilService.name);
  private interventionQueues: Map<string, Array<{ content: string; userId?: string }>> = new Map();
  private sessionControlFlags: Map<string, 'running' | 'paused' | 'stopped'> = new Map();
  private pauseResolvers: Map<string, (value: 'running' | 'stopped') => void> = new Map();

  constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly driverFactory: DriverFactory,
    private readonly eventEmitter: EventEmitter2,
    private readonly consensusService: ConsensusService,
  ) {}

  /**
   * Comment 4: Sleep utility for inter-turn delay
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Pause a running discussion. The loop will stop after the current expert turn completes.
   */
  async pauseDiscussion(sessionId: string): Promise<void> {
    const flag = this.sessionControlFlags.get(sessionId);
    if (flag !== 'running') {
      this.logger.warn(`Cannot pause session ${sessionId}: not running (flag=${flag})`);
      return;
    }
    this.sessionControlFlags.set(sessionId, 'paused');
    await this.sessionService.update(sessionId, { status: SessionStatus.PAUSED });
    this.logger.log(`Session ${sessionId} paused`);
    this.eventEmitter.emit(DISCUSSION_EVENTS.SESSION_PAUSED, {
      sessionId,
    } as DiscussionPausedEvent);
  }

  /**
   * Resume a paused discussion.
   */
  async resumeDiscussion(sessionId: string): Promise<void> {
    const flag = this.sessionControlFlags.get(sessionId);
    if (flag !== 'paused') {
      this.logger.warn(`Cannot resume session ${sessionId}: not paused (flag=${flag})`);
      return;
    }
    this.sessionControlFlags.set(sessionId, 'running');
    const resolver = this.pauseResolvers.get(sessionId);
    if (resolver) {
      this.pauseResolvers.delete(sessionId);
      resolver('running');
    }
    await this.sessionService.update(sessionId, { status: SessionStatus.ACTIVE });
    this.logger.log(`Session ${sessionId} resumed`);
    this.eventEmitter.emit(DISCUSSION_EVENTS.SESSION_RESUMED, {
      sessionId,
    } as DiscussionResumedEvent);
  }

  /**
   * Stop a running or paused discussion. The loop will exit after the current turn.
   */
  async stopDiscussion(sessionId: string): Promise<void> {
    const flag = this.sessionControlFlags.get(sessionId);
    if (!flag || flag === 'stopped') {
      this.logger.warn(`Cannot stop session ${sessionId}: not active (flag=${flag})`);
      return;
    }
    this.sessionControlFlags.set(sessionId, 'stopped');
    const resolver = this.pauseResolvers.get(sessionId);
    if (resolver) {
      this.pauseResolvers.delete(sessionId);
      resolver('stopped');
    }
    this.logger.log(`Session ${sessionId} stop requested`);
    this.eventEmitter.emit(DISCUSSION_EVENTS.DISCUSSION_STOPPED, {
      sessionId,
    });
  }

  /**
   * Wait while the discussion is paused. Returns 'running' on resume or 'stopped' on stop.
   * Uses a Promise resolved by resumeDiscussion/stopDiscussion instead of polling.
   */
  private waitWhilePaused(sessionId: string): Promise<'running' | 'stopped'> {
    const flag = this.sessionControlFlags.get(sessionId);
    if (flag !== 'paused') {
      return Promise.resolve(flag === 'stopped' ? 'stopped' : 'running');
    }
    return new Promise<'running' | 'stopped'>((resolve) => {
      this.pauseResolvers.set(sessionId, resolve);
    });
  }

  /**
   * Queue a user intervention to be processed before the next expert turn
   * @param sessionId - The session ID
   * @param content - The intervention message content
   * @param userId - Optional user ID
   * @returns true if intervention was queued, false if session is not ACTIVE/PAUSED or on failure
   */
  async queueIntervention(sessionId: string, content: string, userId?: string): Promise<boolean> {
    try {
      // Verify session status before queuing
      const session = await this.sessionService.findOne(sessionId);

      if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.PAUSED) {
        this.logger.warn(
          `Cannot queue intervention for session ${sessionId}: session status is ${session.status}`,
        );
        return false;
      }

      if (!this.interventionQueues.has(sessionId)) {
        this.interventionQueues.set(sessionId, []);
      }
      const queue = this.interventionQueues.get(sessionId);
      if (queue) {
        queue.push({ content, userId });
      }
      this.logger.log(`Queued intervention for session ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to queue intervention for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Process queued interventions by creating USER messages
   * @param sessionId - The session ID
   */
  private async processInterventions(sessionId: string, roundNumber?: number): Promise<void> {
    const queue = this.interventionQueues.get(sessionId);
    if (!queue || queue.length === 0) {
      return;
    }

    this.logger.log(`Processing ${queue.length} interventions for session ${sessionId}`);

    for (const intervention of queue) {
      try {
        const message = await this.messageService.create({
          sessionId,
          content: intervention.content,
          role: MessageRole.USER,
          isIntervention: true,
          roundNumber,
        });

        // Emit message created event
        this.eventEmitter.emit(DISCUSSION_EVENTS.MESSAGE_CREATED, {
          sessionId,
          message,
        } as DiscussionMessageEvent);

        this.logger.log(`Processed intervention for session ${sessionId}`);
      } catch (error) {
        this.logger.error(`Failed to process intervention: ${error.message}`);
        this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
          sessionId,
          error: error.message,
        } as DiscussionErrorEvent);
      }
    }

    // Clear the queue
    this.interventionQueues.set(sessionId, []);
  }

  /**
   * Start a multi-agent discussion for a session.
   * Validates the session, transitions to ACTIVE, and fires the discussion loop
   * in the background (fire-and-forget). Returns immediately with the ACTIVE session.
   */
  async startDiscussion(sessionId: string): Promise<SessionResponseDto> {
    const session = await this.sessionService.findOne(sessionId);

    if (session.status !== SessionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot start discussion for session with status ${session.statusDisplay}. Session must be in pending status.`,
      );
    }

    const experts = session.experts.map((e: any) => (e.expert ? e.expert : e));

    if (experts.length === 0) {
      throw new BadRequestException(
        'Cannot start discussion for session with no experts. Session must have at least one expert.',
      );
    }

    this.logger.log(`Validating ${experts.length} expert configurations...`);
    for (const expert of experts) {
      const expertConfig = plainToInstance(LLMConfig, expert.config);
      const validationErrors = await validate(expertConfig);

      if (validationErrors.length > 0 || !expertConfig.model) {
        throw new BadRequestException(
          `Expert "${expert.name}" (${expert.id}) has invalid config. Missing or invalid required field: model`,
        );
      }

      try {
        this.driverFactory.createDriver(expert.driverType);
      } catch (error) {
        throw new BadRequestException(
          `Expert "${expert.name}" (${expert.id}) cannot be initialized: ${error.message}`,
        );
      }
    }
    this.logger.log(`All expert configurations validated successfully`);

    await this.sessionService.update(sessionId, { status: SessionStatus.ACTIVE });
    this.logger.log(`Session ${sessionId} transitioned to ACTIVE`);

    this.interventionQueues.set(sessionId, []);
    this.sessionControlFlags.set(sessionId, 'running');

    this.runDiscussionLoop(sessionId, session, experts).catch((err) =>
      this.logger.error(`Discussion loop failed for session ${sessionId}: ${err.message}`, err.stack),
    );

    return this.sessionService.findOne(sessionId);
  }

  /**
   * The discussion loop. Runs in the background after startDiscussion returns.
   * Exposed for testing — not part of the public API.
   */
  async runDiscussionLoop(
    sessionId: string,
    session: SessionResponseDto,
    experts: ExpertResponseDto[],
  ): Promise<void> {
    try {
      this.logger.log(`Starting discussion loop with ${experts.length} experts`);

      let currentExpertIndex = 0;
      let consensusReached = false;
      let currentRound = 1;
      let stopped = false;
      let lastStallResult: { stalled: boolean; stalledRounds: number } | undefined;

      while (!consensusReached && !stopped) {
        const controlFlag = this.sessionControlFlags.get(sessionId);
        if (controlFlag === 'paused') {
          const resumeResult = await this.waitWhilePaused(sessionId);
          if (resumeResult === 'stopped') {
            stopped = true;
            break;
          }
        } else if (controlFlag === 'stopped') {
          stopped = true;
          break;
        }

        await this.processInterventions(sessionId, currentRound);

        const messageCount = await this.messageService.countBySession(sessionId);

        if (messageCount >= session.maxMessages) {
          this.logger.log(
            `Session ${sessionId} reached max messages limit (${session.maxMessages})`,
          );
          break;
        }

        const currentExpert = experts[currentExpertIndex % experts.length];
        this.logger.log(`Expert turn: ${currentExpert.name} (${currentExpert.specialty})`);

        this.eventEmitter.emit(DISCUSSION_EVENTS.EXPERT_TURN_START, {
          sessionId,
          expertId: currentExpert.id,
          expertName: currentExpert.name,
          turnNumber: currentExpertIndex + 1,
        } as ExpertTurnStartEvent);

        const recentMessages = await this.messageService.findLatestBySession(sessionId, 10);

        const contextMessages = this.buildExpertContext(
          session,
          currentExpert,
          experts,
          recentMessages,
        );

        try {
          const driver = this.driverFactory.createDriver(currentExpert.driverType);
          const expertConfig = plainToInstance(LLMConfig, currentExpert.config);

          const startTime = Date.now();
          const response = await driver.chat(contextMessages, expertConfig);
          const responseTimeMs = Date.now() - startTime;
          this.logger.log(
            `Received response from ${currentExpert.name}: ${response.content.substring(0, 100)}...`,
          );

          const trimmedContent = response.content.trim();
          if (!trimmedContent) {
            this.logger.warn(
              `Expert ${currentExpert.name} returned empty response, skipping message creation`,
            );
            currentExpertIndex++;
            continue;
          }

          const message = await this.messageService.create({
            sessionId,
            expertId: currentExpert.id,
            content: trimmedContent,
            role: MessageRole.ASSISTANT,
            roundNumber: currentRound,
            promptTokens: response.usage?.promptTokens ?? undefined,
            completionTokens: response.usage?.completionTokens ?? undefined,
            totalTokens: response.usage?.totalTokens ?? undefined,
            model: response.model ?? undefined,
            responseTimeMs,
            finishReason: response.finishReason ?? undefined,
          });

          this.eventEmitter.emit(DISCUSSION_EVENTS.MESSAGE_CREATED, {
            sessionId,
            message,
          } as DiscussionMessageEvent);

        } catch (error) {
          this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
            sessionId,
            error: error.message,
            expertId: currentExpert.id,
          } as DiscussionErrorEvent);

          const isTransientError =
            error.name === 'LLMRateLimitException' ||
            error.name === 'LLMTimeoutException' ||
            error.name === 'LLMServiceException';

          if (isTransientError) {
            this.logger.warn(
              `Transient error for expert ${currentExpert.name}: ${error.message}. Continuing to next expert.`,
            );
          } else {
            this.logger.error(
              `Fatal error for expert ${currentExpert.name}: ${error.message}`,
              error.stack,
            );
            throw error;
          }
        }

        currentExpertIndex++;

        if (currentExpertIndex % experts.length === 0) {
          currentRound++;

          const evaluation = await this.consensusService.evaluateConsensus(
            sessionId,
            session,
            experts,
            currentRound - 1,
          );

          const threshold = (session as any).consensusThreshold ?? 0.8;
          if (
            evaluation.consensusReached &&
            evaluation.convergenceScore >= threshold
          ) {
            consensusReached = true;
            this.logger.log(`Consensus detected in session ${sessionId} (score: ${evaluation.convergenceScore})`);

            this.eventEmitter.emit(DISCUSSION_EVENTS.CONSENSUS_REACHED, {
              sessionId,
              consensusReached: true,
              finalMessage: null,
            } as DiscussionConsensusEvent);

            break;
          }

          const stallResult = this.consensusService.checkStallDetection(sessionId, evaluation);
          lastStallResult = stallResult;
          if (stallResult.stalled) {
            this.logger.log(`Session ${sessionId} stalled after ${stallResult.stalledRounds} rounds`);
            break;
          }

          if (
            evaluation.convergenceScore >= 0.7 &&
            !evaluation.consensusReached &&
            !(await this.consensusService.hasAutoPolledSession(sessionId))
          ) {
            const leadingProposal = evaluation.areasOfAgreement[0];
            if (leadingProposal) {
              await this.consensusService.createPoll(sessionId, leadingProposal, 'system');
            }
          }
        }

        await this.sleep(200);
      }

      const finalMessageCount = await this.messageService.countBySession(sessionId);

      const endReason = consensusReached
        ? 'consensus'
        : stopped
          ? 'cancelled'
          : lastStallResult?.stalled
            ? 'stalled'
            : finalMessageCount >= session.maxMessages
              ? 'max_messages'
              : 'cancelled';

      if (stopped) {
        await this.sessionService.update(sessionId, { status: SessionStatus.CANCELLED });
      } else {
        await this.concludeSession(sessionId, consensusReached);
      }

      this.eventEmitter.emit(DISCUSSION_EVENTS.SESSION_ENDED, {
        sessionId,
        consensusReached,
        reason: endReason,
        messageCount: finalMessageCount,
      } as DiscussionEndedEvent);

      this.consensusService
        .generateSummary(sessionId, session, experts, endReason)
        .catch((err) => this.logger.error(`Summary generation failed: ${err.message}`));

      this.interventionQueues.delete(sessionId);
      this.sessionControlFlags.delete(sessionId);
      this.pauseResolvers.delete(sessionId);
      this.consensusService.clearSessionState(sessionId);
    } catch (error) {
      this.logger.error(
        `Error during discussion in session ${sessionId}: ${error.message}`,
        error.stack,
      );

      this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
        sessionId,
        error: error.message,
      } as DiscussionErrorEvent);

      try {
        await this.sessionService.update(sessionId, { status: SessionStatus.CANCELLED });
      } catch (updateError) {
        this.logger.error(`Failed to cancel session ${sessionId}: ${updateError.message}`);
      }

      this.interventionQueues.delete(sessionId);
      this.sessionControlFlags.delete(sessionId);
      this.pauseResolvers.delete(sessionId);
      this.consensusService.clearSessionState(sessionId);

      throw error;
    }
  }

  /**
   * Build context messages for an expert's turn
   *
   * @param session - The current session
   * @param currentExpert - The expert taking the current turn
   * @param allExperts - All experts in the session
   * @param recentMessages - Recent messages from the discussion
   * @returns Array of LLM messages for context
   */
  private buildExpertContext(
    session: SessionResponseDto,
    currentExpert: ExpertResponseDto,
    allExperts: ExpertResponseDto[],
    recentMessages: MessageResponseDto[],
  ): LLMMessage[] {
    // Build system message with expert's role and instructions
    const expertList = allExperts
      .map((expert) => `- ${expert.name} (${expert.specialty})`)
      .join('\n');

    const systemMessage: LLMMessage = {
      role: 'system',
      content: `${currentExpert.systemPrompt}

Problem Statement:
${session.problemStatement}

Participating Experts:
${expertList}

Instructions:
You are participating in a collaborative discussion with other experts. Engage substantively with the problem and with other experts' positions. Express agreement or disagreement with specific points. Build on good ideas and challenge weak ones. You can reference other experts by name.`,
    };

    // Convert recent messages to LLM format
    const conversationMessages: LLMMessage[] = recentMessages.map((msg) => {
      const expertPrefix = msg.expertName ? `[${msg.expertName}] ` : '';
      return {
        role: this.mapMessageRoleToLLMRole(msg.role),
        content: `${expertPrefix}${msg.content}`,
      };
    });

    return [systemMessage, ...conversationMessages];
  }

  /**
   * Map Prisma MessageRole to LLM message role
   *
   * @param role - Prisma MessageRole enum value
   * @returns LLM message role
   */
  private mapMessageRoleToLLMRole(role: MessageRole): 'user' | 'assistant' | 'system' {
    switch (role) {
      case MessageRole.USER:
        return 'user';
      case MessageRole.ASSISTANT:
        return 'assistant';
      case MessageRole.SYSTEM:
        return 'system';
      default:
        return 'user';
    }
  }

  /**
   * Conclude a session by updating its status and consensus flag
   *
   * @param sessionId - The session ID to conclude
   * @param consensusReached - Whether consensus was reached
   */
  private async concludeSession(sessionId: string, consensusReached: boolean): Promise<void> {
    try {
      await this.sessionService.update(sessionId, {
        status: SessionStatus.COMPLETED,
        consensusReached,
      });

      this.logger.log(`Session ${sessionId} concluded. Consensus: ${consensusReached}`);
    } catch (error) {
      // Comment 3: Handle gracefully - only log error, don't propagate
      // This prevents transient DB failures from flipping completed discussions to CANCELLED
      this.logger.error(`Error concluding session ${sessionId}: ${error.message}`, error.stack);

      // Emit ERROR event
      this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
        sessionId,
        error: error.message,
      } as DiscussionErrorEvent);
    }
  }
}
