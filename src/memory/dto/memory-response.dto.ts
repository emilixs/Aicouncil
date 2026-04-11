import { Expose } from 'class-transformer';
import { MemoryType } from '@prisma/client';

export class MemoryResponseDto {
  @Expose()
  id: string;

  @Expose()
  expertId: string;

  @Expose()
  sessionId: string | null;

  @Expose()
  type: MemoryType;

  @Expose()
  content: string;

  @Expose()
  relevance: number;

  @Expose()
  metadata: any;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<MemoryResponseDto>) {
    Object.assign(this, partial);
  }
}
