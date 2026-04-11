import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  BadRequestException,
} from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { MemoryService } from './memory.service';
import { CreateMemoryDto, UpdateMemoryDto, MemoryResponseDto } from './dto';

@Controller('experts/:expertId/memories')
@UseInterceptors(ClassSerializerInterceptor)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  findAll(
    @Param('expertId') expertId: string,
    @Query('type') type?: MemoryType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<MemoryResponseDto[]> {
    return this.memoryService.findAllByExpert(expertId, {
      type,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':memoryId')
  findOne(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
  ): Promise<MemoryResponseDto> {
    return this.memoryService.findOne(expertId, memoryId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('expertId') expertId: string,
    @Body() dto: CreateMemoryDto,
  ): Promise<MemoryResponseDto> {
    return this.memoryService.create(expertId, dto);
  }

  @Patch(':memoryId')
  update(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
    @Body() dto: UpdateMemoryDto,
  ): Promise<MemoryResponseDto> {
    return this.memoryService.update(expertId, memoryId, dto);
  }

  @Delete(':memoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('expertId') expertId: string,
    @Param('memoryId') memoryId: string,
  ): Promise<void> {
    return this.memoryService.remove(expertId, memoryId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearAll(
    @Param('expertId') expertId: string,
    @Query('confirm') confirm?: string,
  ): Promise<void> {
    if (confirm !== 'true') {
      throw new BadRequestException(
        'Pass ?confirm=true to clear all memories for this expert',
      );
    }
    return this.memoryService.clearAllByExpert(expertId);
  }
}
