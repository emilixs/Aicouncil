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
    });
  }
}

