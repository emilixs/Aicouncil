import { Expose } from 'class-transformer';
import { MemoryType } from '@prisma/client';
import { calculateEffectiveRelevance } from '../utils/relevance';

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
  effectiveRelevance: number;

  @Expose()
  metadata: any;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<MemoryResponseDto>) {
    Object.assign(this, partial);
  }

  static fromPrisma(memory: {
    id: string;
    expertId: string;
    sessionId: string | null;
    type: MemoryType;
    content: string;
    relevance: number;
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
  }): MemoryResponseDto {
    return new MemoryResponseDto({
      ...memory,
      effectiveRelevance: calculateEffectiveRelevance(
        memory.relevance,
        memory.createdAt,
      ),
    });
  }
}
