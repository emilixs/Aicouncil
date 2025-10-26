import { Module } from '@nestjs/common';
import { CouncilService } from './council.service';
import { SessionModule } from '../session/session.module';
import { MessageModule } from '../message/message.module';
import { ExpertModule } from '../expert/expert.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [SessionModule, MessageModule, ExpertModule, LlmModule],
  controllers: [],
  providers: [CouncilService],
  exports: [CouncilService],
})
export class CouncilModule {}

