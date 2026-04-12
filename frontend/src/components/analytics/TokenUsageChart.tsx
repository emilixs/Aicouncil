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
import type { SessionAnalytics } from '@/types/analytics';

interface TokenUsageChartProps {
  sessions: SessionAnalytics[];
}

export function TokenUsageChart({ sessions }: TokenUsageChartProps) {
  const data = sessions.slice(0, 10).map((s) => ({
    name:
      s.problemStatement.length > 20
        ? s.problemStatement.slice(0, 20) + '...'
        : s.problemStatement,
    tokens: s.totalTokens,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Token Usage by Session</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No data available
          </p>
        ) : (
          <>
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
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="tokens"
                  fill="hsl(var(--chart-1))"
                  name="Tokens"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            {sessions.length > 10 && (
              <p className="text-center text-sm text-muted-foreground mt-2">
                Showing 10 of {sessions.length} sessions
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
