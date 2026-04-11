import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerLimitDetail } from '@nestjs/throttler/dist/throttler.guard.interface';

// NOTE: For deployments behind a reverse proxy (e.g. nginx, CloudFront),
// override getTracker() to extract the real client IP from X-Forwarded-For
// or similar headers. The default implementation uses req.ip, which will
// be the proxy's IP and cause all clients to share a single rate limit bucket.

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const ttlSeconds = Math.ceil(throttlerLimitDetail.ttl / 1000);

    const response = context.switchToHttp().getResponse();
    response.header('Retry-After', String(ttlSeconds));
    response.header('X-RateLimit-Limit', throttlerLimitDetail.limit);
    response.header('X-RateLimit-Remaining', 0);
    response.header('X-RateLimit-Reset', throttlerLimitDetail.timeToExpire);

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
