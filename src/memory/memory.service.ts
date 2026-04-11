import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { MessageService } from '../message/message.service';
import { CreateMemoryDto, UpdateMemoryDto, MemoryResponseDto } from './dto';
import { extractKeywords } from './utils/keywords';
import { scoreMemory, calculateTopicOverlap } from './utils/relevance';
import { LLMConfig } from '../llm/dto';
import { plainToInstance } from 'class-transformer';

const SUMMARIZATION_PROMPT = `You are summarizing your participation in a group discussion.

Problem statement: {problemStatement}

Your messages (chronological):
{expertMessages}

Other experts' messages (chronological):
{otherMessages}

Generate a JSON response with this structure:
{
  "summary": "2-3 paragraph summary of your contributions, positions, and conclusions",
  "insights": [
    { "text": "A specific insight or decision", "topics": ["keyword1", "keyword2"] }
  ],
  "topics": ["keyword1", "keyword2", "keyword3"]
}

Rules:
- Summary should capture your key positions and reasoning, not just what was discussed.
- Insights should be specific, actionable claims — not vague observations.
- Topics should be 5-10 domain-specific keywords (not generic words like "discussion").
- Maximum 5 insights.
- Respond with ONLY the JSON object, no markdown fences or extra text.`;

const MAX_MEMORY_TOKENS = 3000;

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverFactory: DriverFactory,
    private readonly messageService: MessageService,
  ) {}

  // --- CRUD ---

  async findAllByExpert(
    expertId: string,
    options?: { type?: MemoryType; page?: number; limit?: number },
  ): Promise<MemoryResponseDto[]> {
    await this.ensureExpertExists(expertId);

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;

    const where: Record<string, unknown> = { expertId };
    if (options?.type) {
      where.type = options.type;
    }

    const memories = await this.prisma.expertMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return memories.map((m) => MemoryResponseDto.fromPrisma(m));
  }

  async findOne(expertId: string, memoryId: string): Promise<MemoryResponseDto> {
    const memory = await this.findAndValidateOwnership(expertId, memoryId);
    return MemoryResponseDto.fromPrisma(memory);
  }

  async create(expertId: string, dto: CreateMemoryDto): Promise<MemoryResponseDto> {
    const expert = await this.ensureExpertExists(expertId);

    const memory = await this.prisma.expertMemory.create({
      data: {
        expertId,
        type: MemoryType.USER_NOTE,
        content: dto.content,
        relevance: dto.relevance ?? 1.0,
        metadata: dto.metadata
          ? (dto.metadata as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    // Prune if over limit
    await this.pruneIfNeeded(expertId, expert.memoryMaxEntries);

    return MemoryResponseDto.fromPrisma(memory);
  }

  async update(
    expertId: string,
    memoryId: string,
    dto: UpdateMemoryDto,
  ): Promise<MemoryResponseDto> {
    await this.findAndValidateOwnership(expertId, memoryId);

    const updated = await this.prisma.expertMemory.update({
      where: { id: memoryId },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.relevance !== undefined && { relevance: dto.relevance }),
      },
    });

    return MemoryResponseDto.fromPrisma(updated);
  }

  async remove(expertId: string, memoryId: string): Promise<void> {
    await this.findAndValidateOwnership(expertId, memoryId);
    await this.prisma.expertMemory.delete({ where: { id: memoryId } });
  }

  async clearAllByExpert(expertId: string): Promise<void> {
    await this.ensureExpertExists(expertId);
    await this.prisma.expertMemory.deleteMany({ where: { expertId } });
  }

  // --- Memory Generation ---

  async generateSessionMemory(expertId: string, sessionId: string): Promise<void> {
    const expert = await this.prisma.expert.findUnique({ where: { id: expertId } });
    if (!expert || !expert.memoryEnabled) return;

    try {
      const allMessages = await this.messageService.findBySession(sessionId);
      const expertMessages = allMessages.filter((m) => m.expertId === expertId);
      const otherMessages = allMessages.filter((m) => m.expertId !== expertId);

      if (expertMessages.length === 0) return;

      // Get session problem statement
      const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
      if (!session) return;

      // Build summarization prompt
      const prompt = SUMMARIZATION_PROMPT
        .replace('{problemStatement}', session.problemStatement)
        .replace(
          '{expertMessages}',
          expertMessages.map((m) => m.content).join('\n\n'),
        )
        .replace(
          '{otherMessages}',
          otherMessages
            .map((m) => `[${m.expertName || 'Unknown'}] ${m.content}`)
            .join('\n\n'),
        );

      // Use expert's own LLM
      const driver = this.driverFactory.createDriver(expert.driverType);
      const config = plainToInstance(LLMConfig, expert.config);

      const response = await driver.chat(
        [{ role: 'user', content: prompt }],
        config,
      );

      // Parse JSON response
      const parsed = this.parseSummarizationResponse(response.content);
      if (!parsed) {
        this.logger.warn(`Failed to parse summarization response for expert ${expertId}`);
        return;
      }

      // Create SESSION_SUMMARY
      await this.prisma.expertMemory.create({
        data: {
          expertId,
          sessionId,
          type: MemoryType.SESSION_SUMMARY,
          content: parsed.summary,
          relevance: 1.0,
          metadata: {
            topics: parsed.topics,
            sessionTitle: session.problemStatement.substring(0, 100),
          },
        },
      });

      // Create KEY_INSIGHT entries (max 5)
      for (const insight of parsed.insights.slice(0, 5)) {
        await this.prisma.expertMemory.create({
          data: {
            expertId,
            sessionId,
            type: MemoryType.KEY_INSIGHT,
            content: insight.text,
            relevance: 1.0,
            metadata: { topics: insight.topics },
          },
        });
      }

      // Prune if needed
      await this.pruneIfNeeded(expertId, expert.memoryMaxEntries);

      this.logger.log(
        `Generated memory for expert ${expertId}: 1 summary + ${parsed.insights.length} insights`,
      );
    } catch (error) {
      // Memory generation failures should not break session flow
      this.logger.error(
        `Failed to generate memory for expert ${expertId}, session ${sessionId}: ${error.message}`,
        error.stack,
      );
    }
  }

  // --- Memory Injection ---

  async getRelevantMemories(
    expertId: string,
    problemStatement: string,
    maxInject: number,
  ): Promise<{ memories: MemoryResponseDto[]; ids: string[] }> {
    const memories = await this.prisma.expertMemory.findMany({
      where: {
        expertId,
        relevance: { gt: 0.1 },
      },
    });

    if (memories.length === 0) return { memories: [], ids: [] };

    const queryTopics = extractKeywords(problemStatement);

    // Score and sort
    const scored = memories.map((m) => {
      const memoryTopics = (m.metadata as { topics?: string[] })?.topics ?? [];
      const score =
        m.type === 'USER_NOTE'
          ? m.relevance * 1.0 * calculateTopicOverlap(memoryTopics, queryTopics)
          : scoreMemory(m.relevance, m.createdAt, memoryTopics, queryTopics);
      return { memory: m, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Take top N
    let selected = scored.slice(0, maxInject);

    // Token budget check (~4 chars per token)
    let totalTokens = selected.reduce((sum, s) => sum + Math.ceil(s.memory.content.length / 4), 0);
    if (totalTokens > MAX_MEMORY_TOKENS && selected.length > 3) {
      selected = selected.slice(0, 3);
    }

    const dtos = selected.map((s) => MemoryResponseDto.fromPrisma(s.memory));
    const ids = selected.map((s) => s.memory.id);

    return { memories: dtos, ids };
  }

  formatMemoriesForInjection(memories: MemoryResponseDto[]): string {
    if (memories.length === 0) return '';

    const lines = memories.map((m) => {
      const meta = m.metadata as { sessionTitle?: string } | null;
      const age = this.formatAge(m.createdAt);

      switch (m.type) {
        case 'SESSION_SUMMARY': {
          const title = meta?.sessionTitle ?? 'Unknown session';
          return `[Session: "${title}" - ${age}]\n${m.content}`;
        }
        case 'KEY_INSIGHT':
          return `[Key Insight - ${age}]\n${m.content}`;
        case 'USER_NOTE':
          return `[Note]\n${m.content}`;
        default:
          return m.content;
      }
    });

    return `Relevant Memory from Past Sessions:\n---\n${lines.join('\n\n')}\n---\nReference these memories naturally when relevant. Prioritize the current problem statement.`;
  }

  // --- Private Helpers ---

  private async ensureExpertExists(expertId: string) {
    const expert = await this.prisma.expert.findUnique({ where: { id: expertId } });
    if (!expert) {
      throw new NotFoundException(`Expert with ID ${expertId} not found`);
    }
    return expert;
  }

  private async findAndValidateOwnership(expertId: string, memoryId: string) {
    const memory = await this.prisma.expertMemory.findUnique({ where: { id: memoryId } });
    if (!memory || memory.expertId !== expertId) {
      throw new NotFoundException(
        `Memory with ID ${memoryId} not found for expert ${expertId}`,
      );
    }
    return memory;
  }

  private async pruneIfNeeded(expertId: string, maxEntries: number): Promise<void> {
    const count = await this.prisma.expertMemory.count({ where: { expertId } });
    if (count <= maxEntries) return;

    // Get lowest-relevance non-USER_NOTE entries
    const toPrune = await this.prisma.expertMemory.findMany({
      where: {
        expertId,
        type: { not: MemoryType.USER_NOTE },
      },
      orderBy: { relevance: 'asc' },
      take: count - maxEntries,
    });

    if (toPrune.length > 0) {
      await this.prisma.expertMemory.deleteMany({
        where: { id: { in: toPrune.map((m) => m.id) } },
      });
    }
  }

  private parseSummarizationResponse(
    content: string,
  ): { summary: string; insights: { text: string; topics: string[] }[]; topics: string[] } | null {
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.summary || typeof parsed.summary !== 'string') return null;

      return {
        summary: parsed.summary,
        insights: Array.isArray(parsed.insights)
          ? parsed.insights.filter(
              (i: unknown) =>
                typeof i === 'object' &&
                i !== null &&
                typeof (i as { text?: unknown }).text === 'string',
            )
          : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      };
    } catch {
      return null;
    }
  }

  private formatAge(date: Date): string {
    const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return '1 week ago';
    return `${weeks} weeks ago`;
  }
}
