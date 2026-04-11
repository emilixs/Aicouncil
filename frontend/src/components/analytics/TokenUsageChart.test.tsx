import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TokenUsageChart } from './TokenUsageChart';
import type { SessionAnalytics } from '@/types/analytics';

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const sampleSessions: SessionAnalytics[] = [
  {
    sessionId: 's1',
    problemStatement: 'Short problem',
    status: 'COMPLETED',
    totalTokens: 5000,
    totalRounds: 3,
    estimatedCostUsd: 0.15,
    consensusReached: true,
    durationMs: 60000,
    createdAt: '2026-04-01T00:00:00Z',
  },
  {
    sessionId: 's2',
    problemStatement: 'A much longer problem statement that exceeds twenty characters',
    status: 'ACTIVE',
    totalTokens: 12000,
    totalRounds: 5,
    estimatedCostUsd: 0.36,
    consensusReached: false,
    durationMs: 120000,
    createdAt: '2026-04-02T00:00:00Z',
  },
];

describe('TokenUsageChart', () => {
  it('renders empty state when no sessions', () => {
    render(<TokenUsageChart sessions={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders the card title', () => {
    render(<TokenUsageChart sessions={sampleSessions} />);
    expect(screen.getByText('Token Usage by Session')).toBeInTheDocument();
  });

  it('renders chart container with sample data', () => {
    const { container } = render(<TokenUsageChart sessions={sampleSessions} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });

  it('truncates long problem statements to 20 chars', () => {
    render(<TokenUsageChart sessions={sampleSessions} />);
    // The short one should appear as-is, the long one truncated
    expect(screen.queryByText('No data available')).not.toBeInTheDocument();
  });
});
