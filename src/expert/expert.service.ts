import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateExpertDto, UpdateExpertDto, ExpertResponseDto } from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class ExpertService {
  private readonly logger = new Logger(ExpertService.name);
  
  constructor(private readonly prisma: PrismaService) {}

  async create(createExpertDto: CreateExpertDto): Promise<ExpertResponseDto> {
    try {
      const expert = await this.prisma.expert.create({
        data: {
          name: createExpertDto.name,
          specialty: createExpertDto.specialty,
          systemPrompt: createExpertDto.systemPrompt,
          driverType: createExpertDto.driverType,
          config: createExpertDto.config as any,
        },
      });

      return ExpertResponseDto.fromPrisma(expert);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        // Handle unique constraint violations if added later
        if (error.code === 'P2002') {
          throw new ConflictException('An expert with this name already exists');
        }
        this.logger.error(`Prisma error creating expert: ${error.message}`, error.stack);
        throw new BadRequestException('Failed to create expert due to validation error');
      }
      this.logger.error(`Unexpected error creating expert: ${error.message}`, error.stack);
      throw new InternalServerErrorException('An unexpected error occurred while creating the expert');
    }
  }

  async findAll(): Promise<ExpertResponseDto[]> {
    const experts = await this.prisma.expert.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return experts.map(expert => ExpertResponseDto.fromPrisma(expert));
  }

  async findOne(id: string): Promise<ExpertResponseDto> {
    const expert = await this.prisma.expert.findUnique({
      where: { id },
    });

    if (!expert) {
      throw new NotFoundException(`Expert with ID ${id} not found`);
    }

    return ExpertResponseDto.fromPrisma(expert);
  }

  async update(id: string, updateExpertDto: UpdateExpertDto): Promise<ExpertResponseDto> {
    try {
      const expert = await this.prisma.expert.update({
        where: { id },
        data: {
          ...updateExpertDto,
          config: updateExpertDto.config as any,
        },
      });

      return ExpertResponseDto.fromPrisma(expert);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Expert with ID ${id} not found`);
        }
        this.logger.error(`Prisma error updating expert: ${error.message}`, error.stack);
        throw new BadRequestException('Failed to update expert due to validation error');
      }
      this.logger.error(`Unexpected error updating expert: ${error.message}`, error.stack);
      throw new InternalServerErrorException('An unexpected error occurred while updating the expert');
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.expert.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Expert with ID ${id} not found`);
        }
        if (error.code === 'P2003') {
          throw new ConflictException(
            'Cannot delete expert as it is currently in use by existing sessions or messages',
          );
        }
        this.logger.error(`Prisma error deleting expert: ${error.message}`, error.stack);
        throw new BadRequestException('Failed to delete expert');
      }
      this.logger.error(`Unexpected error deleting expert: ${error.message}`, error.stack);
      throw new InternalServerErrorException('An unexpected error occurred while deleting the expert');
    }
  }
}

