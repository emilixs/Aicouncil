import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SessionStatus, MessageRole } from '@prisma/client';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { ExpertService } from '../expert/expert.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { SessionResponseDto } from '../session/dto';
import { ExpertResponseDto } from '../expert/dto';
import { MessageResponseDto } from '../message/dto';
import { LLMMessage, LLMConfig } from '../llm/dto';

/**
 * CouncilService - Core orchestration service for multi-agent discussions
 * 
 * Manages the discussion loop between experts, handles consensus detection,
 * and coordinates session lifecycle transitions.
 */
@Injectable()
export class CouncilService {
  private readonly logger = new Logger(CouncilService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly expertService: ExpertService,
    private readonly driverFactory: DriverFactory,
  ) {}

  /**
   * Start a multi-agent discussion for a session
   * 
   * @param sessionId - The session ID to start
   * @returns The completed session with final status
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

    try {
      // Transition session to ACTIVE
      await this.sessionService.update(sessionId, { status: SessionStatus.ACTIVE });
      this.logger.log(`Session ${sessionId} transitioned to ACTIVE`);

      // Retrieve full expert details
      const experts: ExpertResponseDto[] = await Promise.all(
        session.experts.map((expert) => this.expertService.findOne(expert.id)),
      );

      this.logger.log(`Starting discussion with ${experts.length} experts`);

      // Initialize discussion loop variables
      let currentExpertIndex = 0;
      let consensusReached = false;

      // Main discussion loop
      while (!consensusReached) {
        // Check message count
        const messageCount = await this.messageService.countBySession(sessionId);
        
        if (messageCount >= session.maxMessages) {
          this.logger.log(`Session ${sessionId} reached max messages limit (${session.maxMessages})`);
          break;
        }

        // Select next expert using round-robin
        const currentExpert = experts[currentExpertIndex % experts.length];
        this.logger.log(`Expert turn: ${currentExpert.name} (${currentExpert.specialty})`);

        // Retrieve recent messages for context
        const recentMessages = await this.messageService.findLatestBySession(sessionId, 10);

        // Build context for the current expert
        const contextMessages = this.buildExpertContext(
          session,
          currentExpert,
          experts,
          recentMessages,
        );

        // Create LLM driver for the expert
        const driver = this.driverFactory.createDriver(currentExpert.driverType);

        // Parse expert config to LLMConfig
        const expertConfig = currentExpert.config as unknown as LLMConfig;

        // Get response from LLM
        const response = await driver.chat(contextMessages, expertConfig);
        this.logger.log(`Received response from ${currentExpert.name}: ${response.content.substring(0, 100)}...`);

        // Create message in database
        await this.messageService.create({
          sessionId,
          expertId: currentExpert.id,
          content: response.content,
          role: MessageRole.ASSISTANT,
        });

        // Check for consensus
        consensusReached = this.detectConsensus(response.content);
        
        if (consensusReached) {
          this.logger.log(`Consensus detected in session ${sessionId}`);
          break;
        }

        // Move to next expert
        currentExpertIndex++;
      }

      // Conclude the session
      await this.concludeSession(sessionId, consensusReached);

      // Return final session state
      return await this.sessionService.findOne(sessionId);
    } catch (error) {
      this.logger.error(`Error during discussion in session ${sessionId}: ${error.message}`, error.stack);
      
      // Attempt to set session to CANCELLED on error
      try {
        await this.sessionService.update(sessionId, { status: SessionStatus.CANCELLED });
      } catch (updateError) {
        this.logger.error(`Failed to cancel session ${sessionId}: ${updateError.message}`);
      }
      
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
You are participating in a collaborative discussion with other experts. Work towards consensus on the problem statement. When consensus is reached, explicitly state "I agree" or "consensus reached" in your response. You can reference other experts by name in your discussion.`,
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
   * Detect if consensus has been reached based on message content
   * 
   * @param messageContent - The message content to analyze
   * @returns True if consensus keywords are detected
   */
  private detectConsensus(messageContent: string): boolean {
    const keywords = [
      'i agree',
      'consensus reached',
      'we agree',
      'i concur',
      'agreed',
      'we have consensus',
    ];

    const contentLower = messageContent.toLowerCase();
    
    return keywords.some((keyword) => contentLower.includes(keyword));
  }

  /**
   * Conclude a session by updating its status and consensus flag
   * 
   * @param sessionId - The session ID to conclude
   * @param consensusReached - Whether consensus was reached
   */
  private async concludeSession(
    sessionId: string,
    consensusReached: boolean,
  ): Promise<void> {
    try {
      await this.sessionService.update(sessionId, {
        status: SessionStatus.COMPLETED,
        consensusReached,
      });

      this.logger.log(
        `Session ${sessionId} concluded. Consensus: ${consensusReached}`,
      );
    } catch (error) {
      this.logger.error(
        `Error concluding session ${sessionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

