import { Controller, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CouncilService } from './council.service';
import { SessionResponseDto } from '../session/dto/session-response.dto';

/**
 * Controller for managing council discussions.
 *
 * This controller exposes endpoints for orchestrating multi-agent discussions
 * between configured experts. The primary endpoint starts a discussion for a
 * session, running the full discussion loop until consensus is reached or
 * message limits are hit.
 *
 * Future: WebSocket gateway will provide real-time streaming of messages during
 * discussion. This endpoint will remain for non-streaming use cases and testing.
 */
@Controller('sessions')
export class CouncilController {
  constructor(private readonly councilService: CouncilService) {}

  /**
   * Start a multi-agent discussion for the specified session.
   *
   * This is an async fire-and-forget endpoint. It validates the session and expert
   * configurations, transitions the session to ACTIVE, launches the discussion loop
   * in the background, and returns immediately with the session in ACTIVE status.
   *
   * The discussion loop runs asynchronously until:
   * - An expert explicitly states agreement/consensus (consensusReached: true)
   * - The session's maxMessages limit is reached (consensusReached: false)
   * - The discussion is stopped or paused via control signals
   *
   * Prerequisites:
   * - Session must exist and be in PENDING status
   * - All experts in the session must have valid configurations
   * - Required API keys must be configured for the driver types used by experts
   *
   * @param id - The session ID (UUID)
   * @returns The session in ACTIVE status (discussion continues in background)
   *
   * @throws {NotFoundException} If session does not exist
   * @throws {BadRequestException} If session is not in PENDING status, has no experts,
   *                                or required API keys are missing
   * @throws {InternalServerErrorException} If an unexpected error occurs during setup
   *
   * @example
   * POST /sessions/abc123-def456-ghi789/start
   *
   * Response:
   * {
   *   "id": "abc123-def456-ghi789",
   *   "problemStatement": "How should we architect a scalable microservices system?",
   *   "status": "ACTIVE",
   *   "consensusReached": false,
   *   "maxMessages": 50,
   *   "createdAt": "2025-10-26T10:00:00Z",
   *   "updatedAt": "2025-10-26T10:05:30Z",
   *   "experts": [...]
   * }
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.ACCEPTED)
  async startDiscussion(@Param('id') id: string): Promise<SessionResponseDto> {
    return this.councilService.startDiscussion(id);
  }
}
