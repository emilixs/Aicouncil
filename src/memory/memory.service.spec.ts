import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { MemoryService } from './memory.service';
import { PrismaService } from '../common/prisma.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { MessageService } from '../message/message.service';

// Mock PrismaService
const mockPrismaService = {
  expertMemory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  expert: {
    findUnique: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
};

const mockDriverFactory = {
  createDriver: jest.fn(),
};

const mockMessageService = {
  findBySession: jest.fn(),
};

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: DriverFactory, useValue: mockDriverFactory },
        { provide: MessageService, useValue: mockMessageService },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
    jest.clearAllMocks();
  });

  describe('findAllByExpert', () => {
    it('should return memories for an expert', async () => {
      const mockMemories = [
        {
          id: 'mem1',
          expertId: 'exp1',
          sessionId: null,
          type: MemoryType.USER_NOTE,
          content: 'Test note',
          relevance: 1.0,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.expert.findUnique.mockResolvedValue({ id: 'exp1' });
      mockPrismaService.expertMemory.findMany.mockResolvedValue(mockMemories);
      mockPrismaService.expertMemory.count.mockResolvedValue(1);

      const result = await service.findAllByExpert('exp1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('mem1');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should throw NotFoundException for non-existent expert', async () => {
      mockPrismaService.expert.findUnique.mockResolvedValue(null);

      await expect(service.findAllByExpert('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a USER_NOTE memory', async () => {
      const mockExpert = { id: 'exp1', memoryMaxEntries: 50 };
      const mockMemory = {
        id: 'mem1',
        expertId: 'exp1',
        sessionId: null,
        type: MemoryType.USER_NOTE,
        content: 'My note',
        relevance: 1.0,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.expert.findUnique.mockResolvedValue(mockExpert);
      mockPrismaService.expertMemory.create.mockResolvedValue(mockMemory);
      mockPrismaService.expertMemory.count.mockResolvedValue(1);

      const result = await service.create('exp1', { content: 'My note' });
      expect(result.content).toBe('My note');
      expect(result.type).toBe(MemoryType.USER_NOTE);
    });
  });

  describe('update', () => {
    it('should update memory content', async () => {
      const mockMemory = {
        id: 'mem1',
        expertId: 'exp1',
        sessionId: null,
        type: MemoryType.USER_NOTE,
        content: 'Updated note',
        relevance: 0.8,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.expertMemory.findUnique.mockResolvedValue({
        ...mockMemory,
        content: 'Old note',
      });
      mockPrismaService.expertMemory.update.mockResolvedValue(mockMemory);

      const result = await service.update('exp1', 'mem1', {
        content: 'Updated note',
      });
      expect(result.content).toBe('Updated note');
    });

    it('should throw NotFoundException for wrong expertId', async () => {
      mockPrismaService.expertMemory.findUnique.mockResolvedValue({
        id: 'mem1',
        expertId: 'different-expert',
      });

      await expect(
        service.update('exp1', 'mem1', { content: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a memory', async () => {
      mockPrismaService.expertMemory.findUnique.mockResolvedValue({
        id: 'mem1',
        expertId: 'exp1',
      });
      mockPrismaService.expertMemory.delete.mockResolvedValue(undefined);

      await expect(service.remove('exp1', 'mem1')).resolves.not.toThrow();
    });
  });

  describe('clearAllByExpert', () => {
    it('should delete all memories for an expert', async () => {
      mockPrismaService.expert.findUnique.mockResolvedValue({ id: 'exp1' });
      mockPrismaService.expertMemory.deleteMany.mockResolvedValue({ count: 5 });

      await expect(service.clearAllByExpert('exp1')).resolves.not.toThrow();
      expect(mockPrismaService.expertMemory.deleteMany).toHaveBeenCalledWith({
        where: { expertId: 'exp1' },
      });
    });
  });

  describe('getRelevantMemories', () => {
    it('should return empty when no memories exist', async () => {
      mockPrismaService.expertMemory.findMany.mockResolvedValue([]);

      const result = await service.getRelevantMemories(
        'exp1',
        'Design an API',
        5,
      );
      expect(result.memories).toEqual([]);
      expect(result.ids).toEqual([]);
    });

    it('should return scored and sorted memories', async () => {
      const now = new Date();
      const mockMemories = [
        {
          id: 'mem1',
          expertId: 'exp1',
          sessionId: 'sess1',
          type: MemoryType.SESSION_SUMMARY,
          content: 'Discussed API design patterns',
          relevance: 1.0,
          metadata: { topics: ['api', 'design'] },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'mem2',
          expertId: 'exp1',
          sessionId: 'sess2',
          type: MemoryType.KEY_INSIGHT,
          content: 'Database migration strategy',
          relevance: 0.8,
          metadata: { topics: ['database', 'migration'] },
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      ];

      mockPrismaService.expertMemory.findMany.mockResolvedValue(mockMemories);

      const result = await service.getRelevantMemories(
        'exp1',
        'Design an API',
        5,
      );
      expect(result.memories.length).toBeGreaterThan(0);
      // The API-related memory should score higher for an API query
      expect(result.ids[0]).toBe('mem1');
    });
  });

  describe('generateSessionMemory', () => {
    it('should skip generation when expert has memory disabled', async () => {
      mockPrismaService.expert.findUnique.mockResolvedValue({
        id: 'exp1',
        memoryEnabled: false,
      });

      await service.generateSessionMemory('exp1', 'sess1');
      expect(mockDriverFactory.createDriver).not.toHaveBeenCalled();
    });

    it('should skip generation when expert has no messages in session', async () => {
      mockPrismaService.expert.findUnique.mockResolvedValue({
        id: 'exp1',
        memoryEnabled: true,
        driverType: 'OPENAI',
        config: { model: 'gpt-4' },
      });
      mockMessageService.findBySession.mockResolvedValue([
        {
          id: 'msg1',
          expertId: 'other-expert',
          content: 'Hello',
          expertName: 'Other',
        },
      ]);

      await service.generateSessionMemory('exp1', 'sess1');
      expect(mockDriverFactory.createDriver).not.toHaveBeenCalled();
    });

    it('should generate summary and insights from LLM response', async () => {
      const mockDriver = {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            summary: 'Discussed authentication patterns',
            insights: [
              {
                text: 'JWT is preferred over sessions',
                topics: ['jwt', 'auth'],
              },
            ],
            topics: ['authentication', 'jwt'],
          }),
        }),
      };

      mockPrismaService.expert.findUnique.mockResolvedValue({
        id: 'exp1',
        memoryEnabled: true,
        memoryMaxEntries: 50,
        driverType: 'OPENAI',
        config: { model: 'gpt-4' },
      });
      mockMessageService.findBySession.mockResolvedValue([
        {
          id: 'msg1',
          expertId: 'exp1',
          content: 'I think JWT is better',
          expertName: 'Expert1',
        },
        {
          id: 'msg2',
          expertId: 'exp2',
          content: 'I agree',
          expertName: 'Expert2',
        },
      ]);
      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'sess1',
        problemStatement: 'Best auth strategy',
      });
      mockDriverFactory.createDriver.mockReturnValue(mockDriver);
      mockPrismaService.expertMemory.create.mockResolvedValue({});
      mockPrismaService.expertMemory.count.mockResolvedValue(2);

      await service.generateSessionMemory('exp1', 'sess1');

      // Should create SESSION_SUMMARY + KEY_INSIGHT entries
      expect(mockPrismaService.expertMemory.create).toHaveBeenCalledTimes(2);
      const calls = mockPrismaService.expertMemory.create.mock.calls;
      expect(calls[0][0].data.type).toBe(MemoryType.SESSION_SUMMARY);
      expect(calls[1][0].data.type).toBe(MemoryType.KEY_INSIGHT);
    });
  });

  describe('formatMemoriesForInjection', () => {
    it('should return empty string for no memories', () => {
      const result = service.formatMemoriesForInjection([]);
      expect(result).toBe('');
    });

    it('should format memories with type-specific headers', () => {
      const memories = [
        {
          id: 'mem1',
          expertId: 'exp1',
          sessionId: 'sess1',
          type: 'SESSION_SUMMARY' as any,
          content: 'Discussed API design',
          relevance: 1.0,
          effectiveRelevance: 0.9,
          metadata: { sessionTitle: 'API Design Review' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'mem2',
          expertId: 'exp1',
          sessionId: null,
          type: 'USER_NOTE' as any,
          content: 'Remember to consider rate limiting',
          relevance: 1.0,
          effectiveRelevance: 1.0,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = service.formatMemoriesForInjection(memories);
      expect(result).toContain('Relevant Memory from Past Sessions');
      expect(result).toContain('API Design Review');
      expect(result).toContain('[Note]');
      expect(result).toContain('Remember to consider rate limiting');
    });
  });

  describe('pruneMemories (via create)', () => {
    it('should not delete USER_NOTE entries when pruning', async () => {
      const mockExpert = { id: 'exp1', memoryMaxEntries: 2 };
      const newMemory = {
        id: 'mem-new',
        expertId: 'exp1',
        sessionId: null,
        type: MemoryType.USER_NOTE,
        content: 'New note',
        relevance: 1.0,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.expert.findUnique.mockResolvedValue(mockExpert);
      mockPrismaService.expertMemory.create.mockResolvedValue(newMemory);
      // Total count is 3, exceeds maxEntries of 2
      mockPrismaService.expertMemory.count.mockResolvedValue(3);
      // Return only non-USER_NOTE candidates (USER_NOTEs excluded by the where clause)
      mockPrismaService.expertMemory.findMany.mockResolvedValue([
        {
          id: 'mem-summary',
          relevance: 0.5,
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        },
      ]);
      mockPrismaService.expertMemory.delete.mockResolvedValue(undefined);

      await service.create('exp1', { content: 'New note' });

      // pruneMemories should have queried with type NOT USER_NOTE
      expect(mockPrismaService.expertMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expertId: 'exp1',
            type: { not: MemoryType.USER_NOTE },
          }),
        }),
      );
      // Should delete the low-relevance summary, not the USER_NOTE
      expect(mockPrismaService.expertMemory.delete).toHaveBeenCalledWith({
        where: { id: 'mem-summary' },
      });
    });

    it('should order prune candidates by effective relevance ascending', async () => {
      const mockExpert = { id: 'exp1', memoryMaxEntries: 1 };
      const newMemory = {
        id: 'mem-new',
        expertId: 'exp1',
        sessionId: null,
        type: MemoryType.USER_NOTE,
        content: 'New note',
        relevance: 1.0,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.expert.findUnique.mockResolvedValue(mockExpert);
      mockPrismaService.expertMemory.create.mockResolvedValue(newMemory);
      mockPrismaService.expertMemory.count.mockResolvedValue(3);
      // Return two candidates: one old with low relevance, one recent with high relevance
      mockPrismaService.expertMemory.findMany.mockResolvedValue([
        {
          id: 'mem-old-low',
          relevance: 0.3,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'mem-recent-high',
          relevance: 1.0,
          createdAt: new Date(),
        },
      ]);
      mockPrismaService.expertMemory.delete.mockResolvedValue(undefined);

      await service.create('exp1', { content: 'New note' });

      // Should delete the lowest effective relevance entries first
      const deleteCalls = mockPrismaService.expertMemory.delete.mock.calls;
      expect(deleteCalls.length).toBe(2);
      // The old low-relevance memory should be deleted first
      expect(deleteCalls[0][0].where.id).toBe('mem-old-low');
    });
  });
});
