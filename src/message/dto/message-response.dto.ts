import { Expose } from 'class-transformer';
import { MessageRole, Message, Expert } from '@prisma/client';

export class MessageResponseDto {
  @Expose()
  id: string;

  @Expose()
  sessionId: string;

  @Expose()
  expertId: string | null;

  @Expose()
  content: string;

  @Expose()
  role: MessageRole;

  @Expose()
  isIntervention: boolean;

  @Expose()
  timestamp: Date;

  @Expose()
  expertName?: string | null;

  @Expose()
  expertSpecialty?: string | null;

  @Expose()
  roundNumber: number | null;

  @Expose()
  promptTokens: number | null;

  @Expose()
  completionTokens: number | null;

  @Expose()
  totalTokens: number | null;

  @Expose()
  model: string | null;

  @Expose()
  responseTimeMs: number | null;

  @Expose()
  finishReason: string | null;

  constructor(partial: Partial<MessageResponseDto>) {
    Object.assign(this, partial);
  }

  static fromPrisma(message: Message & { expert?: Expert | null }): MessageResponseDto {
    return new MessageResponseDto({
      id: message.id,
      sessionId: message.sessionId,
      expertId: message.expertId,
      content: message.content,
      role: message.role,
      isIntervention: message.isIntervention,
      timestamp: message.timestamp,
      expertName: message.expert?.name ?? null,
      expertSpecialty: message.expert?.specialty ?? null,
      roundNumber: (message as any).roundNumber ?? null,
      promptTokens: (message as any).promptTokens ?? null,
      completionTokens: (message as any).completionTokens ?? null,
      totalTokens: (message as any).totalTokens ?? null,
      model: (message as any).model ?? null,
      responseTimeMs: (message as any).responseTimeMs ?? null,
      finishReason: (message as any).finishReason ?? null,
    });
  }
}
