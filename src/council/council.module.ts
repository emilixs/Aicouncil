import { Module } from '@nestjs/common';
import { CouncilController } from './council.controller';
import { CouncilService } from './council.service';
import { SessionModule } from '../session/session.module';
import { MessageModule } from '../message/message.module';
import { LlmModule } from '../llm/llm.module';

/**
 * Council module for orchestrating multi-agent discussions.
 *
 * This module provides:
 * - CouncilController: REST endpoint for starting discussions (POST /sessions/:id/start)
 * - CouncilService: Core orchestration logic for managing expert discussions
 *
 * Dependencies:
 * - SessionModule: Session management and status transitions (includes expert data via session.experts)
 * - MessageModule: Message creation and retrieval
 * - LlmModule: LLM driver factory for generating expert responses
 *
 * Exports:
 * - CouncilService: Available for future WebSocket gateway to enable real-time streaming
 */
@Module({
  imports: [SessionModule, MessageModule, LlmModule],
  controllers: [CouncilController],
  providers: [CouncilService],
  exports: [CouncilService],
})
export class CouncilModule {}

