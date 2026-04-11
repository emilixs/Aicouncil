import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExpertService } from './expert.service';
import { PrismaService } from '../common/prisma.service';
import { ExpertResponseDto } from './dto';

describe('ExpertService - clone', () => {
  let service: ExpertService;
  let prisma: PrismaService;

  const mockExpert = {
    id: 'existing-expert-id',
    name: 'Security Expert',
    specialty: 'Cybersecurity',
    systemPrompt: 'You are a cybersecurity expert who analyzes threats.',
    driverType: 'ANTHROPIC' as const,
    config: { model: 'claude-sonnet-4-5-20250514', temperature: 0.7 },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpertService,
        {
          provide: PrismaService,
          useValue: {
            expert: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ExpertService>(ExpertService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('clone', () => {
    it('should clone an expert with all fields copied', async () => {
      const clonedId = 'new-cloned-id';
      (prisma.expert.findUnique as jest.Mock).mockResolvedValue(mockExpert);
      (prisma.expert.create as jest.Mock).mockResolvedValue({
        ...mockExpert,
        id: clonedId,
        name: 'Security Expert (Copy)',
        createdAt: new Date('2026-04-11'),
        updatedAt: new Date('2026-04-11'),
      });

      const result = await service.clone(mockExpert.id);

      expect(result).toBeInstanceOf(ExpertResponseDto);
      expect(result.id).toBe(clonedId);
      expect(result.id).not.toBe(mockExpert.id);
      expect(result.specialty).toBe(mockExpert.specialty);
      expect(result.systemPrompt).toBe(mockExpert.systemPrompt);
      expect(result.driverType).toBe(mockExpert.driverType);
      expect(result.config).toEqual(mockExpert.config);
    });

    it('should allow optional name override when cloning', async () => {
      const overrideName = 'My Custom Clone';
      (prisma.expert.findUnique as jest.Mock).mockResolvedValue(mockExpert);
      (prisma.expert.create as jest.Mock).mockResolvedValue({
        ...mockExpert,
        id: 'new-cloned-id',
        name: overrideName,
        createdAt: new Date('2026-04-11'),
        updatedAt: new Date('2026-04-11'),
      });

      const result = await service.clone(mockExpert.id, { name: overrideName });

      expect(result.name).toBe(overrideName);
      expect(prisma.expert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: overrideName }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent expert', async () => {
      (prisma.expert.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.clone('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should generate a new ID for the cloned expert', async () => {
      (prisma.expert.findUnique as jest.Mock).mockResolvedValue(mockExpert);
      (prisma.expert.create as jest.Mock).mockResolvedValue({
        ...mockExpert,
        id: 'brand-new-id',
        createdAt: new Date('2026-04-11'),
        updatedAt: new Date('2026-04-11'),
      });

      const result = await service.clone(mockExpert.id);

      expect(result.id).not.toBe(mockExpert.id);
      // Verify create was called without an explicit ID (Prisma generates via cuid)
      expect(prisma.expert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ id: mockExpert.id }),
        }),
      );
    });
  });
});
