import { Module } from '@nestjs/common';
import { ConsensusService } from './consensus.service';
import { ConsensusController } from './consensus.controller';
import { LlmModule } from '../llm/llm.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [LlmModule, MessageModule],
  controllers: [ConsensusController],
  providers: [ConsensusService],
  exports: [ConsensusService],
})
export class ConsensusModule {}
