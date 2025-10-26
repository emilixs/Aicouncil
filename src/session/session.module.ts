import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { ExpertModule } from '../expert/expert.module';
import { MessageModule } from '../message/message.module';

/**
 * Session module for managing expert council sessions.
 * Imports ExpertModule to validate expert IDs during session creation.
 * Exports SessionService for use by the Council orchestrator (subsequent phase).
 */
@Module({
  imports: [ExpertModule, MessageModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}

