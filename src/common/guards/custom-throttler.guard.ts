import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const ttlSeconds = Math.ceil(throttlerLimitDetail.ttl / 1000);

    const response = context.switchToHttp().getResponse();
    response.header('Retry-After', String(ttlSeconds));

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please try again later.',
        retryAfter: ttlSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
