import { Module } from '@nestjs/common';
import { CouncilController } from './council.controller';
import { CouncilService } from './council.service';
import { SessionModule } from '../session/session.module';
import { MessageModule } from '../message/message.module';
import { LlmModule } from '../llm/llm.module';
import { MemoryModule } from '../memory/memory.module';
import { DiscussionGateway } from './gateways/discussion.gateway';

@Module({
  imports: [SessionModule, MessageModule, LlmModule, MemoryModule],
  controllers: [CouncilController],
  providers: [CouncilService, DiscussionGateway],
  exports: [CouncilService],
})
export class CouncilModule {}
