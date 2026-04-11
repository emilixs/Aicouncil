import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParticipationChart } from './ParticipationChart';
import type { ExpertStats } from '@/types/analytics';

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const sampleExperts: ExpertStats[] = [
  {
    expertId: 'e1',
    name: 'Security Expert',
    specialty: 'Security',
    totalSessions: 10,
    avgTokensPerMessage: 500,
    consensusRate: 0.8,
  },
  {
    expertId: 'e2',
    name: 'Performance Expert',
    specialty: 'Performance',
    totalSessions: 7,
    avgTokensPerMessage: 400,
    consensusRate: 0.6,
  },
];

describe('ParticipationChart', () => {
  it('renders empty state when no experts', () => {
    render(<ParticipationChart experts={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders the card title', () => {
    render(<ParticipationChart experts={sampleExperts} />);
    expect(screen.getByText('Expert Participation')).toBeInTheDocument();
  });

  it('renders chart container with sample data', () => {
    const { container } = render(<ParticipationChart experts={sampleExperts} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});
