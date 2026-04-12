import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { ConsensusService } from './consensus.service';
import { CreatePollDto } from './dto/poll.dto';

@Controller('sessions')
export class ConsensusController {
  constructor(private readonly consensusService: ConsensusService) {}

  @Get(':id/outcome')
  async getOutcome(@Param('id') sessionId: string) {
    const outcome = await this.consensusService.getOutcome(sessionId);
    if (!outcome) {
      throw new NotFoundException(`No outcome found for session ${sessionId}`);
    }
    return outcome;
  }

  @Get(':id/evaluations')
  async getEvaluations(@Param('id') sessionId: string) {
    return this.consensusService.getEvaluations(sessionId);
  }

  @Post(':id/poll')
  async createPoll(
    @Param('id') sessionId: string,
    @Body() createPollDto: CreatePollDto,
  ) {
    return this.consensusService.createPoll(sessionId, createPollDto.proposal, 'user');
  }

  @Get(':id/polls')
  async getPolls(@Param('id') sessionId: string) {
    return this.consensusService.getPolls(sessionId);
  }
}
