import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket authentication guard
 * Checks if the client has been authenticated (user data exists)
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    
    if (!client.data.user) {
      throw new WsException('Unauthorized');
    }
    
    return true;
  }
}

