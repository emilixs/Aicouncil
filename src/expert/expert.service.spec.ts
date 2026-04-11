import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DriverType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ExpertService } from './expert.service';
import { PrismaService } from '../common/prisma.service';
import { ExpertResponseDto } from './dto';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePrismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('mock prisma error', {
    code,
    clientVersion: '5.0.0',
  });
}

interface ExpertRecord {
  id: string;
  name: string;
  specialty: string;
  systemPrompt: string;
  driverType: DriverType;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

function makeExpertRecord(overrides: Partial<ExpertRecord> = {}): ExpertRecord {
  return {
    id: 'expert-id-1',
    name: 'Alice',
    specialty: 'Software Architecture',
    systemPrompt: 'You are a software architect expert.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ─── Mock PrismaService ──────────────────────────────────────────────────────

const mockPrismaService = {
  expert: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ExpertService', () => {
  let service: ExpertService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpertService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ExpertService>(ExpertService);
    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      name: 'Alice',
      specialty: 'Software Architecture',
      systemPrompt: 'You are a software architect expert.',
      driverType: DriverType.OPENAI,
      config: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000 } as any,
    };

    it('creates an expert and returns ExpertResponseDto', async () => {
      const record = makeExpertRecord();
      mockPrismaService.expert.create.mockResolvedValue(record);

      const result = await service.create(dto);

      expect(mockPrismaService.expert.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          specialty: dto.specialty,
          systemPrompt: dto.systemPrompt,
          driverType: dto.driverType,
          config: dto.config,
        },
      });
      expect(result).toBeInstanceOf(ExpertResponseDto);
      expect(result.id).toBe(record.id);
      expect(result.name).toBe(record.name);
      expect(result.specialty).toBe(record.specialty);
      expect(result.driverType).toBe(DriverType.OPENAI);
    });

    it('throws ConflictException on P2002 (unique constraint)', async () => {
      mockPrismaService.expert.create.mockRejectedValue(makePrismaError('P2002'));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException on other Prisma errors', async () => {
      mockPrismaService.expert.create.mockRejectedValue(makePrismaError('P2000'));

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException on non-Prisma errors', async () => {
      mockPrismaService.expert.create.mockRejectedValue(new Error('database connection lost'));

      await expect(service.create(dto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns an array of ExpertResponseDto ordered by createdAt desc', async () => {
      const records = [
        makeExpertRecord({ id: 'id-1', name: 'Alice', createdAt: new Date('2024-02-01') }),
        makeExpertRecord({ id: 'id-2', name: 'Bob', createdAt: new Date('2024-01-01') }),
      ];
      mockPrismaService.expert.findMany.mockResolvedValue(records);

      const result = await service.findAll();

      expect(mockPrismaService.expert.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(ExpertResponseDto);
      expect(result[0].id).toBe('id-1');
      expect(result[1].id).toBe('id-2');
    });

    it('returns empty array when no experts exist', async () => {
      mockPrismaService.expert.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns ExpertResponseDto when found', async () => {
      const record = makeExpertRecord();
      mockPrismaService.expert.findUnique.mockResolvedValue(record);

      const result = await service.findOne('expert-id-1');

      expect(mockPrismaService.expert.findUnique).toHaveBeenCalledWith({
        where: { id: 'expert-id-1' },
      });
      expect(result).toBeInstanceOf(ExpertResponseDto);
      expect(result.id).toBe('expert-id-1');
    });

    it('throws NotFoundException when expert does not exist', async () => {
      mockPrismaService.expert.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    const updateDto = { name: 'Alice Updated', specialty: 'Cloud Architecture' };

    it('updates an expert and returns ExpertResponseDto', async () => {
      const record = makeExpertRecord({ name: 'Alice Updated', specialty: 'Cloud Architecture' });
      mockPrismaService.expert.update.mockResolvedValue(record);

      const result = await service.update('expert-id-1', updateDto);

      expect(mockPrismaService.expert.update).toHaveBeenCalledWith({
        where: { id: 'expert-id-1' },
        data: { ...updateDto, config: undefined },
      });
      expect(result).toBeInstanceOf(ExpertResponseDto);
      expect(result.name).toBe('Alice Updated');
    });

    it('throws NotFoundException on P2025 (record not found)', async () => {
      mockPrismaService.expert.update.mockRejectedValue(makePrismaError('P2025'));

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException on other Prisma errors', async () => {
      mockPrismaService.expert.update.mockRejectedValue(makePrismaError('P2000'));

      await expect(service.update('expert-id-1', updateDto)).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException on non-Prisma errors', async () => {
      mockPrismaService.expert.update.mockRejectedValue(new Error('unexpected'));

      await expect(service.update('expert-id-1', updateDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes an expert and returns void', async () => {
      mockPrismaService.expert.delete.mockResolvedValue(makeExpertRecord());

      await expect(service.remove('expert-id-1')).resolves.toBeUndefined();
      expect(mockPrismaService.expert.delete).toHaveBeenCalledWith({
        where: { id: 'expert-id-1' },
      });
    });

    it('throws NotFoundException on P2025', async () => {
      mockPrismaService.expert.delete.mockRejectedValue(makePrismaError('P2025'));

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on P2003 (foreign key constraint / in use)', async () => {
      mockPrismaService.expert.delete.mockRejectedValue(makePrismaError('P2003'));

      await expect(service.remove('expert-id-1')).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException on other Prisma errors', async () => {
      mockPrismaService.expert.delete.mockRejectedValue(makePrismaError('P2000'));

      await expect(service.remove('expert-id-1')).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException on non-Prisma errors', async () => {
      mockPrismaService.expert.delete.mockRejectedValue(new Error('unexpected'));

      await expect(service.remove('expert-id-1')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
