import { Expose } from 'class-transformer';
import { DriverType, Expert } from '@prisma/client';

export class ExpertResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  specialty: string;

  @Expose()
  systemPrompt: string;

  @Expose()
  driverType: DriverType;

  @Expose()
  config: object;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<ExpertResponseDto>) {
    Object.assign(this, partial);
  }

  static fromPrisma(expert: Expert): ExpertResponseDto {
    return new ExpertResponseDto({
      id: expert.id,
      name: expert.name,
      specialty: expert.specialty,
      systemPrompt: expert.systemPrompt,
      driverType: expert.driverType,
      config: expert.config,
      createdAt: expert.createdAt,
      updatedAt: expert.updatedAt,
    });
  }
}

