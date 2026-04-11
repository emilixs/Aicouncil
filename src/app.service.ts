import { Injectable } from '@nestjs/common';
import { PrismaService } from './common/prisma.service';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let database = 'disconnected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch {
      database = 'disconnected';
    }

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      version: process.env.npm_package_version || '0.0.1',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
