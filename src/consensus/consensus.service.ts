import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DriverType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../common/prisma.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { MessageService } from '../message/message.service';
import { LLMDriver } from '../llm/interfaces/llm-driver.interface';
import { LLMConfig } from '../llm/dto';
import { ConsensusEvaluationResult } from './dto/consensus-evaluation.dto';
import { DISCUSSION_EVENTS } from '../council/events/discussion.events';
import { DiscussionSummary } from './dto/discussion-outcome.dto';
import {
  buildConsensusEvaluatorPrompt,
  buildConsensusEvaluatorMessages,
} from './prompts/consensus-evaluator.prompt';
import {
  buildSummaryGeneratorPrompt,
  buildSummaryMessages,
  buildChunkSummaryPrompt,
} from './prompts/summary-generator.prompt';

@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);
  private evaluatorDriver: LLMDriver | null = null;
  private stalledRoundCounts: Map<string, number> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverFactory: DriverFactory,
    private readonly messageService: MessageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  private getEvaluatorDriver(): LLMDriver {
    if (!this.evaluatorDriver) {
      const driverType = (this.configService.get<string>('CONSENSUS_EVALUATOR_DRIVER') ?? 'ANTHROPIC') as DriverType;
      this.evaluatorDriver = this.driverFactory.createDriver(driverType);
    }
    return this.evaluatorDriver;
  }

  private getEvaluatorModel(): string {
    return this.configService.get<string>('CONSENSUS_EVALUATOR_MODEL') ?? 'claude-sonnet-4-20250514';
  }

  async evaluateConsensus(
    sessionId: string,
    session: { problemStatement: string; consensusThreshold?: number },
    experts: Array<{ id: string; name: string; specialty: string }>,
    roundNumber: number,
  ): Promise<ConsensusEvaluationResult> {
    const fallback: ConsensusEvaluationResult = {
      convergenceScore: 0,
      consensusReached: false,
      areasOfAgreement: [],
      areasOfDisagreement: [],
      progressAssessment: 'stalled',
      reasoning: 'Failed to evaluate consensus.',
    };

    try {
      const allMessages = await this.messageService.findBySession(sessionId);

      const currentRoundMessages = allMessages
        .filter((m: any) => m.roundNumber === roundNumber && m.role === 'ASSISTANT')
        .map((m: any) => ({ expertName: m.expertName ?? 'Unknown', content: m.content }));

      if (currentRoundMessages.length === 0) {
        return fallback;
      }

      let priorContext: string | undefined;
      if (roundNumber > 3) {
        const priorMessages = allMessages
          .filter((m: any) => m.roundNumber !== null && m.roundNumber < roundNumber)
          .map((m: any) => ({ expertName: m.expertName ?? 'Unknown', content: m.content, role: m.role }));
        priorContext = await this.summarizeMessages(priorMessages);
      } else {
        const priorMessages = allMessages.filter(
          (m: any) => m.roundNumber !== null && m.roundNumber < roundNumber,
        );
        if (priorMessages.length > 0) {
          priorContext = priorMessages
            .map((m: any) => `[${m.expertName ?? 'Unknown'}]: ${m.content}`)
            .join('\n\n');
        }
      }

      const systemPrompt = buildConsensusEvaluatorPrompt(
        session.problemStatement,
        experts,
        roundNumber,
      );
      const userContent = buildConsensusEvaluatorMessages(currentRoundMessages, priorContext);

      const driver = this.getEvaluatorDriver();
      const config = { model: this.getEvaluatorModel() } as LLMConfig;
      const response = await driver.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        config,
      );

      const evaluation = this.parseEvaluationJson(response.content);
      if (!evaluation) {
        this.logger.warn(`Meta-evaluator returned malformed JSON for session ${sessionId}`);
        return fallback;
      }

      const saved = await this.prisma.consensusEvaluation.create({
        data: {
          sessionId,
          roundNumber,
          convergenceScore: evaluation.convergenceScore,
          consensusReached: evaluation.consensusReached,
          areasOfAgreement: evaluation.areasOfAgreement,
          areasOfDisagreement: evaluation.areasOfDisagreement,
          progressAssessment: evaluation.progressAssessment,
          reasoning: evaluation.reasoning,
        },
      });

      this.eventEmitter.emit(DISCUSSION_EVENTS.CONSENSUS_EVALUATION, {
        sessionId,
        evaluation: saved,
      });

      return evaluation;
    } catch (error) {
      this.logger.error(
        `Error evaluating consensus for session ${sessionId}: ${error.message}`,
        error.stack,
      );
      return fallback;
    }
  }

  private parseEvaluationJson(content: string): ConsensusEvaluationResult | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      if (
        typeof parsed.convergenceScore !== 'number' ||
        typeof parsed.consensusReached !== 'boolean' ||
        !Array.isArray(parsed.areasOfAgreement) ||
        !Array.isArray(parsed.areasOfDisagreement) ||
        !['converging', 'stalled', 'diverging'].includes(parsed.progressAssessment) ||
        typeof parsed.reasoning !== 'string'
      ) {
        return null;
      }

      return {
        convergenceScore: Math.max(0, Math.min(1, parsed.convergenceScore)),
        consensusReached: parsed.consensusReached,
        areasOfAgreement: parsed.areasOfAgreement,
        areasOfDisagreement: parsed.areasOfDisagreement,
        progressAssessment: parsed.progressAssessment,
        reasoning: parsed.reasoning,
      };
    } catch {
      return null;
    }
  }

  private async summarizeMessages(
    messages: Array<{ expertName: string; content: string; role: string }>,
  ): Promise<string> {
    const text = messages
      .map((m) => `[${m.expertName}]: ${m.content}`)
      .join('\n\n');

    if (text.length < 4000) {
      return text;
    }

    try {
      const { buildChunkSummaryPrompt } = await import('./prompts/summary-generator.prompt');
      const driver = this.getEvaluatorDriver();
      const config = { model: this.getEvaluatorModel() } as LLMConfig;
      const response = await driver.chat(
        [
          { role: 'system', content: buildChunkSummaryPrompt() },
          { role: 'user', content: text },
        ],
        config,
      );
      return response.content;
    } catch {
      return text.substring(0, 4000);
    }
  }

  async generateSummary(
    sessionId: string,
    session: { problemStatement: string },
    experts: Array<{ id: string; name: string; specialty: string }>,
    endReason: string,
    finalEvaluation?: ConsensusEvaluationResult,
  ): Promise<DiscussionSummary | null> {
    try {
      const allMessages = await this.messageService.findBySession(sessionId);

      if (allMessages.length === 0) {
        return null;
      }

      const formattedMessages = allMessages.map((m: any) => ({
        expertName: m.expertName ?? 'Unknown',
        content: m.content,
        role: m.role,
      }));

      let transcript: string;
      if (allMessages.length > 50) {
        transcript = await this.twoPassSummarize(formattedMessages);
      } else {
        transcript = buildSummaryMessages(formattedMessages);
      }

      const systemPrompt = buildSummaryGeneratorPrompt(
        session.problemStatement,
        experts,
        endReason,
      );

      const driver = this.getEvaluatorDriver();
      const config = { model: this.getEvaluatorModel() } as LLMConfig;
      const response = await driver.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        config,
      );

      const summary = this.parseSummaryJson(response.content);
      if (!summary) {
        this.logger.warn(`Summary generation returned malformed JSON for session ${sessionId}`);
        return null;
      }

      const outcome = await this.prisma.discussionOutcome.create({
        data: {
          sessionId,
          executiveSummary: summary.executiveSummary,
          decisions: summary.decisions,
          actionItems: summary.actionItems,
          keyArguments: summary.keyArguments,
          openQuestions: summary.openQuestions,
          finalEvaluation: finalEvaluation ? JSON.parse(JSON.stringify(finalEvaluation)) : undefined,
          generatedBy: this.getEvaluatorModel(),
        },
      });

      this.eventEmitter.emit(DISCUSSION_EVENTS.DISCUSSION_SUMMARY, {
        sessionId,
        outcome,
      });

      return summary;
    } catch (error) {
      this.logger.error(
        `Error generating summary for session ${sessionId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  private async twoPassSummarize(
    messages: Array<{ expertName: string; content: string; role: string }>,
  ): Promise<string> {
    const chunkSize = 20;
    const chunks: Array<Array<{ expertName: string; content: string; role: string }>> = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push(messages.slice(i, i + chunkSize));
    }

    const chunkSummaries: string[] = [];
    const driver = this.getEvaluatorDriver();
    const config = { model: this.getEvaluatorModel() } as LLMConfig;

    for (const chunk of chunks) {
      const chunkText = chunk
        .map((m) => `[${m.expertName}]: ${m.content}`)
        .join('\n\n');

      const response = await driver.chat(
        [
          { role: 'system', content: buildChunkSummaryPrompt() },
          { role: 'user', content: chunkText },
        ],
        config,
      );

      chunkSummaries.push(response.content);
    }

    return '## Discussion Summary (condensed)\n\n' + chunkSummaries.join('\n\n---\n\n');
  }

  private parseSummaryJson(content: string): DiscussionSummary | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      if (
        typeof parsed.executiveSummary !== 'string' ||
        !Array.isArray(parsed.decisions) ||
        !Array.isArray(parsed.actionItems) ||
        !Array.isArray(parsed.keyArguments) ||
        !Array.isArray(parsed.openQuestions)
      ) {
        return null;
      }

      return parsed as DiscussionSummary;
    } catch {
      return null;
    }
  }

  checkStallDetection(
    sessionId: string,
    evaluation: ConsensusEvaluationResult,
  ): { stalled: boolean; stalledRounds: number } {
    const count = this.stalledRoundCounts.get(sessionId) ?? 0;

    if (evaluation.progressAssessment === 'stalled') {
      const newCount = count + 1;
      this.stalledRoundCounts.set(sessionId, newCount);

      if (newCount >= 2) {
        this.eventEmitter.emit(DISCUSSION_EVENTS.DISCUSSION_STALLED, {
          sessionId,
          stalledRounds: newCount,
        });
      }

      return { stalled: newCount >= 3, stalledRounds: newCount };
    }

    this.stalledRoundCounts.set(sessionId, 0);
    return { stalled: false, stalledRounds: 0 };
  }

  clearSessionState(sessionId: string): void {
    this.stalledRoundCounts.delete(sessionId);
  }
}
