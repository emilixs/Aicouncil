import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    // Create instance — we only test the throwThrottlingException override
    // The guard extends ThrottlerGuard which requires DI, but we can
    // instantiate with nulls since we only call our override method directly
    guard = Object.create(CustomThrottlerGuard.prototype);
  });

  describe('throwThrottlingException', () => {
    it('should throw HttpException with 429 status', async () => {
      const mockResponse = {
        header: jest.fn(),
      };
      const mockContext = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;

      const throttlerLimitDetail = { ttl: 60000, limit: 3, totalHits: 4 };

      await expect(
        (guard as any).throwThrottlingException(mockContext, throttlerLimitDetail),
      ).rejects.toThrow(HttpException);
    });

    it('should set Retry-After header on the response', async () => {
      const mockResponse = {
        header: jest.fn(),
      };
      const mockContext = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;

      const throttlerLimitDetail = { ttl: 60000, limit: 3, totalHits: 4 };

      try {
        await (guard as any).throwThrottlingException(mockContext, throttlerLimitDetail);
      } catch {
        // expected
      }

      expect(mockResponse.header).toHaveBeenCalledWith('Retry-After', '60');
    });

    it('should include retryAfter in the response body', async () => {
      const mockResponse = {
        header: jest.fn(),
      };
      const mockContext = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;

      const throttlerLimitDetail = { ttl: 30000, limit: 5, totalHits: 6 };

      try {
        await (guard as any).throwThrottlingException(mockContext, throttlerLimitDetail);
        fail('Expected HttpException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const response = (error as HttpException).getResponse();
        expect(response).toEqual({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: 30,
        });
      }
    });

    it('should throw with 429 status code', async () => {
      const mockResponse = {
        header: jest.fn(),
      };
      const mockContext = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;

      const throttlerLimitDetail = { ttl: 60000, limit: 3, totalHits: 4 };

      try {
        await (guard as any).throwThrottlingException(mockContext, throttlerLimitDetail);
        fail('Expected HttpException to be thrown');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });
});
