import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    // Create instance without full DI — we only test throwThrottlingException
    guard = Object.create(CustomThrottlerGuard.prototype);
  });

  describe('throwThrottlingException', () => {
    let mockContext: ExecutionContext;
    let mockResponse: { header: jest.Mock };

    beforeEach(() => {
      mockResponse = { header: jest.fn() };
      mockContext = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => ({}),
        }),
        getClass: () => ({}),
        getHandler: () => ({}),
      } as unknown as ExecutionContext;
    });

    it('should set Retry-After header on the response', async () => {
      const throttlerLimitDetail = { ttl: 60000, limit: 30, totalHits: 31 };

      try {
        await (guard as any).throwThrottlingException(
          mockContext,
          throttlerLimitDetail,
        );
      } catch {
        // expected
      }

      expect(mockResponse.header).toHaveBeenCalledWith('Retry-After', '60');
    });

    it('should throw HttpException with 429 status', async () => {
      const throttlerLimitDetail = { ttl: 60000, limit: 30, totalHits: 31 };

      await expect(
        (guard as any).throwThrottlingException(
          mockContext,
          throttlerLimitDetail,
        ),
      ).rejects.toThrow(HttpException);

      try {
        await (guard as any).throwThrottlingException(
          mockContext,
          throttlerLimitDetail,
        );
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });

    it('should include statusCode, message, and retryAfter in response body', async () => {
      const throttlerLimitDetail = { ttl: 60000, limit: 30, totalHits: 31 };

      try {
        await (guard as any).throwThrottlingException(
          mockContext,
          throttlerLimitDetail,
        );
        fail('Expected throwThrottlingException to throw');
      } catch (error) {
        const response = (error as HttpException).getResponse();
        expect(response).toEqual({
          statusCode: 429,
          message: 'Too many requests. Please try again later.',
          retryAfter: 60,
        });
      }
    });

    it('should calculate retryAfter in seconds from ttl in milliseconds', async () => {
      const throttlerLimitDetail = { ttl: 120000, limit: 10, totalHits: 11 };

      try {
        await (guard as any).throwThrottlingException(
          mockContext,
          throttlerLimitDetail,
        );
      } catch (error) {
        const response = (error as HttpException).getResponse() as any;
        expect(response.retryAfter).toBe(120);
      }

      expect(mockResponse.header).toHaveBeenCalledWith('Retry-After', '120');
    });
  });
});
