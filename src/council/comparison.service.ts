import { Injectable, BadRequestException } from '@nestjs/common';
import { SessionStatus, MessageRole } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { MessageResponseDto } from '../message/dto/message-response.dto';
import {
  COMPARISON_EVENTS,
  ComparisonResponseEvent,
  ComparisonAllReceivedEvent,
  ComparisonErrorEvent,
} from './events/comparison.events';

@Injectable()
export class ComparisonService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly driverFactory: DriverFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async startComparison(sessionId: string): Promise<void> {
    const session = await this.sessionService.findOne(sessionId);

    if (session.type !== 'COMPARISON') {
      throw new BadRequestException(
        'Session type must be COMPARISON to start a comparison',
      );
    }

    if (session.status !== SessionStatus.PENDING) {
      throw new BadRequestException(
        'Session must be in PENDING status to start a comparison',
      );
    }

    // Transition to ACTIVE
    await this.sessionService.update(sessionId, {
      status: SessionStatus.ACTIVE,
    });

    this.eventEmitter.emit(COMPARISON_EVENTS.COMPARISON_STARTED, {
      sessionId,
    });

    const experts = session.experts;
    const totalExperts = experts.length;
    const startTime = Date.now();
    const completedMessages: MessageResponseDto[] = [];
    let completedCount = 0;

    // Dispatch all experts in parallel
    const results = await Promise.allSettled(
      experts.map(async (expert: any) => {
        const expertStartTime = Date.now();
        const driver = this.driverFactory.createDriver(expert.driverType);

        const context = [
          { role: 'system' as const, content: expert.systemPrompt },
          { role: 'user' as const, content: session.problemStatement },
        ];

        const response = await driver.chat(context, expert.config);
        const durationMs = Math.max(Date.now() - expertStartTime, 1);

        const message = await this.messageService.create({
          sessionId,
          content: response.content,
          expertId: expert.id,
          role: MessageRole.ASSISTANT,
          isIntervention: false,
          durationMs,
          tokenCount: response.usage?.totalTokens ?? null,
          modelUsed: response.model,
        } as any);

        completedCount++;
        completedMessages.push(message);

        this.eventEmitter.emit(COMPARISON_EVENTS.RESPONSE_RECEIVED, {
          sessionId,
          message,
          completedCount,
          totalExperts,
        } as ComparisonResponseEvent);

        return message;
      }),
    );

    // Handle errors
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const expert = experts[index] as any;
        this.eventEmitter.emit(COMPARISON_EVENTS.COMPARISON_ERROR, {
          sessionId,
          expertId: expert.id,
          expertName: expert.name,
          error: result.reason?.message || 'Unknown error',
        } as ComparisonErrorEvent);
      }
    });

    const totalDurationMs = Date.now() - startTime;

    this.eventEmitter.emit(COMPARISON_EVENTS.ALL_RESPONSES_RECEIVED, {
      sessionId,
      messages: completedMessages,
      totalDurationMs,
    } as ComparisonAllReceivedEvent);

    // Transition to COMPLETED
    await this.sessionService.update(sessionId, {
      status: SessionStatus.COMPLETED,
    });
  }
}
