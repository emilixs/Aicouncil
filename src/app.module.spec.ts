import { Logger } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { PrismaService } from './common/prisma.service';
import { AppModule } from './app.module';

/**
 * TDD RED phase: Tests for crash recovery on application bootstrap.
 *
 * When the server starts, any sessions that were ACTIVE or PAUSED
 * (i.e., had a discussion in progress) should be marked as CANCELLED
 * because the in-memory discussion loop was lost on restart.
 *
 * Expected to FAIL until:
 * 1. AppModule implements OnApplicationBootstrap
 * 2. AppModule accepts PrismaService via constructor injection
 * 3. The bootstrap hook queries for orphaned ACTIVE/PAUSED sessions
 * 4. Orphaned sessions are transitioned to CANCELLED
 */
describe('AppModule - crash recovery on bootstrap', () => {
  it('should implement onApplicationBootstrap', () => {
    // AppModule must have an onApplicationBootstrap method
    // Currently AppModule is a plain @Module with no lifecycle hooks
    const proto = AppModule.prototype as any;
    expect(typeof proto.onApplicationBootstrap).toBe('function');
  });

  it('should mark ACTIVE sessions as CANCELLED on bootstrap', async () => {
    const mockPrisma = {
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    // Create an AppModule instance with injected PrismaService
    // This requires AppModule to accept PrismaService in its constructor
    const appModule = Object.create(AppModule.prototype);
    // Manually set the prisma property (simulating DI)
    (appModule as any).prisma = mockPrisma;
    (appModule as any).logger = new Logger(AppModule.name);

    // Execute bootstrap — this should call updateMany to mark orphaned sessions
    await (appModule as any).onApplicationBootstrap();

    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: expect.arrayContaining([SessionStatus.ACTIVE]) },
        },
        data: {
          status: SessionStatus.CANCELLED,
        },
      }),
    );
  });

  it('should mark PAUSED sessions as CANCELLED on bootstrap', async () => {
    const mockPrisma = {
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const appModule = Object.create(AppModule.prototype);
    (appModule as any).prisma = mockPrisma;
    (appModule as any).logger = new Logger(AppModule.name);

    await (appModule as any).onApplicationBootstrap();

    // The updateMany call should include PAUSED in the status filter
    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: expect.arrayContaining(['PAUSED']),
          },
        },
      }),
    );
  });

  it('should not fail if no orphaned sessions exist', async () => {
    const mockPrisma = {
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const appModule = Object.create(AppModule.prototype);
    (appModule as any).prisma = mockPrisma;

    // Should complete without error even when count is 0
    if (typeof (appModule as any).onApplicationBootstrap === 'function') {
      await expect(
        (appModule as any).onApplicationBootstrap(),
      ).resolves.not.toThrow();
    } else {
      fail('onApplicationBootstrap method does not exist on AppModule');
    }
  });
});
