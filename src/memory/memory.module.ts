import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { CommonModule } from '../common/common.module';
import { LlmModule } from '../llm/llm.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [CommonModule, LlmModule, MessageModule],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
