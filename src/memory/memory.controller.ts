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
import { CreateMemoryDto, UpdateMemoryDto } from './dto';

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
    return this.memoryService.findAllByExpert(expertId, {
      type,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':memoryId')
  async findOne(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
  ) {
    return this.memoryService.findOne(expertId, memoryId);
  }

  @Post()
  async create(
    @Param('expertId') expertId: string,
    @Body() dto: CreateMemoryDto,
  ) {
    return this.memoryService.create(expertId, dto);
  }

  @Patch(':memoryId')
  async update(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
    @Body() dto: UpdateMemoryDto,
  ) {
    return this.memoryService.update(expertId, memoryId, dto);
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
