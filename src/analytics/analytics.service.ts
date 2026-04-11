import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { estimateCost } from './pricing.config';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async computeSessionMetrics(sessionId: string) {
    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    const totalMessages = messages.length;
    const totalInterventions = messages.filter((m) => m.isIntervention).length;

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalRounds = 0;
    let durationMs = 0;
    let avgResponseTimeMs = 0;

    const responseTimes: number[] = [];

    for (const msg of messages) {
      totalPromptTokens += msg.promptTokens ?? 0;
      totalCompletionTokens += msg.completionTokens ?? 0;
      totalTokens += msg.totalTokens ?? 0;
      if (msg.roundNumber != null && msg.roundNumber > totalRounds) {
        totalRounds = msg.roundNumber;
      }
      if (msg.responseTimeMs != null) {
        responseTimes.push(msg.responseTimeMs);
      }
    }

    if (messages.length >= 2) {
      const first = messages[0].timestamp.getTime();
      const last = messages[messages.length - 1].timestamp.getTime();
      durationMs = last - first;
    }

    if (responseTimes.length > 0) {
      avgResponseTimeMs =
        responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    }

    // Estimate cost per model
    const costByModel = new Map<string, { prompt: number; completion: number }>();
    for (const msg of messages) {
      if (msg.model && (msg.promptTokens || msg.completionTokens)) {
        const existing = costByModel.get(msg.model) || { prompt: 0, completion: 0 };
        existing.prompt += msg.promptTokens ?? 0;
        existing.completion += msg.completionTokens ?? 0;
        costByModel.set(msg.model, existing);
      }
    }
    let estimatedCostUsd = 0;
    for (const [model, tokens] of costByModel) {
      estimatedCostUsd += estimateCost(model, tokens.prompt, tokens.completion);
    }

    const metricsData = {
      sessionId,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalRounds,
      totalMessages,
      totalInterventions,
      durationMs,
      avgResponseTimeMs,
      estimatedCostUsd,
    };

    const result = await this.prisma.sessionMetrics.upsert({
      where: { sessionId },
      create: metricsData,
      update: metricsData,
    });

    return result;
  }

  async getOverview(filter?: { from?: string; to?: string }) {
    const where: any = {};
    if (filter?.from || filter?.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = new Date(filter.from);
      if (filter.to) where.createdAt.lte = new Date(filter.to);
    }

    const sessions = await this.prisma.session.findMany({ where });
    const completedSessions = sessions.filter((s) => s.status === 'COMPLETED').length;

    const aggregate = await this.prisma.sessionMetrics.aggregate({
      _sum: { totalTokens: true, totalPromptTokens: true, totalCompletionTokens: true },
      _avg: { totalRounds: true },
      _count: true,
    });

    return {
      totalSessions: sessions.length,
      completedSessions,
      totalTokens: aggregate._sum.totalTokens ?? 0,
      totalPromptTokens: aggregate._sum.totalPromptTokens ?? 0,
      totalCompletionTokens: aggregate._sum.totalCompletionTokens ?? 0,
      estimatedCostUsd: 0, // Simplified — could sum from metrics
      avgRoundsToConsensus: aggregate._avg.totalRounds ?? 0,
    };
  }

  async getSessionAnalytics(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    const metrics = await this.prisma.sessionMetrics.findUnique({
      where: { sessionId },
    });

    const messages = await this.prisma.message.findMany({
      where: { sessionId },
    });

    // Compute per-expert breakdown
    const expertMap = new Map<
      string,
      { expertId: string; totalTokens: number; messageCount: number; responseTimes: number[] }
    >();

    for (const msg of messages) {
      if (!msg.expertId) continue;
      const existing = expertMap.get(msg.expertId) || {
        expertId: msg.expertId,
        totalTokens: 0,
        messageCount: 0,
        responseTimes: [],
      };
      existing.totalTokens += msg.totalTokens ?? 0;
      existing.messageCount++;
      if (msg.responseTimeMs != null) {
        existing.responseTimes.push(msg.responseTimeMs);
      }
      expertMap.set(msg.expertId, existing);
    }

    const perExpert = Array.from(expertMap.values()).map((e) => ({
      expertId: e.expertId,
      totalTokens: e.totalTokens,
      messageCount: e.messageCount,
      avgResponseTimeMs:
        e.responseTimes.length > 0
          ? e.responseTimes.reduce((s, t) => s + t, 0) / e.responseTimes.length
          : 0,
    }));

    return { metrics, perExpert };
  }

  async getSessionsList() {
    const sessions =
      (await this.prisma.session.findMany({
        include: { metrics: true },
        orderBy: { createdAt: 'desc' },
      })) ?? [];

    return sessions.map((s: any) => ({
      sessionId: s.id,
      problemStatement: s.problemStatement,
      status: s.status,
      totalTokens: s.metrics?.totalTokens ?? 0,
      totalRounds: s.metrics?.totalRounds ?? 0,
      estimatedCostUsd: s.metrics?.estimatedCostUsd ?? 0,
      consensusReached: s.consensusReached,
      durationMs: s.metrics?.durationMs ?? 0,
      createdAt: s.createdAt?.toISOString?.() ?? s.createdAt,
    }));
  }

  async getExpertsList() {
    const experts =
      (await this.prisma.sessionExpert.findMany({
        include: { expert: true },
      })) ?? [];

    const expertMap = new Map<string, any>();
    for (const se of experts) {
      if (!expertMap.has(se.expertId)) {
        expertMap.set(se.expertId, {
          expertId: se.expertId,
          name: (se as any).expert?.name,
          specialty: (se as any).expert?.specialty,
          sessionIds: [],
        });
      }
      expertMap.get(se.expertId).sessionIds.push(se.sessionId);
    }

    const result = [];
    for (const [, data] of expertMap) {
      const messages =
        (await this.prisma.message.findMany({
          where: { expertId: data.expertId },
        })) ?? [];

      const totalTokens = messages.reduce((s: number, m: any) => s + (m.totalTokens ?? 0), 0);
      const avgTokensPerMessage = messages.length > 0 ? totalTokens / messages.length : 0;

      const sessions =
        (await this.prisma.session.findMany({
          where: { id: { in: data.sessionIds } },
        })) ?? [];
      const consensusRate =
        sessions.length > 0
          ? sessions.filter((s: any) => s.consensusReached).length / sessions.length
          : 0;

      result.push({
        expertId: data.expertId,
        name: data.name,
        specialty: data.specialty,
        totalSessions: data.sessionIds.length,
        avgTokensPerMessage,
        consensusRate,
      });
    }

    return result;
  }

  async getExpertAnalytics(expertId: string) {
    const sessionExperts =
      (await this.prisma.sessionExpert.findMany({
        where: { expertId },
        include: { expert: true, session: true },
      })) ?? [];

    return {
      expertId,
      name: sessionExperts[0]?.expert?.name ?? '',
      specialty: sessionExperts[0]?.expert?.specialty ?? '',
      totalSessions: sessionExperts.length,
      sessions: sessionExperts.map((se: any) => ({
        sessionId: se.sessionId,
        status: se.session?.status,
      })),
    };
  }

  async getComparisons() {
    const sessions =
      (await this.prisma.session.findMany({
        include: {
          experts: { include: { expert: true } },
          metrics: true,
        },
      })) ?? [];

    const combMap = new Map<string, { expertCombination: string[]; sessions: any[] }>();

    for (const session of sessions) {
      const expertIds = ((session as any).experts ?? [])
        .map((e: any) => e.expertId)
        .sort();
      const key = expertIds.join(',');
      const existing = combMap.get(key) || {
        expertCombination: expertIds,
        sessions: [] as any[],
      };
      existing.sessions.push(session);
      combMap.set(key, existing);
    }

    return Array.from(combMap.values()).map((group) => {
      const sessionCount = group.sessions.length;
      const avgRounds =
        group.sessions.reduce((s, ses) => s + (ses.metrics?.totalRounds ?? 0), 0) /
        (sessionCount || 1);
      const consensusRate =
        group.sessions.filter((s: any) => s.consensusReached).length / (sessionCount || 1);
      const avgTotalTokens =
        group.sessions.reduce((s, ses) => s + (ses.metrics?.totalTokens ?? 0), 0) /
        (sessionCount || 1);

      return {
        expertCombination: group.expertCombination,
        sessionCount,
        avgRounds,
        consensusRate,
        avgTotalTokens,
      };
    });
  }
}
