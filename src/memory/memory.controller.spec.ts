import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { MemoryType } from '@prisma/client';

const mockMemoryService = {
  findAllByExpert: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  clearAllByExpert: jest.fn(),
};

function makeMockMemory(overrides: Record<string, any> = {}) {
  return {
    id: 'mem1',
    expertId: 'exp1',
    sessionId: null,
    type: MemoryType.USER_NOTE,
    content: 'test',
    relevance: 1.0,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('MemoryController', () => {
  let controller: MemoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoryController],
      providers: [{ provide: MemoryService, useValue: mockMemoryService }],
    }).compile();

    controller = module.get<MemoryController>(MemoryController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call findAllByExpert with correct params', async () => {
      mockMemoryService.findAllByExpert.mockResolvedValue({
        data: [],
        total: 0,
      });
      const result = await controller.findAll('exp1', undefined, '1', '20');
      expect(mockMemoryService.findAllByExpert).toHaveBeenCalledWith('exp1', {
        type: undefined,
        page: 1,
        limit: 20,
      });
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should pass type filter when provided', async () => {
      mockMemoryService.findAllByExpert.mockResolvedValue({
        data: [],
        total: 0,
      });
      await controller.findAll('exp1', MemoryType.USER_NOTE, '1', '10');
      expect(mockMemoryService.findAllByExpert).toHaveBeenCalledWith('exp1', {
        type: MemoryType.USER_NOTE,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('findOne', () => {
    it('should call findOne with expertId and memoryId', async () => {
      const mockMemory = makeMockMemory();
      mockMemoryService.findOne.mockResolvedValue(mockMemory);
      const result = await controller.findOne('exp1', 'mem1');
      expect(mockMemoryService.findOne).toHaveBeenCalledWith('exp1', 'mem1');
      expect(result.id).toBe('mem1');
      expect(result.effectiveRelevance).toBeDefined();
    });
  });

  describe('create', () => {
    it('should call create with USER_NOTE type', async () => {
      const dto = { content: 'A note' };
      mockMemoryService.create.mockResolvedValue(makeMockMemory(dto));
      await controller.create('exp1', dto as any);
      expect(mockMemoryService.create).toHaveBeenCalledWith('exp1', dto);
    });
  });

  describe('update', () => {
    it('should call update with correct params', async () => {
      const dto = { content: 'Updated note' };
      mockMemoryService.update.mockResolvedValue(makeMockMemory(dto));
      await controller.update('exp1', 'mem1', dto as any);
      expect(mockMemoryService.update).toHaveBeenCalledWith('exp1', 'mem1', dto);
    });
  });

  describe('remove', () => {
    it('should call remove with correct params', async () => {
      mockMemoryService.remove.mockResolvedValue(undefined);
      await controller.remove('exp1', 'mem1');
      expect(mockMemoryService.remove).toHaveBeenCalledWith('exp1', 'mem1');
    });
  });

  describe('clearAll', () => {
    it('should call clearAllByExpert when confirm=true', async () => {
      await controller.clearAll('exp1', 'true');
      expect(mockMemoryService.clearAllByExpert).toHaveBeenCalledWith('exp1');
    });

    it('should throw BadRequestException when confirm is not true', async () => {
      await expect(controller.clearAll('exp1', 'false')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when confirm is missing', async () => {
      await expect(controller.clearAll('exp1', undefined)).rejects.toThrow(BadRequestException);
    });
  });
});
