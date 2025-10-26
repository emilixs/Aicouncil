import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { SessionService } from './session.service';
import { CreateSessionDto, SessionResponseDto } from './dto';

/**
 * REST controller for session management endpoints.
 * Provides endpoints for creating and retrieving sessions.
 * Session updates are handled internally by the Council orchestrator.
 */
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Create a new session with the specified problem and experts.
   *
   * @param createSessionDto - Session creation data
   * @returns Created session with participating experts
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createSessionDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    return this.sessionService.create(createSessionDto);
  }

  /**
   * Retrieve all sessions with their participating experts.
   * Sessions are ordered by creation date (newest first).
   *
   * @returns Array of all sessions
   */
  @Get()
  findAll(): Promise<SessionResponseDto[]> {
    return this.sessionService.findAll();
  }

  /**
   * Retrieve a single session by ID with experts and message count.
   *
   * @param id - Session ID
   * @returns Session with experts and message count
   */
  @Get(':id')
  findOne(@Param('id') id: string): Promise<SessionResponseDto> {
    return this.sessionService.findOne(id);
  }
}

