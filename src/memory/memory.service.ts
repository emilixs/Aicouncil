import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { MessageService } from '../message/message.service';
import { extractKeywords } from './utils/keywords';
import { scoreMemory, calculateEffectiveRelevance } from './utils/relevance';

interface ScoredMemory {
  id: string;
  expertId: string;
  sessionId: string | null;
  type: string;
  content: string;
  relevance: number;
  effectiveRelevance: number;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverFactory: DriverFactory,
    private readonly messageService: MessageService,
  ) {}

  async findAllByExpert(
    expertId: string,
    options?: { type?: MemoryType; page?: number; limit?: number },
  ): Promise<{ data: any[]; total: number }> {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
    });
    if (!expert) {
      throw new NotFoundException(`Expert ${expertId} not found`);
    }

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      expertId,
      ...(options?.type ? { type: options.type } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expertMemory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expertMemory.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(expertId: string, memoryId: string) {
    const memory = await this.prisma.expertMemory.findUnique({
      where: { id: memoryId },
    });
    if (!memory || memory.expertId !== expertId) {
      throw new NotFoundException(`Memory ${memoryId} not found for expert ${expertId}`);
    }
    return memory;
  }

  async create(
    expertId: string,
    dto: { content: string; relevance?: number; metadata?: { topics?: string[] } },
  ) {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
    });
    if (!expert) {
      throw new NotFoundException(`Expert ${expertId} not found`);
    }

    const memory = await this.prisma.expertMemory.create({
      data: {
        expertId,
        type: MemoryType.USER_NOTE,
        content: dto.content,
        relevance: dto.relevance ?? 1.0,
        ...(dto.metadata ? { metadata: dto.metadata } : {}),
      },
    });

    // Prune old memories if over limit
    await this.pruneMemories(expertId, expert.memoryMaxEntries);

    return memory;
  }

  async update(expertId: string, memoryId: string, dto: { content?: string; relevance?: number }) {
    const memory = await this.prisma.expertMemory.findUnique({
      where: { id: memoryId },
    });
    if (!memory || memory.expertId !== expertId) {
      throw new NotFoundException(`Memory ${memoryId} not found for expert ${expertId}`);
    }

    return this.prisma.expertMemory.update({
      where: { id: memoryId },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.relevance !== undefined ? { relevance: dto.relevance } : {}),
      },
    });
  }

  async remove(expertId: string, memoryId: string) {
    const memory = await this.prisma.expertMemory.findUnique({
      where: { id: memoryId },
    });
    if (!memory || memory.expertId !== expertId) {
      throw new NotFoundException(`Memory ${memoryId} not found for expert ${expertId}`);
    }

    await this.prisma.expertMemory.delete({ where: { id: memoryId } });
  }

  async clearAllByExpert(expertId: string) {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
    });
    if (!expert) {
      throw new NotFoundException(`Expert ${expertId} not found`);
    }

    await this.prisma.expertMemory.deleteMany({ where: { expertId } });
  }

  async getRelevantMemories(
    expertId: string,
    problemStatement: string,
    maxInject: number,
  ): Promise<{ memories: ScoredMemory[]; ids: string[] }> {
    const allMemories = await this.prisma.expertMemory.findMany({
      where: { expertId, relevance: { gt: 0.1 } },
    });

    if (allMemories.length === 0) {
      return { memories: [], ids: [] };
    }

    const queryTopics = extractKeywords(problemStatement);

    const scored: ScoredMemory[] = allMemories
      .map((mem) => {
        const memTopics = (mem.metadata as any)?.topics ?? extractKeywords(mem.content);
        const memScore = scoreMemory(mem.relevance, mem.createdAt, memTopics, queryTopics);
        return {
          ...mem,
          effectiveRelevance: memScore,
        };
      })
      .filter((mem) => {
        const eff = calculateEffectiveRelevance(mem.relevance, mem.createdAt);
        return eff > 0.1;
      })
      .sort((a, b) => b.effectiveRelevance - a.effectiveRelevance)
      .slice(0, maxInject);

    const TOKEN_BUDGET = 3000;
    const MAX_FALLBACK = 3;
    const totalTokens = scored.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const result = totalTokens > TOKEN_BUDGET ? scored.slice(0, MAX_FALLBACK) : scored;

    return {
      memories: result,
      ids: result.map((m) => m.id),
    };
  }

  formatMemoriesForInjection(memories: ScoredMemory[]): string {
    if (memories.length === 0) return '';

    const entries = memories.map((mem) => {
      const age = this.formatAge(mem.createdAt);
      if (mem.type === 'SESSION_SUMMARY') {
        const title = (mem.metadata as any)?.sessionTitle ?? 'Previous Session';
        return `[Session: "${title}" — ${age}]\n${mem.content}`;
      }
      if (mem.type === 'KEY_INSIGHT') {
        return `[Key Insight — ${age}]\n${mem.content}`;
      }
      return `[Note]\n${mem.content}`;
    });

    return `Relevant Memory from Past Sessions:\n---\n${entries.join('\n\n')}\n---\nUse these memories as context. You may reference past discussions naturally, but prioritize the current problem statement.`;
  }

  async generateSessionMemory(expertId: string, sessionId: string): Promise<void> {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
    });

    if (!expert || !expert.memoryEnabled) return;

    const messages = await this.messageService.findBySession(sessionId);
    const expertMessages = messages.filter((m) => m.expertId === expertId);

    if (expertMessages.length === 0) return;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    const otherMessages = messages.filter((m) => m.expertId !== expertId);

    const prompt = `You are summarizing your participation in a discussion.

Problem statement: ${session?.problemStatement ?? 'Unknown'}
Your messages: ${expertMessages.map((m) => m.content).join('\n')}
Other experts' messages: ${otherMessages.map((m) => `[${m.expertName}] ${m.content}`).join('\n')}

Generate a JSON object with:
- summary: A concise summary of your key positions and conclusions
- insights: Array of {text, topics} objects for key insights (max 5)
- topics: Array of 5-10 keywords/topics discussed

Respond ONLY with valid JSON.`;

    try {
      const driver = this.driverFactory.createDriver(expert.driverType);
      const response = await driver.chat([{ role: 'user', content: prompt }], expert.config as any);

      const parsed = JSON.parse(response.content);

      // Create SESSION_SUMMARY
      await this.prisma.expertMemory.create({
        data: {
          expertId,
          sessionId,
          type: MemoryType.SESSION_SUMMARY,
          content: parsed.summary,
          relevance: 1.0,
          metadata: {
            topics: parsed.topics ?? [],
            sessionTitle: session?.problemStatement ?? 'Unknown',
          },
        },
      });

      // Create KEY_INSIGHT entries
      const insights = (parsed.insights ?? []).slice(0, 5);
      for (const insight of insights) {
        await this.prisma.expertMemory.create({
          data: {
            expertId,
            sessionId,
            type: MemoryType.KEY_INSIGHT,
            content: insight.text,
            relevance: 1.0,
            metadata: { topics: insight.topics ?? [] },
          },
        });
      }

      await this.pruneMemories(expertId, expert.memoryMaxEntries);
    } catch (error) {
      this.logger.error(`Failed to generate memory for expert ${expertId}: ${error.message}`);
    }
  }

  private async pruneMemories(expertId: string, maxEntries: number): Promise<void> {
    const count = await this.prisma.expertMemory.count({
      where: { expertId },
    });

    if (count <= maxEntries) return;

    const prunable = await this.prisma.expertMemory.findMany({
      where: { expertId, type: { not: MemoryType.USER_NOTE } },
      select: { id: true, relevance: true, createdAt: true },
    });

    const scored = prunable
      .map((mem) => ({
        id: mem.id,
        score: calculateEffectiveRelevance(mem.relevance, mem.createdAt),
      }))
      .sort((a, b) => a.score - b.score);

    const deleteCount = count - maxEntries;
    const toDelete = scored.slice(0, deleteCount);

    for (const mem of toDelete) {
      await this.prisma.expertMemory.delete({ where: { id: mem.id } });
    }
  }

  private formatAge(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return '1 week ago';
    return `${weeks} weeks ago`;
  }
}
