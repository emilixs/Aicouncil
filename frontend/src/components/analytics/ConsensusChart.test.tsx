import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsensusChart } from './ConsensusChart';
import type { ComparisonStats } from '@/types/analytics';

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

const mockComparisons: ComparisonStats[] = [
  {
    expertCombination: ['Alice', 'Bob'],
    sessionCount: 5,
    avgRounds: 3.2,
    consensusRate: 0.8,
    avgTotalTokens: 15000,
  },
  {
    expertCombination: ['Alice', 'Charlie'],
    sessionCount: 3,
    avgRounds: 4.1,
    consensusRate: 0.6,
    avgTotalTokens: 18000,
  },
];

describe('ConsensusChart', () => {
  it('renders chart with comparison data', () => {
    render(<ConsensusChart comparisons={mockComparisons} />);
    expect(screen.getByText('Consensus by Expert Combination')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-length', '2');
  });

  it('shows empty state when no comparisons', () => {
    render(<ConsensusChart comparisons={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('uses CSS variables for bar fill colors', () => {
    render(<ConsensusChart comparisons={mockComparisons} />);
    expect(screen.getByTestId('bar-consensusRate')).toHaveAttribute(
      'data-fill',
      'hsl(var(--chart-2))',
    );
    expect(screen.getByTestId('bar-avgRounds')).toHaveAttribute(
      'data-fill',
      'hsl(var(--chart-1))',
    );
  });

  it('truncates long expert combination labels with ellipsis', () => {
    const longComparisons: ComparisonStats[] = [
      {
        expertCombination: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
        sessionCount: 2,
        avgRounds: 5,
        consensusRate: 0.4,
        avgTotalTokens: 25000,
      },
    ];
    render(<ConsensusChart comparisons={longComparisons} />);
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-length', '1');
  });
});
