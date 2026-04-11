import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverviewCards } from './OverviewCards';
import type { OverviewStats } from '@/types/analytics';

const mockData: OverviewStats = {
  totalSessions: 15,
  completedSessions: 12,
  totalTokens: 125000,
  totalPromptTokens: 75000,
  totalCompletionTokens: 50000,
  estimatedCostUsd: 3.45,
  avgRoundsToConsensus: 4.2,
};

describe('OverviewCards', () => {
  it('renders all overview cards', () => {
    render(<OverviewCards data={mockData} />);
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('Estimated Cost')).toBeInTheDocument();
    expect(screen.getByText('Avg Rounds to Consensus')).toBeInTheDocument();
  });

  it('displays correct values', () => {
    render(<OverviewCards data={mockData} />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('125.0K')).toBeInTheDocument();
    expect(screen.getByText('$3.45')).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument();
  });

  it('formats large numbers with M suffix', () => {
    render(
      <OverviewCards data={{ ...mockData, totalTokens: 2500000 }} />,
    );
    expect(screen.getByText('2.5M')).toBeInTheDocument();
  });

  it('displays small numbers without suffix', () => {
    render(<OverviewCards data={{ ...mockData, totalSessions: 5 }} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
