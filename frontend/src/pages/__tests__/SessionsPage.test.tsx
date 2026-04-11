import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SessionsPage from '../SessionsPage';

vi.mock('@/lib/api/sessions', () => ({
  getSessions: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { getSessions } from '@/lib/api/sessions';
const mockGetSessions = vi.mocked(getSessions);

function renderSessionsPage() {
  return render(
    <MemoryRouter>
      <SessionsPage />
    </MemoryRouter>,
  );
}

describe('SessionsPage empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows EmptyState component when no sessions exist', async () => {
    mockGetSessions.mockResolvedValue([]);
    renderSessionsPage();

    await waitFor(() => {
      // Wait for loading to finish (skeleton gone)
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Should use the reusable EmptyState component (identifiable by data-testid)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows a CTA to create the first session in empty state', async () => {
    mockGetSessions.mockResolvedValue([]);
    renderSessionsPage();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // The EmptyState CTA should exist inside the empty-state area
    const emptyState = screen.getByTestId('empty-state');
    const ctaButton = emptyState.querySelector('button');
    expect(ctaButton).not.toBeNull();
    expect(ctaButton!.textContent).toMatch(/create.*session/i);
  });
});
