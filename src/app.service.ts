import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(dbHealthy: boolean) {
    return {
      status: dbHealthy ? 'ok' : 'degraded',
      version: '0.0.1',
      uptime: process.uptime(),
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
