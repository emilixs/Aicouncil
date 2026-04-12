import { Expose } from 'class-transformer';
import { MemoryType, ExpertMemory } from '@prisma/client';
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

  static fromPrisma(memory: ExpertMemory): MemoryResponseDto {
    return new MemoryResponseDto({
      id: memory.id,
      expertId: memory.expertId,
      sessionId: memory.sessionId,
      type: memory.type,
      content: memory.content,
      relevance: memory.relevance,
      effectiveRelevance:
        memory.type === MemoryType.USER_NOTE
          ? memory.relevance
          : calculateEffectiveRelevance(memory.relevance, memory.createdAt),
      metadata: memory.metadata,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    });
  }
}
