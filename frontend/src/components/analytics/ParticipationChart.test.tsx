import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParticipationChart } from './ParticipationChart';
import type { ExpertStats } from '@/types/analytics';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="pie" data-length={data.length}>{children}</div>
  ),
  Cell: ({ fill }: { fill: string }) => (
    <div data-testid="cell" data-fill={fill} />
  ),
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

const mockExperts: ExpertStats[] = [
  {
    expertId: 'e1',
    name: 'Alice',
    specialty: 'Backend',
    totalSessions: 10,
    avgTokensPerMessage: 500,
    consensusRate: 0.8,
  },
  {
    expertId: 'e2',
    name: 'Bob',
    specialty: 'Frontend',
    totalSessions: 7,
    avgTokensPerMessage: 400,
    consensusRate: 0.6,
  },
];

describe('ParticipationChart', () => {
  it('renders chart with expert data', () => {
    render(<ParticipationChart experts={mockExperts} />);
    expect(screen.getByText('Expert Participation')).toBeInTheDocument();
    expect(screen.getByTestId('pie')).toHaveAttribute('data-length', '2');
  });

  it('shows empty state when no experts', () => {
    render(<ParticipationChart experts={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('uses CSS variables for cell colors', () => {
    render(<ParticipationChart experts={mockExperts} />);
    const cells = screen.getAllByTestId('cell');
    expect(cells[0]).toHaveAttribute('data-fill', 'hsl(var(--chart-1))');
    expect(cells[1]).toHaveAttribute('data-fill', 'hsl(var(--chart-2))');
  });

  it('renders correct number of cells for experts', () => {
    render(<ParticipationChart experts={mockExperts} />);
    const cells = screen.getAllByTestId('cell');
    expect(cells).toHaveLength(2);
  });
});
