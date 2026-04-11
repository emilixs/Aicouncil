import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { OverviewStats } from '@/types/analytics';
import {
  MessageSquare,
  CheckCircle,
  Coins,
  Hash,
  Target,
  Zap,
  ArrowDown,
} from 'lucide-react';

interface OverviewCardsProps {
  data: OverviewStats;
}

export function OverviewCards({ data }: OverviewCardsProps) {
  const cards = [
    {
      title: 'Total Sessions',
      value: data.totalSessions,
      icon: MessageSquare,
    },
    {
      title: 'Completed',
      value: data.completedSessions,
      icon: CheckCircle,
    },
    {
      title: 'Total Tokens',
      value: formatNumber(data.totalTokens),
      icon: Hash,
    },
    {
      title: 'Prompt Tokens',
      value: formatNumber(data.totalPromptTokens),
      icon: ArrowDown,
    },
    {
      title: 'Completion Tokens',
      value: formatNumber(data.totalCompletionTokens),
      icon: Zap,
    },
    {
      title: 'Estimated Cost',
      value: `$${data.estimatedCostUsd.toFixed(2)}`,
      icon: Coins,
    },
    {
      title: 'Avg Rounds to Consensus',
      value: data.avgRoundsToConsensus.toFixed(1),
      icon: Target,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
