import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ComparisonStats } from '@/types/analytics';

interface ConsensusChartProps {
  comparisons: ComparisonStats[];
}

export function ConsensusChart({ comparisons }: ConsensusChartProps) {
  const data = comparisons.map((c) => {
    const fullName = c.expertCombination.join(', ');
    return {
      name: fullName.length > 30 ? fullName.slice(0, 30) + '...' : fullName,
      fullName,
      consensusRate: Math.round(c.consensusRate * 100),
      avgRounds: c.avgRounds,
      sessions: c.sessionCount,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Consensus by Expert Combination
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload;
                  return item?.fullName ?? '';
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="consensusRate"
                fill="hsl(var(--chart-2))"
                name="Consensus Rate (%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="avgRounds"
                fill="hsl(var(--chart-1))"
                name="Avg Rounds"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
