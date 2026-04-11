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
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async startDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    const session = await this.sessionService.findOne(id);

    if (session.type === 'COMPARISON') {
      await this.comparisonService.startComparison(id);
      return this.sessionService.findOne(id);
    }

    return this.councilService.startDiscussion(id);
  }
}
