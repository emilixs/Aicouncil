import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { SessionService } from './session.service';
import { PrismaService } from '../common/prisma.service';

/**
 * RED phase tests for SessionService state transitions.
 *
 * These tests validate that the session state machine supports the new
 * DiscussionStatus-related transitions needed for async discussion orchestration.
 *
 * The plan introduces a `DiscussionStatus` enum (IDLE, RUNNING, PAUSING, PAUSED,
 * STOPPING, STOPPED, COMPLETED, FAILED) as a separate field on Session. However,
 * the issue-level test scenarios describe transitions using familiar terms:
 *   ACTIVE→PAUSED, PAUSED→ACTIVE, PAUSED→CANCELLED, PENDING→PAUSED (invalid),
 *   PAUSED→COMPLETED (invalid).
 *
 * We test both the existing SessionStatus state machine and the new
 * discussionStatus transitions that the Plan Executor will implement.
 */

// Mock PrismaService
const mockPrismaService = {
  session: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  expert: {
    findMany: jest.fn(),
  },
  sessionExpert: {
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('SessionService - State Transitions for Async Discussion', () => {
  let service: SessionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe('DiscussionStatus transitions (new feature)', () => {
    /**
     * These tests define the expected behavior of the new discussionStatus field.
     * They will FAIL because:
     * 1. The DiscussionStatus enum doesn't exist in Prisma schema yet
     * 2. The Session model doesn't have a discussionStatus field yet
     * 3. SessionService doesn't validate discussionStatus transitions yet
     */

    it('should allow transition from RUNNING to PAUSED (via PAUSING)', async () => {
      // Arrange: session with discussionStatus RUNNING
      const sessionId = 'test-session-1';
      const mockSession = {
        id: sessionId,
        problemStatement: 'Test problem',
        status: SessionStatus.ACTIVE,
        discussionStatus: 'RUNNING',
        maxMessages: 20,
        consensusReached: false,
        currentRound: 1,
        currentTurnIndex: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        experts: [],
        _count: { messages: 5 },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue({
        ...mockSession,
        discussionStatus: 'PAUSING',
      });

      // Act: transition to PAUSING (the intermediate state before PAUSED)
      const result = await service.update(sessionId, {
        discussionStatus: 'PAUSING',
      } as any);

      // Assert: result must have discussionStatus field set to PAUSING
      expect(result).toBeDefined();
      expect((result as any).discussionStatus).toBe('PAUSING');
    });

    it('should allow transition from PAUSED to RUNNING (resume)', async () => {
      const sessionId = 'test-session-2';
      const mockSession = {
        id: sessionId,
        problemStatement: 'Test problem',
        status: SessionStatus.ACTIVE,
        discussionStatus: 'PAUSED',
        maxMessages: 20,
        consensusReached: false,
        currentRound: 1,
        currentTurnIndex: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        experts: [],
        _count: { messages: 5 },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue({
        ...mockSession,
        discussionStatus: 'RUNNING',
      });

      // Act: resume — transition PAUSED → RUNNING
      const result = await service.update(sessionId, {
        discussionStatus: 'RUNNING',
      } as any);

      // Assert: result must have discussionStatus field set to RUNNING
      expect(result).toBeDefined();
      expect((result as any).discussionStatus).toBe('RUNNING');
    });

    it('should allow transition from PAUSED to STOPPED (via STOPPING)', async () => {
      const sessionId = 'test-session-3';
      const mockSession = {
        id: sessionId,
        problemStatement: 'Test problem',
        status: SessionStatus.ACTIVE,
        discussionStatus: 'PAUSED',
        maxMessages: 20,
        consensusReached: false,
        currentRound: 1,
        currentTurnIndex: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        experts: [],
        _count: { messages: 5 },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue({
        ...mockSession,
        discussionStatus: 'STOPPING',
      });

      // Act: stop from paused — PAUSED → STOPPING
      const result = await service.update(sessionId, {
        discussionStatus: 'STOPPING',
      } as any);

      // Assert: result must have discussionStatus field set to STOPPING
      expect(result).toBeDefined();
      expect((result as any).discussionStatus).toBe('STOPPING');
    });

    it('should reject transition from IDLE to PAUSED (invalid)', async () => {
      const sessionId = 'test-session-4';
      const mockSession = {
        id: sessionId,
        problemStatement: 'Test problem',
        status: SessionStatus.PENDING,
        discussionStatus: 'IDLE',
        maxMessages: 20,
        consensusReached: false,
        currentRound: 0,
        currentTurnIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        experts: [],
        _count: { messages: 0 },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);

      // Act & Assert: IDLE → PAUSED should be rejected
      await expect(
        service.update(sessionId, { discussionStatus: 'PAUSED' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition from PAUSED to COMPLETED (invalid)', async () => {
      const sessionId = 'test-session-5';
      const mockSession = {
        id: sessionId,
        problemStatement: 'Test problem',
        status: SessionStatus.ACTIVE,
        discussionStatus: 'PAUSED',
        maxMessages: 20,
        consensusReached: false,
        currentRound: 1,
        currentTurnIndex: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        experts: [],
        _count: { messages: 5 },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);

      // Act & Assert: PAUSED → COMPLETED should be rejected
      // (only the loop can transition to COMPLETED via normal flow)
      await expect(
        service.update(sessionId, { discussionStatus: 'COMPLETED' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
