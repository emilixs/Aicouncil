import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/**
 * Authentication service for generating and verifying JWT tokens
 * Used for WebSocket authentication
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(private readonly configService: ConfigService) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    if (!jwtSecret || jwtSecret.trim() === '') {
      this.logger.error('JWT_SECRET is not configured. Service cannot start without a valid JWT_SECRET.');
      throw new Error('JWT_SECRET environment variable is required for AuthService');
    }

    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '7d';
  }

  /**
   * Generate a JWT token for a session
   * @param payload - Token payload containing sessionId and optional userId
   * @returns JWT token string
   */
  generateToken(payload: { sessionId: string; userId?: string }): string {
    try {
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
      } as jwt.SignOptions);
      this.logger.log(`Generated token for session ${payload.sessionId}`);
      return token;
    } catch (error) {
      this.logger.error(`Failed to generate token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify a JWT token and return its payload
   * @param token - JWT token string
   * @returns Token payload or null if invalid
   */
  verifyToken(token: string): { sessionId: string; userId?: string } | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as {
        sessionId: string;
        userId?: string;
      };
      return payload;
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate a guest token for a session (no userId)
   * @param sessionId - Session ID
   * @returns JWT token string
   */
  generateGuestToken(sessionId: string): string {
    return this.generateToken({ sessionId });
  }
}

