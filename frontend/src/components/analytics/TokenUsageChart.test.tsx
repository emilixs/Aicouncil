import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TokenUsageChart } from './TokenUsageChart';
import type { SessionAnalytics } from '@/types/analytics';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-length={data.length}>{children}</div>
  ),
  Bar: ({ dataKey, fill, name }: { dataKey: string; fill: string; name: string }) => (
    <div data-testid={`bar-${dataKey}`} data-fill={fill} data-name={name} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

const mockSessions: SessionAnalytics[] = [
  {
    sessionId: 's1',
    problemStatement: 'Short problem',
    status: 'COMPLETED',
    totalTokens: 5000,
    totalRounds: 3,
    estimatedCostUsd: 0.15,
    consensusReached: true,
    durationMs: 120000,
    createdAt: '2026-04-01T10:00:00Z',
  },
  {
    sessionId: 's2',
    problemStatement: 'This is a very long problem statement that exceeds twenty characters',
    status: 'IN_PROGRESS',
    totalTokens: 2000,
    totalRounds: 1,
    estimatedCostUsd: 0.06,
    consensusReached: false,
    durationMs: 30000,
    createdAt: '2026-04-02T14:00:00Z',
  },
];

describe('TokenUsageChart', () => {
  it('renders chart with session data', () => {
    render(<TokenUsageChart sessions={mockSessions} />);
    expect(screen.getByText('Token Usage by Session')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-length', '2');
  });

  it('shows empty state when no sessions', () => {
    render(<TokenUsageChart sessions={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('uses CSS variable for bar fill color', () => {
    render(<TokenUsageChart sessions={mockSessions} />);
    expect(screen.getByTestId('bar-tokens')).toHaveAttribute(
      'data-fill',
      'hsl(var(--primary))',
    );
  });

  it('truncates long problem statements with ellipsis', () => {
    render(<TokenUsageChart sessions={mockSessions} />);
    const chart = screen.getByTestId('bar-chart');
    expect(chart).toHaveAttribute('data-length', '2');
  });
});
