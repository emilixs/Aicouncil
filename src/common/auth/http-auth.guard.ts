import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class HttpAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException();
    }

    if (!authorization.startsWith('Bearer ') || authorization.length <= 7) {
      throw new UnauthorizedException();
    }

    const token = authorization.slice(7);

    const payload = this.authService.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException();
    }

    request.user = payload;
    return true;
  }
}
