import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SessionStatus, MessageRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
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
  private controlSignals: Map<string, 'pause' | 'stop'> = new Map();
  private pauseResolvers: Map<string, () => void> = new Map();

  constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly driverFactory: DriverFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Sleep utility for inter-turn delay
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Queue a user intervention to be processed before the next expert turn
   * @param sessionId - The session ID
   * @param content - The intervention message content
   * @param userId - Optional user ID
   * @returns true if intervention was queued, false if session is not ACTIVE or on failure
   */
  async queueIntervention(sessionId: string, content: string, userId?: string): Promise<boolean> {
    try {
      // Verify session status before queuing
      const session = await this.sessionService.findOne(sessionId);

      if (session.status !== SessionStatus.ACTIVE) {
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
  private async processInterventions(sessionId: string): Promise<void> {
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
   * Pause an active discussion. The loop will stop after the current turn.
   * @param sessionId - The session ID
   * @throws BadRequestException if session is not ACTIVE
   */
  async pauseDiscussion(sessionId: string): Promise<void> {
    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot pause discussion: session status is ${session.status}. Must be ACTIVE.`,
      );
    }
    this.controlSignals.set(sessionId, 'pause');
  }

  /**
   * Stop an active or paused discussion. Transitions to CANCELLED.
   * @param sessionId - The session ID
   * @throws BadRequestException if session is not ACTIVE or PAUSED
   */
  async stopDiscussion(sessionId: string): Promise<void> {
    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.PAUSED) {
      throw new BadRequestException(
        `Cannot stop discussion: session status is ${session.status}. Must be ACTIVE or PAUSED.`,
      );
    }
    this.controlSignals.set(sessionId, 'stop');
    // If paused, resolve the pause promise so the loop can process the stop signal
    const resolver = this.pauseResolvers.get(sessionId);
    if (resolver) {
      resolver();
    }
  }

  /**
   * Resume a paused discussion.
   * @param sessionId - The session ID
   * @throws BadRequestException if session is not PAUSED
   */
  async resumeDiscussion(sessionId: string): Promise<void> {
    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.PAUSED) {
      throw new BadRequestException(
        `Cannot resume discussion: session status is ${session.status}. Must be PAUSED.`,
      );
    }
    // Check for pending stop signal before transitioning to ACTIVE.
    // If stop was requested while paused, skip the ACTIVE transition —
    // the loop will handle the stop signal after the pause promise resolves.
    const pendingSignal = this.controlSignals.get(sessionId);
    if (pendingSignal === 'stop') {
      const resolver = this.pauseResolvers.get(sessionId);
      if (resolver) {
        resolver();
      }
      return;
    }
    await this.sessionService.update(sessionId, { status: SessionStatus.ACTIVE });
    this.eventEmitter.emit(DISCUSSION_EVENTS.SESSION_RESUMED, { sessionId });
    // Resolve the pause promise to let the loop continue
    const resolver = this.pauseResolvers.get(sessionId);
    if (resolver) {
      resolver();
    }
  }

  /**
   * Start a multi-agent discussion for a session.
   * Returns immediately after transitioning to ACTIVE; the loop runs in background.
   *
   * @param sessionId - The session ID to start
   * @returns The session in ACTIVE status
   * @throws BadRequestException if session is not in PENDING status
   */
  async startDiscussion(sessionId: string): Promise<SessionResponseDto> {
    // Validate session exists and is in PENDING status
    const session = await this.sessionService.findOne(sessionId);

    if (session.status !== SessionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot start discussion for session with status ${session.statusDisplay}. Session must be in pending status.`,
      );
    }

    const experts = session.experts;

    if (experts.length === 0) {
      throw new BadRequestException(
        'Cannot start discussion for session with no experts. Session must have at least one expert.',
      );
    }

    // Pre-validate expert configs and API keys before switching session to ACTIVE
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

    // Transition session to ACTIVE
    await this.sessionService.update(sessionId, { status: SessionStatus.ACTIVE });
    this.logger.log(`Session ${sessionId} transitioned to ACTIVE`);

    // Initialize intervention queue
    this.interventionQueues.set(sessionId, []);

    // Run discussion loop in background (fire-and-forget)
    this.runDiscussionLoop(sessionId, session).catch((error) => {
      this.logger.error(
        `Background discussion loop error for session ${sessionId}: ${error.message}`,
        error.stack,
      );
    });

    // Return immediately
    return await this.sessionService.findOne(sessionId);
  }

  /**
   * The main discussion loop, run in background after startDiscussion returns.
   */
  private async runDiscussionLoop(sessionId: string, session: SessionResponseDto): Promise<void> {
    const experts = session.experts;
    let currentExpertIndex = 0;
    let consensusReached = false;
    let stopped = false;

    try {
      while (!consensusReached) {
        // Check control signals before each turn
        const signal = this.controlSignals.get(sessionId);

        if (signal === 'stop') {
          this.controlSignals.delete(sessionId);
          stopped = true;
          break;
        }

        if (signal === 'pause') {
          this.controlSignals.delete(sessionId);
          // Transition to PAUSED
          await this.sessionService.update(sessionId, { status: SessionStatus.PAUSED });
          this.eventEmitter.emit(DISCUSSION_EVENTS.SESSION_PAUSED, { sessionId });

          // Wait until resumed or stopped
          await new Promise<void>((resolve) => {
            this.pauseResolvers.set(sessionId, resolve);
          });
          this.pauseResolvers.delete(sessionId);

          // After waking up, check if we should stop
          const newSignal = this.controlSignals.get(sessionId);
          if (newSignal === 'stop') {
            this.controlSignals.delete(sessionId);
            stopped = true;
            break;
          }
          continue;
        }

        // Process any queued interventions before expert turn
        await this.processInterventions(sessionId);

        // Check message count
        const messageCount = await this.messageService.countBySession(sessionId);

        if (messageCount >= session.maxMessages) {
          this.logger.log(
            `Session ${sessionId} reached max messages limit (${session.maxMessages})`,
          );
          break;
        }

        // Select next expert using round-robin
        const currentExpert = experts[currentExpertIndex % experts.length];
        this.logger.log(`Expert turn: ${currentExpert.name} (${currentExpert.specialty})`);

        // Emit expert turn start event
        this.eventEmitter.emit(DISCUSSION_EVENTS.EXPERT_TURN_START, {
          sessionId,
          expertId: currentExpert.id,
          expertName: currentExpert.name,
          turnNumber: currentExpertIndex + 1,
        } as ExpertTurnStartEvent);

        // Retrieve recent messages for context
        const recentMessages = await this.messageService.findLatestBySession(sessionId, 10);

        // Build context for the current expert
        const contextMessages = this.buildExpertContext(
          session,
          currentExpert,
          experts,
          recentMessages,
        );

        try {
          // Create LLM driver for the expert
          const driver = this.driverFactory.createDriver(currentExpert.driverType);

          // Transform config
          const expertConfig = plainToInstance(LLMConfig, currentExpert.config);

          // Get response from LLM
          const response = await driver.chat(contextMessages, expertConfig);
          this.logger.log(
            `Received response from ${currentExpert.name}: ${response.content.substring(0, 100)}...`,
          );

          // Guard against empty or whitespace-only LLM responses
          const trimmedContent = response.content.trim();
          if (!trimmedContent) {
            this.logger.warn(
              `Expert ${currentExpert.name} returned empty response, skipping message creation`,
            );
            currentExpertIndex++;
            continue;
          }

          // Save the LLM response before checking signals — we already paid for it,
          // and discarding it would lose work. Pause/stop takes effect at the next turn boundary.
          const message = await this.messageService.create({
            sessionId,
            expertId: currentExpert.id,
            content: trimmedContent,
            role: MessageRole.ASSISTANT,
          });

          // Check control signals after saving the response
          const midTurnSignal = this.controlSignals.get(sessionId);
          if (midTurnSignal === 'pause' || midTurnSignal === 'stop') {
            // Emit message event so clients see the saved response
            this.eventEmitter.emit(DISCUSSION_EVENTS.MESSAGE_CREATED, {
              sessionId,
              message,
            } as DiscussionMessageEvent);
            continue; // Let the top of the loop handle the signal
          }

          // Emit message created event
          this.eventEmitter.emit(DISCUSSION_EVENTS.MESSAGE_CREATED, {
            sessionId,
            message,
          } as DiscussionMessageEvent);

          // Check for consensus
          consensusReached = this.detectConsensus(trimmedContent);

          if (consensusReached) {
            this.logger.log(`Consensus detected in session ${sessionId}`);

            // Emit consensus reached event
            this.eventEmitter.emit(DISCUSSION_EVENTS.CONSENSUS_REACHED, {
              sessionId,
              consensusReached: true,
              finalMessage: message,
            } as DiscussionConsensusEvent);

            break;
          }
        } catch (error) {
          // Emit error event
          this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
            sessionId,
            error: error.message,
            expertId: currentExpert.id,
          } as DiscussionErrorEvent);

          // Handle transient errors gracefully without cancelling session
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

        // Move to next expert
        currentExpertIndex++;

        // Check signals before sleeping
        const endTurnSignal = this.controlSignals.get(sessionId);
        if (endTurnSignal === 'pause' || endTurnSignal === 'stop') {
          continue; // Skip sleep, go straight to signal handling at top of loop
        }

        // Add small inter-turn delay to reduce provider rate-limit risk
        await this.sleep(200);
      }

      if (stopped) {
        // Stop: transition to CANCELLED
        await this.sessionService.update(sessionId, { status: SessionStatus.CANCELLED });

        const finalMessageCount = await this.messageService.countBySession(sessionId);
        this.eventEmitter.emit(DISCUSSION_EVENTS.SESSION_ENDED, {
          sessionId,
          consensusReached: false,
          reason: 'stopped',
          messageCount: finalMessageCount,
        } as DiscussionEndedEvent);
      } else {
        // Normal completion
        await this.concludeSession(sessionId, consensusReached);

        const finalMessageCount = await this.messageService.countBySession(sessionId);
        const endReason = consensusReached
          ? 'consensus'
          : finalMessageCount >= session.maxMessages
            ? 'max_messages'
            : 'cancelled';

        this.eventEmitter.emit(DISCUSSION_EVENTS.SESSION_ENDED, {
          sessionId,
          consensusReached,
          reason: endReason,
          messageCount: finalMessageCount,
        } as DiscussionEndedEvent);
      }

      // Cleanup
      this.interventionQueues.delete(sessionId);
      this.controlSignals.delete(sessionId);
    } catch (error) {
      this.logger.error(
        `Error during discussion in session ${sessionId}: ${error.message}`,
        error.stack,
      );

      // Emit error event
      this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
        sessionId,
        error: error.message,
      } as DiscussionErrorEvent);

      // Attempt to set session to CANCELLED on error
      try {
        await this.sessionService.update(sessionId, { status: SessionStatus.CANCELLED });
      } catch (updateError) {
        this.logger.error(`Failed to cancel session ${sessionId}: ${updateError.message}`);
      }

      // Cleanup
      this.interventionQueues.delete(sessionId);
      this.controlSignals.delete(sessionId);
    }
  }

  /**
   * Build context messages for an expert's turn
   */
  private buildExpertContext(
    session: SessionResponseDto,
    currentExpert: ExpertResponseDto,
    allExperts: ExpertResponseDto[],
    recentMessages: MessageResponseDto[],
  ): LLMMessage[] {
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
You are participating in a collaborative discussion with other experts. Work towards consensus on the problem statement. When consensus is reached, explicitly state "I agree" or "consensus reached" in your response. You can reference other experts by name in your discussion.`,
    };

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
   * Detect if consensus has been reached based on message content
   */
  private detectConsensus(messageContent: string): boolean {
    const keywords = [
      'i agree',
      'consensus reached',
      'we agree',
      'i concur',
      'agreed',
      'we have consensus',
      'we reached consensus',
      'in agreement',
    ];

    const contentLower = messageContent.toLowerCase();

    return keywords.some((keyword) => contentLower.includes(keyword));
  }

  /**
   * Conclude a session by updating its status and consensus flag
   */
  private async concludeSession(sessionId: string, consensusReached: boolean): Promise<void> {
    try {
      await this.sessionService.update(sessionId, {
        status: SessionStatus.COMPLETED,
        consensusReached,
      });

      this.logger.log(`Session ${sessionId} concluded. Consensus: ${consensusReached}`);
    } catch (error) {
      this.logger.error(`Error concluding session ${sessionId}: ${error.message}`, error.stack);

      this.eventEmitter.emit(DISCUSSION_EVENTS.ERROR, {
        sessionId,
        error: error.message,
      } as DiscussionErrorEvent);
    }
  }
}
