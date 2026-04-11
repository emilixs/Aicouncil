import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsensusChart } from './ConsensusChart';
import type { ComparisonStats } from '@/types/analytics';

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const sampleComparisons: ComparisonStats[] = [
  {
    expertCombination: ['Expert A', 'Expert B'],
    sessionCount: 5,
    avgRounds: 3.4,
    consensusRate: 0.8,
    avgTotalTokens: 15000,
  },
  {
    expertCombination: ['Expert A', 'Expert C'],
    sessionCount: 3,
    avgRounds: 4.1,
    consensusRate: 0.67,
    avgTotalTokens: 18000,
  },
];

describe('ConsensusChart', () => {
  it('renders empty state when no comparisons', () => {
    render(<ConsensusChart comparisons={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders the card title', () => {
    render(<ConsensusChart comparisons={sampleComparisons} />);
    expect(screen.getByText('Consensus by Expert Combination')).toBeInTheDocument();
  });

  it('renders chart container with sample data', () => {
    const { container } = render(<ConsensusChart comparisons={sampleComparisons} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});
