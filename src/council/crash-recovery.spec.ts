import { Test, TestingModule } from '@nestjs/testing';
import { SessionStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AppModule } from '../app.module';

/**
 * RED phase tests for crash recovery.
 *
 * When the server restarts, any sessions with discussionStatus of RUNNING,
 * PAUSING, or STOPPING should be transitioned to FAILED, since the in-memory
 * discussion loop was lost on crash.
 *
 * These tests will FAIL because:
 * 1. AppModule doesn't implement OnApplicationBootstrap yet
 * 2. The discussionStatus field doesn't exist on sessions
 * 3. The DiscussionStatus enum doesn't exist in Prisma schema
 * 4. No crash recovery logic exists
 */

describe('Crash Recovery - OnApplicationBootstrap', () => {
  describe('sessions with in-flight discussionStatus', () => {
    let prismaService: any;

    beforeEach(() => {
      prismaService = {
        session: {
          findMany: jest.fn(),
          updateMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };
    });

    it('should mark RUNNING sessions as FAILED on bootstrap', async () => {
      prismaService.session.updateMany.mockResolvedValue({ count: 2 });

      // Act: create AppModule and trigger bootstrap
      // This will FAIL because AppModule doesn't implement onApplicationBootstrap
      const appModule = new (AppModule as any)(prismaService);
      // Inject prisma if constructor doesn't accept it
      if (appModule.prisma === undefined) {
        appModule.prisma = prismaService;
      }
      await appModule.onApplicationBootstrap();

      // Assert: should batch-update in-flight sessions to FAILED
      expect(prismaService.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            discussionStatus: {
              in: expect.arrayContaining(['RUNNING']),
            },
          },
          data: expect.objectContaining({
            discussionStatus: 'FAILED',
          }),
        }),
      );
    });

    it('should mark PAUSING sessions as FAILED on bootstrap', async () => {
      prismaService.session.updateMany.mockResolvedValue({ count: 1 });

      const appModule = new (AppModule as any)(prismaService);
      if (appModule.prisma === undefined) {
        appModule.prisma = prismaService;
      }
      await appModule.onApplicationBootstrap();

      expect(prismaService.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            discussionStatus: {
              in: expect.arrayContaining(['PAUSING']),
            },
          },
        }),
      );
    });

    it('should mark STOPPING sessions as FAILED on bootstrap', async () => {
      prismaService.session.updateMany.mockResolvedValue({ count: 1 });

      const appModule = new (AppModule as any)(prismaService);
      if (appModule.prisma === undefined) {
        appModule.prisma = prismaService;
      }
      await appModule.onApplicationBootstrap();

      expect(prismaService.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            discussionStatus: {
              in: expect.arrayContaining(['STOPPING']),
            },
          },
        }),
      );
    });

    it('should NOT affect PAUSED, STOPPED, COMPLETED, FAILED, or IDLE sessions', async () => {
      prismaService.session.updateMany.mockResolvedValue({ count: 0 });

      const appModule = new (AppModule as any)(prismaService);
      if (appModule.prisma === undefined) {
        appModule.prisma = prismaService;
      }
      await appModule.onApplicationBootstrap();

      // The filter should only target in-flight statuses
      const call = prismaService.session.updateMany.mock.calls[0][0];
      expect(call.where.discussionStatus.in).not.toContain('PAUSED');
      expect(call.where.discussionStatus.in).not.toContain('STOPPED');
      expect(call.where.discussionStatus.in).not.toContain('COMPLETED');
      expect(call.where.discussionStatus.in).not.toContain('FAILED');
      expect(call.where.discussionStatus.in).not.toContain('IDLE');
    });
  });

  describe('AppModule implements OnApplicationBootstrap', () => {
    it('should have onApplicationBootstrap method', () => {
      // This test verifies that AppModule will implement OnApplicationBootstrap
      // It will FAIL because AppModule doesn't implement it yet
      const appModule = new (AppModule as any)();
      expect(typeof appModule.onApplicationBootstrap).toBe('function');
    });
  });
});
