import { Controller, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CouncilService } from './council.service';
import { ComparisonService } from './comparison.service';
import { SessionService } from '../session/session.service';
import { SessionResponseDto } from '../session/dto/session-response.dto';

@Controller('sessions')
export class CouncilController {
  constructor(
    private readonly councilService: CouncilService,
    private readonly comparisonService: ComparisonService,
    private readonly sessionService: SessionService,
  ) {}

  @Post(':id/start')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async startDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    const session = await this.sessionService.findOne(id);

    if (session.type === 'COMPARISON') {
      await this.comparisonService.startComparison(id);
      return this.sessionService.findOne(id);
    }

    return this.councilService.startDiscussion(id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  async pauseDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    await this.councilService.pauseDiscussion(id);
    return this.sessionService.findOne(id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.ACCEPTED)
  async resumeDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    await this.councilService.resumeDiscussion(id);
    return this.sessionService.findOne(id);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  async stopDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    await this.councilService.stopDiscussion(id);
    return this.sessionService.findOne(id);
  }
}
