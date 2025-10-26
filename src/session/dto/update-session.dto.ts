import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { SessionStatus } from '@prisma/client';

/**
 * Data Transfer Object for updating an existing session.
 * Only allows updating status and consensus flag.
 * Problem statement, experts, and maxMessages are immutable after creation.
 */
export class UpdateSessionDto {
  /**
   * Session status indicating the current state.
   * Valid values: PENDING, ACTIVE, COMPLETED, CANCELLED
   *
   * Note: The public API term "concluded" maps to SessionStatus.COMPLETED.
   * Use COMPLETED when a session has finished successfully with a resolution.
   * Use CANCELLED when a session is terminated without completion.
   *
   * Status transitions are validated by the service layer.
   */
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  /**
   * Indicates whether the expert council has reached consensus on the problem.
   * Set by the Council orchestrator when consensus is detected.
   */
  @IsOptional()
  @IsBoolean()
  consensusReached?: boolean;
}

