import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { SessionService } from './session.service';
import { CreateSessionDto, SessionResponseDto } from './dto';
import { MessageService } from '../message/message.service';
import { MessageResponseDto } from '../message/dto';
import { AuthService } from '../common/auth/auth.service';

/**
 * REST controller for session management endpoints.
 * Provides endpoints for creating and retrieving sessions.
 * Session updates are handled internally by the Council orchestrator.
 */
@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly authService: AuthService,
  ) {}

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
   * Retrieve all sessions with their participating experts and message counts.
   * Sessions are ordered by creation date (newest first).
   *
   * @returns Array of all sessions with experts and message counts
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

  @Get(':id/messages')
  async getMessages(@Param('id') id: string): Promise<MessageResponseDto[]> {
    // Validate that session exists
    await this.sessionService.findOne(id);
    return this.messageService.findBySession(id);
  }

  /**
   * Generate a JWT token for WebSocket authentication.
   * This token can be used to authenticate WebSocket connections for real-time updates.
   *
   * @param id - Session ID
   * @param body - Optional body containing userId
   * @returns JWT token and session ID
   */
  @Post(':id/token')
  @HttpCode(HttpStatus.OK)
  async generateToken(
    @Param('id') id: string,
    @Body() body?: { userId?: string },
  ): Promise<{ token: string; sessionId: string }> {
    // Validate that session exists
    await this.sessionService.findOne(id);

    // Generate token
    const token = this.authService.generateToken({
      sessionId: id,
      userId: body?.userId,
    });

    return {
      token,
      sessionId: id,
    };
  }
}

