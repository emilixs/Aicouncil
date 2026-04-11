import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ExpertFilters } from '../ExpertFilters';

describe('ExpertFilters', () => {
  it('renders a search input', () => {
    render(<ExpertFilters onSearchChange={() => {}} onDriverTypeChange={() => {}} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search input', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<ExpertFilters onSearchChange={onSearchChange} onDriverTypeChange={() => {}} />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'neural');

    expect(onSearchChange).toHaveBeenCalled();
  });

  it('renders a driver type select filter', () => {
    render(<ExpertFilters onSearchChange={() => {}} onDriverTypeChange={() => {}} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onDriverTypeChange when selecting a driver type', async () => {
    const user = userEvent.setup();
    const onDriverTypeChange = vi.fn();
    render(<ExpertFilters onSearchChange={() => {}} onDriverTypeChange={onDriverTypeChange} />);

    const select = screen.getByRole('combobox');
    await user.click(select);

    const option = screen.getByRole('option', { name: /openai/i });
    await user.click(option);

    expect(onDriverTypeChange).toHaveBeenCalledWith('OPENAI');
  });

  it('has an "All" option in driver type filter to reset', async () => {
    const user = userEvent.setup();
    render(<ExpertFilters onSearchChange={() => {}} onDriverTypeChange={() => {}} />);

    const select = screen.getByRole('combobox');
    await user.click(select);

    expect(screen.getByRole('option', { name: /all/i })).toBeInTheDocument();
  });
});
