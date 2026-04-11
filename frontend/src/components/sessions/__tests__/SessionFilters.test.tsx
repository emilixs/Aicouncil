import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SessionFilters } from '../SessionFilters';

describe('SessionFilters', () => {
  it('renders a search input for problem statement', () => {
    render(
      <SessionFilters
        onSearchChange={() => {}}
        onStatusChange={() => {}}
        onSortChange={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in the search input', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      <SessionFilters
        onSearchChange={onSearchChange}
        onStatusChange={() => {}}
        onSortChange={() => {}}
      />,
    );

    await user.type(screen.getByPlaceholderText(/search/i), 'climate');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('renders a status filter select', () => {
    render(
      <SessionFilters
        onSearchChange={() => {}}
        onStatusChange={() => {}}
        onSortChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
  });

  it('calls onStatusChange when selecting a status', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(
      <SessionFilters
        onSearchChange={() => {}}
        onStatusChange={onStatusChange}
        onSortChange={() => {}}
      />,
    );

    const statusSelect = screen.getByLabelText(/status/i);
    await user.click(statusSelect);

    const option = screen.getByRole('option', { name: /active/i });
    await user.click(option);

    expect(onStatusChange).toHaveBeenCalledWith('ACTIVE');
  });

  it('renders a sort select with newest/oldest/status options', async () => {
    const user = userEvent.setup();
    render(
      <SessionFilters
        onSearchChange={() => {}}
        onStatusChange={() => {}}
        onSortChange={() => {}}
      />,
    );

    const sortSelect = screen.getByLabelText(/sort/i);
    await user.click(sortSelect);

    expect(screen.getByRole('option', { name: /newest/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /oldest/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /status/i })).toBeInTheDocument();
  });

  it('calls onSortChange when selecting a sort option', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <SessionFilters
        onSearchChange={() => {}}
        onStatusChange={() => {}}
        onSortChange={onSortChange}
      />,
    );

    const sortSelect = screen.getByLabelText(/sort/i);
    await user.click(sortSelect);

    const option = screen.getByRole('option', { name: /oldest/i });
    await user.click(option);

    expect(onSortChange).toHaveBeenCalledWith('oldest');
  });
});
