import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { MessageModule } from '../message/message.module';

/**
 * Session module for managing expert council sessions.
 * Exports SessionService for use by the Council orchestrator (subsequent phase).
 */
@Module({
  imports: [MessageModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}

