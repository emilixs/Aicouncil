import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthService } from './auth/auth.service';
import { WsAuthGuard } from './auth/ws-auth.guard';

@Global()
@Module({
  providers: [PrismaService, AuthService, WsAuthGuard],
  exports: [PrismaService, AuthService, WsAuthGuard],
})
export class CommonModule {}

