import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ExpertService } from './expert.service';
import { PrismaService } from '../common/prisma.service';
import { ExpertResponseDto } from './dto';

describe('ExpertService', () => {
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

  const makePrismaError = (code: string) =>
    new PrismaClientKnownRequestError('msg', { code, clientVersion: '5.0.0' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpertService,
        {
          provide: PrismaService,
          useValue: {
            expert: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ExpertService>(ExpertService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    const createDto = {
      name: mockExpert.name,
      specialty: mockExpert.specialty,
      systemPrompt: mockExpert.systemPrompt,
      driverType: mockExpert.driverType,
      config: mockExpert.config,
    };

    it('should create and return an ExpertResponseDto', async () => {
      (prisma.expert.create as jest.Mock).mockResolvedValue(mockExpert);

      const result = await service.create(createDto);

      expect(result).toBeInstanceOf(ExpertResponseDto);
      expect(result.id).toBe(mockExpert.id);
      expect(prisma.expert.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: createDto.name }) }),
      );
    });

    it('should throw ConflictException on P2002 (unique constraint)', async () => {
      (prisma.expert.create as jest.Mock).mockRejectedValue(makePrismaError('P2002'));

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException on other Prisma errors', async () => {
      (prisma.expert.create as jest.Mock).mockRejectedValue(makePrismaError('P2003'));

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unknown errors', async () => {
      (prisma.expert.create as jest.Mock).mockRejectedValue(new Error('unexpected'));

      await expect(service.create(createDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAll', () => {
    it('should return an array of ExpertResponseDto ordered by createdAt desc', async () => {
      const mockExperts = [mockExpert, { ...mockExpert, id: 'second-id', name: 'Second Expert' }];
      (prisma.expert.findMany as jest.Mock).mockResolvedValue(mockExperts);

      const results = await service.findAll();

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r).toBeInstanceOf(ExpertResponseDto));
      expect(prisma.expert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should return an empty array when no experts exist', async () => {
      (prisma.expert.findMany as jest.Mock).mockResolvedValue([]);

      const results = await service.findAll();

      expect(results).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return an ExpertResponseDto for a valid id', async () => {
      (prisma.expert.findUnique as jest.Mock).mockResolvedValue(mockExpert);

      const result = await service.findOne(mockExpert.id);

      expect(result).toBeInstanceOf(ExpertResponseDto);
      expect(result.id).toBe(mockExpert.id);
      expect(prisma.expert.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockExpert.id } }),
      );
    });

    it('should throw NotFoundException when expert does not exist', async () => {
      (prisma.expert.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Name' };

    it('should update and return an ExpertResponseDto', async () => {
      const updatedExpert = { ...mockExpert, ...updateDto };
      (prisma.expert.update as jest.Mock).mockResolvedValue(updatedExpert);

      const result = await service.update(mockExpert.id, updateDto);

      expect(result).toBeInstanceOf(ExpertResponseDto);
      expect(result.name).toBe(updateDto.name);
      expect(prisma.expert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockExpert.id },
          data: expect.objectContaining(updateDto),
        }),
      );
    });

    it('should throw NotFoundException on P2025 (record not found)', async () => {
      (prisma.expert.update as jest.Mock).mockRejectedValue(makePrismaError('P2025'));

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on other Prisma errors', async () => {
      (prisma.expert.update as jest.Mock).mockRejectedValue(makePrismaError('P2002'));

      await expect(service.update(mockExpert.id, updateDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unknown errors', async () => {
      (prisma.expert.update as jest.Mock).mockRejectedValue(new Error('unexpected'));

      await expect(service.update(mockExpert.id, updateDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('remove', () => {
    it('should delete the expert and return void (or the deleted record)', async () => {
      (prisma.expert.delete as jest.Mock).mockResolvedValue(mockExpert);

      await expect(service.remove(mockExpert.id)).resolves.not.toThrow();
      expect(prisma.expert.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockExpert.id } }),
      );
    });

    it('should throw NotFoundException on P2025 (record not found)', async () => {
      (prisma.expert.delete as jest.Mock).mockRejectedValue(makePrismaError('P2025'));

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on P2003 (foreign key constraint)', async () => {
      (prisma.expert.delete as jest.Mock).mockRejectedValue(makePrismaError('P2003'));

      await expect(service.remove(mockExpert.id)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException on other Prisma errors', async () => {
      (prisma.expert.delete as jest.Mock).mockRejectedValue(makePrismaError('P2000'));

      await expect(service.remove(mockExpert.id)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unknown errors', async () => {
      (prisma.expert.delete as jest.Mock).mockRejectedValue(new Error('unexpected'));

      await expect(service.remove(mockExpert.id)).rejects.toThrow(InternalServerErrorException);
    });
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
