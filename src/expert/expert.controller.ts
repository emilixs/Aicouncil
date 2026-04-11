import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ExpertService } from './expert.service';
import { CreateExpertDto, UpdateExpertDto, CloneExpertDto, ExpertResponseDto } from './dto';

@Controller('experts')
@UseInterceptors(ClassSerializerInterceptor)
export class ExpertController {
  constructor(private readonly expertService: ExpertService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createExpertDto: CreateExpertDto): Promise<ExpertResponseDto> {
    return this.expertService.create(createExpertDto);
  }

  @Get()
  findAll(): Promise<ExpertResponseDto[]> {
    return this.expertService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ExpertResponseDto> {
    return this.expertService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateExpertDto: UpdateExpertDto,
  ): Promise<ExpertResponseDto> {
    return this.expertService.update(id, updateExpertDto);
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  clone(
    @Param('id') id: string,
    @Body() cloneExpertDto: CloneExpertDto,
  ): Promise<ExpertResponseDto> {
    return this.expertService.clone(id, cloneExpertDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.expertService.remove(id);
  }
}
