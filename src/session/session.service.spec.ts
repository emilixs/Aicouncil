import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { SessionService } from './session.service';
import { PrismaService } from '../common/prisma.service';

/**
 * TDD RED phase: Tests for PAUSED state transitions in SessionService.
 *
 * These tests define the desired behavior for the new PAUSED status
 * that will be added as part of the async discussion orchestration feature.
 *
 * Expected to FAIL until:
 * 1. PAUSED is added to the SessionStatus enum in prisma/schema.prisma
 * 2. validateStatusTransition is updated to handle PAUSED transitions
 * 3. getValidTransitions is updated to include PAUSED
 */
describe('SessionService - PAUSED state transitions', () => {
  let service: SessionService;
  let prisma: PrismaService;

  // Helper to create a mock session in a given status
  const mockSession = (status: SessionStatus) => ({
    id: 'test-session-id',
    problemStatement: 'Test problem',
    status,
    statusDisplay: status.toLowerCase(),
    maxMessages: 20,
    consensusReached: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    experts: [],
    messageCount: 0,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: {
            session: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('ACTIVE -> PAUSED transition', () => {
    it('should allow transitioning from ACTIVE to PAUSED', async () => {
      // Arrange: session is ACTIVE
      const session = mockSession(SessionStatus.ACTIVE);
      jest.spyOn(service, 'findOne').mockResolvedValue(session as any);
      (prisma.session.update as jest.Mock).mockResolvedValue({
        ...session,
        status: 'PAUSED' as SessionStatus,
        experts: [],
        _count: { messages: 0 },
      });

      // Act & Assert: should not throw
      // This will fail because PAUSED doesn't exist in SessionStatus enum yet
      await expect(
        service.update('test-session-id', { status: 'PAUSED' as SessionStatus }),
      ).resolves.toBeDefined();
    });
  });

  describe('PAUSED -> ACTIVE transition', () => {
    it('should allow transitioning from PAUSED to ACTIVE (resume)', async () => {
      // Arrange: session is PAUSED
      const session = mockSession('PAUSED' as SessionStatus);
      jest.spyOn(service, 'findOne').mockResolvedValue(session as any);
      (prisma.session.update as jest.Mock).mockResolvedValue({
        ...session,
        status: SessionStatus.ACTIVE,
        experts: [],
        _count: { messages: 0 },
      });

      // Act & Assert: should not throw
      await expect(
        service.update('test-session-id', { status: SessionStatus.ACTIVE }),
      ).resolves.toBeDefined();
    });
  });

  describe('PAUSED -> CANCELLED transition', () => {
    it('should allow transitioning from PAUSED to CANCELLED (stop)', async () => {
      // Arrange: session is PAUSED
      const session = mockSession('PAUSED' as SessionStatus);
      jest.spyOn(service, 'findOne').mockResolvedValue(session as any);
      (prisma.session.update as jest.Mock).mockResolvedValue({
        ...session,
        status: SessionStatus.CANCELLED,
        experts: [],
        _count: { messages: 0 },
      });

      // Act & Assert: should not throw
      await expect(
        service.update('test-session-id', { status: SessionStatus.CANCELLED }),
      ).resolves.toBeDefined();
    });
  });

  describe('Invalid transitions involving PAUSED', () => {
    it('should reject PENDING -> PAUSED transition', async () => {
      // Arrange: session is PENDING
      const session = mockSession(SessionStatus.PENDING);
      jest.spyOn(service, 'findOne').mockResolvedValue(session as any);

      // Act & Assert: should throw BadRequestException
      await expect(
        service.update('test-session-id', { status: 'PAUSED' as SessionStatus }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject PAUSED -> COMPLETED transition', async () => {
      // A paused session cannot be marked as completed directly;
      // it must be resumed first, then completed.
      const session = mockSession('PAUSED' as SessionStatus);
      jest.spyOn(service, 'findOne').mockResolvedValue(session as any);

      // Act & Assert: should throw BadRequestException
      await expect(
        service.update('test-session-id', { status: SessionStatus.COMPLETED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject COMPLETED -> PAUSED transition', async () => {
      // Terminal state: no transitions allowed
      const session = mockSession(SessionStatus.COMPLETED);
      jest.spyOn(service, 'findOne').mockResolvedValue(session as any);

      await expect(
        service.update('test-session-id', { status: 'PAUSED' as SessionStatus }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject CANCELLED -> PAUSED transition', async () => {
      // Terminal state: no transitions allowed
      const session = mockSession(SessionStatus.CANCELLED);
      jest.spyOn(service, 'findOne').mockResolvedValue(session as any);

      await expect(
        service.update('test-session-id', { status: 'PAUSED' as SessionStatus }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getValidTransitions includes PAUSED', () => {
    it('should include PAUSED in valid transitions from ACTIVE', async () => {
      // When we try ACTIVE -> COMPLETED (already valid), the error message
      // for an invalid transition from ACTIVE should list PAUSED as an option.
      // We test this indirectly: if ACTIVE -> PAUSED is valid, then
      // attempting an invalid transition from ACTIVE should mention PAUSED.
      const session = mockSession(SessionStatus.ACTIVE);
      jest.spyOn(service, 'findOne').mockResolvedValue(session as any);

      // ACTIVE -> PENDING is invalid. The error message should list PAUSED
      // as one of the valid transitions.
      try {
        await service.update('test-session-id', { status: SessionStatus.PENDING });
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('PAUSED');
      }
    });
  });
});
