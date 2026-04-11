import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthService } from './auth/auth.service';
import { WsAuthGuard } from './auth/ws-auth.guard';
import { HttpAuthGuard } from './auth/http-auth.guard';

@Global()
@Module({
  providers: [PrismaService, AuthService, WsAuthGuard, HttpAuthGuard],
  exports: [PrismaService, AuthService, WsAuthGuard, HttpAuthGuard],
})
export class CommonModule {}
