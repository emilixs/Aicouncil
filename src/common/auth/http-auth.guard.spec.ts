import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpAuthGuard } from './http-auth.guard';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

describe('HttpAuthGuard', () => {
  let guard: HttpAuthGuard;
  let reflector: Reflector;
  let authService: AuthService;

  const mockAuthService = {
    verifyToken: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpAuthGuard,
        { provide: AuthService, useValue: mockAuthService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<HttpAuthGuard>(HttpAuthGuard);
    reflector = module.get<Reflector>(Reflector);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  function createMockExecutionContext(
    headers: Record<string, string> = {},
  ): ExecutionContext {
    const request = { headers, user: undefined };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  describe('public routes', () => {
    it('should return true and skip token check when route is marked @Public()', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );
      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('valid token', () => {
    it('should return true and attach user to request when token is valid', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const payload = { sessionId: 'session-123', userId: 'user-456' };
      mockAuthService.verifyToken.mockReturnValue(payload);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token-here',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(
        'valid-token-here',
      );

      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(payload);
    });
  });

  describe('missing authorization header', () => {
    it('should throw UnauthorizedException when Authorization header is missing', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext({});

      expect(() => guard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('malformed authorization header', () => {
    it('should throw UnauthorizedException when header has no Bearer prefix', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext({
        authorization: 'Basic some-token',
      });

      expect(() => guard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when header is just "Bearer" with no token', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext({
        authorization: 'Bearer',
      });

      expect(() => guard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('invalid/expired token', () => {
    it('should throw UnauthorizedException when verifyToken returns null', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockAuthService.verifyToken.mockReturnValue(null);

      const context = createMockExecutionContext({
        authorization: 'Bearer expired-token',
      });

      expect(() => guard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(
        'expired-token',
      );
    });
  });
});
