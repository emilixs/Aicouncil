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

@Controller('experts/:expertId/memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  async findAll(
    @Param('expertId') expertId: string,
    @Query('type') type?: MemoryType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.memoryService.findAllByExpert(expertId, {
      type,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return {
      data: result.data.map(MemoryResponseDto.fromPrisma),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':memoryId')
  async findOne(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
  ) {
    const memory = await this.memoryService.findOne(expertId, memoryId);
    return MemoryResponseDto.fromPrisma(memory);
  }

  @Post()
  async create(
    @Param('expertId') expertId: string,
    @Body() dto: CreateMemoryDto,
  ) {
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
  async remove(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
  ) {
    return this.memoryService.remove(expertId, memoryId);
  }

  @Delete()
  async clearAll(
    @Param('expertId') expertId: string,
    @Query('confirm') confirm?: string,
  ) {
    if (confirm !== 'true') {
      throw new BadRequestException(
        'Must pass confirm=true query parameter to clear all memories',
      );
    }
    return this.memoryService.clearAllByExpert(expertId);
  }
}
