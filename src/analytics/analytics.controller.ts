import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(@Query('from') from?: string, @Query('to') to?: string) {
    const filter = from || to ? { from, to } : undefined;
    return this.analyticsService.getOverview(filter);
  }

  @Get('sessions')
  async getSessions() {
    return this.analyticsService.getSessionsList();
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.analyticsService.getSessionAnalytics(id);
  }

  @Get('experts')
  async getExperts() {
    return this.analyticsService.getExpertsList();
  }

  @Get('experts/:id')
  async getExpert(@Param('id') id: string) {
    return this.analyticsService.getExpertAnalytics(id);
  }

  @Get('comparisons')
  async getComparisons() {
    return this.analyticsService.getComparisons();
  }
}
