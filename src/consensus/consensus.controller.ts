import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Public } from '../common/auth/public.decorator';
import { ConsensusService } from './consensus.service';
import { CreatePollDto, PollResponseDto } from './dto/poll.dto';
import { DiscussionOutcomeResponseDto } from './dto/discussion-outcome.dto';
import { ConsensusEvaluationResponseDto } from './dto/consensus-evaluation.dto';

@Public()
@Controller('sessions')
export class ConsensusController {
  constructor(private readonly consensusService: ConsensusService) {}

  @Get(':id/outcome')
  async getOutcome(@Param('id') sessionId: string) {
    const outcome = await this.consensusService.getOutcome(sessionId);
    if (!outcome) {
      throw new NotFoundException(`No outcome found for session ${sessionId}`);
    }
    return plainToInstance(DiscussionOutcomeResponseDto, outcome, { excludeExtraneousValues: true });
  }

  @Get(':id/evaluations')
  async getEvaluations(@Param('id') sessionId: string) {
    const evaluations = await this.consensusService.getEvaluations(sessionId);
    return plainToInstance(ConsensusEvaluationResponseDto, evaluations, { excludeExtraneousValues: true });
  }

  @Post(':id/poll')
  async createPoll(
    @Param('id') sessionId: string,
    @Body() createPollDto: CreatePollDto,
  ) {
    const poll = await this.consensusService.createPoll(sessionId, createPollDto.proposal, 'user');
    return plainToInstance(PollResponseDto, poll, { excludeExtraneousValues: true });
  }

  @Get(':id/polls')
  async getPolls(@Param('id') sessionId: string) {
    const polls = await this.consensusService.getPolls(sessionId);
    return plainToInstance(PollResponseDto, polls, { excludeExtraneousValues: true });
  }
}
