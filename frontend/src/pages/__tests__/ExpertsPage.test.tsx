import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ExpertsPage from '../ExpertsPage';

vi.mock('@/lib/api/experts', () => ({
  getExperts: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { getExperts } from '@/lib/api/experts';
const mockGetExperts = vi.mocked(getExperts);

function renderExpertsPage() {
  return render(
    <MemoryRouter>
      <ExpertsPage />
    </MemoryRouter>,
  );
}

describe('ExpertsPage empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows EmptyState component (not the table) when no experts exist', async () => {
    mockGetExperts.mockResolvedValue([]);
    renderExpertsPage();

    await waitFor(() => {
      expect(screen.queryByText('Loading experts...')).not.toBeInTheDocument();
    });

    // The EmptyState component should be rendered instead of ExpertTable
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    // Table should not be present
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a CTA to create the first expert in empty state', async () => {
    mockGetExperts.mockResolvedValue([]);
    renderExpertsPage();

    await waitFor(() => {
      expect(screen.queryByText('Loading experts...')).not.toBeInTheDocument();
    });

    // The EmptyState CTA button should be present inside the empty-state area
    const emptyState = screen.getByTestId('empty-state');
    const ctaButton = emptyState.querySelector('button');
    expect(ctaButton).not.toBeNull();
    expect(ctaButton!.textContent).toMatch(/create.*expert/i);
  });
});
