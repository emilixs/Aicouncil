import {
  Controller,
  Post,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
   * This endpoint initiates a council discussion where experts take turns
   * responding to the problem statement and each other's messages. The discussion
   * continues until:
   * - An expert explicitly states agreement/consensus (consensusReached: true)
   * - The session's maxMessages limit is reached (consensusReached: false)
   * 
   * Prerequisites:
   * - Session must exist and be in PENDING status
   * - All experts in the session must have valid configurations
   * - Required API keys must be configured for the driver types used by experts
   * 
   * The discussion is a long-running synchronous operation that may take several
   * seconds to minutes depending on:
   * - Number of experts in the session
   * - Complexity of the problem statement
   * - Message limit configuration
   * - LLM response times
   * 
   * During the discussion:
   * - Session status transitions from PENDING → ACTIVE
   * - Experts take turns in round-robin order
   * - Each expert receives context including recent messages and other experts' specialties
   * - Messages are persisted in real-time
   * 
   * Upon completion:
   * - Session status transitions to COMPLETED
   * - consensusReached flag indicates whether experts reached agreement
   * - All messages are available via GET /sessions/:id/messages
   * 
   * @param id - The session ID (UUID)
   * @returns The completed session with final status and consensusReached flag
   * 
   * @throws {NotFoundException} If session does not exist
   * @throws {BadRequestException} If session is not in PENDING status, has no experts,
   *                                or required API keys are missing
   * @throws {InternalServerErrorException} If an unexpected error occurs during discussion
   * 
   * @example
   * POST /sessions/abc123-def456-ghi789/start
   * 
   * Response:
   * {
   *   "id": "abc123-def456-ghi789",
   *   "problemStatement": "How should we architect a scalable microservices system?",
   *   "status": "COMPLETED",
   *   "consensusReached": true,
   *   "maxMessages": 50,
   *   "createdAt": "2025-10-26T10:00:00Z",
   *   "updatedAt": "2025-10-26T10:05:30Z",
   *   "experts": [...]
   * }
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async startDiscussion(
    @Param('id') id: string,
  ): Promise<SessionResponseDto> {
    return this.councilService.startDiscussion(id);
  }
}

