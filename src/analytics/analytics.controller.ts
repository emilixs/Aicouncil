import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { AnalyticsService } from './analytics.service';

@Public()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(@Query('from') from?: string, @Query('to') to?: string) {
    const filter = from || to ? { from, to } : undefined;
    return this.analyticsService.getOverview(filter);
  }

  @Get('sessions')
  async getSessions(@Query('from') from?: string, @Query('to') to?: string) {
    const filter = from || to ? { from, to } : undefined;
    return this.analyticsService.getSessionsList(filter);
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.analyticsService.getSessionAnalytics(id);
  }

  @Get('experts')
  async getExperts(@Query('from') from?: string, @Query('to') to?: string) {
    const filter = from || to ? { from, to } : undefined;
    return this.analyticsService.getExpertsList(filter);
  }

  @Get('experts/:id')
  async getExpert(@Param('id') id: string) {
    return this.analyticsService.getExpertAnalytics(id);
  }

  @Get('comparisons')
  async getComparisons(@Query('from') from?: string, @Query('to') to?: string) {
    const filter = from || to ? { from, to } : undefined;
    return this.analyticsService.getComparisons(filter);
  }
}
