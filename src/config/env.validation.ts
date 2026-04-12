import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsNumberString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  WS_CORS_ORIGINS?: string;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_API_KEY?: string;

  @IsOptional()
  @IsString()
  XAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  CONSENSUS_EVALUATOR_MODEL?: string;

  @IsOptional()
  @IsString()
  CONSENSUS_EVALUATOR_DRIVER?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
