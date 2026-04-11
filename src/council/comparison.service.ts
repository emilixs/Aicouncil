import { Injectable } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * ComparisonService - Orchestrates parallel expert comparisons
 *
 * Dispatches the same prompt to all experts simultaneously and collects
 * their responses with timing and token metrics for side-by-side comparison.
 *
 * Stub: implementation pending (TDD RED phase).
 */
@Injectable()
export class ComparisonService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly driverFactory: DriverFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Start a comparison session — dispatches all experts in parallel.
   *
   * @param sessionId - The session ID to start
   * @throws BadRequestException if session type is not COMPARISON or status is not PENDING
   */
  async startComparison(sessionId: string): Promise<void> {
    // TODO: implement in GREEN phase
  }
}
