import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { MemoryService } from './memory.service';
import { CreateMemoryDto, UpdateMemoryDto, MemoryResponseDto } from './dto';

const VALID_MEMORY_TYPES = new Set(Object.values(MemoryType));

@Controller('experts/:expertId/memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  async findAll(
    @Param('expertId') expertId: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (type && !VALID_MEMORY_TYPES.has(type as MemoryType)) {
      throw new BadRequestException(`Invalid memory type: ${type}. Valid types: ${[...VALID_MEMORY_TYPES].join(', ')}`);
    }

    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;

    const { data, total } = await this.memoryService.findAllByExpert(expertId, {
      type: type as MemoryType,
      page: parsedPage,
      limit: parsedLimit,
    });

    return {
      data: data.map(MemoryResponseDto.fromPrisma),
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    };
  }

  @Get(':memoryId')
  async findOne(@Param('expertId') expertId: string, @Param('memoryId') memoryId: string) {
    const memory = await this.memoryService.findOne(expertId, memoryId);
    return MemoryResponseDto.fromPrisma(memory);
  }

  @Post()
  async create(@Param('expertId') expertId: string, @Body() dto: CreateMemoryDto) {
    const memory = await this.memoryService.create(expertId, dto);
    return MemoryResponseDto.fromPrisma(memory);
  }

  @Patch(':memoryId')
  async update(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
    @Body() dto: UpdateMemoryDto,
  ) {
    const memory = await this.memoryService.update(expertId, memoryId, dto);
    return MemoryResponseDto.fromPrisma(memory);
  }

  @Delete(':memoryId')
  async remove(@Param('expertId') expertId: string, @Param('memoryId') memoryId: string) {
    return this.memoryService.remove(expertId, memoryId);
  }

  @Delete()
  async clearAll(@Param('expertId') expertId: string, @Query('confirm') confirm?: string) {
    if (confirm !== 'true') {
      throw new BadRequestException('Must pass confirm=true query parameter to clear all memories');
    }
    return this.memoryService.clearAllByExpert(expertId);
  }
}
