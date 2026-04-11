import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionTable } from './SessionTable';
import type { SessionAnalytics } from '@/types/analytics';

const mockSessions: SessionAnalytics[] = [
  {
    sessionId: 'sess-1',
    problemStatement: 'How should we design the auth system?',
    status: 'COMPLETED',
    totalTokens: 5000,
    totalRounds: 3,
    estimatedCostUsd: 0.15,
    consensusReached: true,
    durationMs: 120000,
    createdAt: '2026-04-01T10:00:00Z',
  },
  {
    sessionId: 'sess-2',
    problemStatement: 'What database should we use?',
    status: 'IN_PROGRESS',
    totalTokens: 2000,
    totalRounds: 1,
    estimatedCostUsd: 0.06,
    consensusReached: false,
    durationMs: 30000,
    createdAt: '2026-04-02T14:00:00Z',
  },
];

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('SessionTable', () => {
  it('renders session rows', () => {
    renderWithRouter(<SessionTable sessions={mockSessions} />);
    expect(
      screen.getByText('How should we design the auth system?'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('What database should we use?'),
    ).toBeInTheDocument();
  });

  it('displays session metrics', () => {
    renderWithRouter(<SessionTable sessions={mockSessions} />);
    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getByText('$0.15')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('shows empty state when no sessions', () => {
    renderWithRouter(<SessionTable sessions={[]} />);
    expect(screen.getByText('No session data available')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    renderWithRouter(<SessionTable sessions={mockSessions} />);
    expect(screen.getByText('Problem')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText('Rounds')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Consensus')).toBeInTheDocument();
  });
});
