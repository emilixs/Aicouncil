import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeFilter } from './DateRangeFilter';

describe('DateRangeFilter', () => {
  it('renders date inputs and apply button', () => {
    render(<DateRangeFilter onFilter={vi.fn()} />);
    expect(screen.getByLabelText('From date')).toBeInTheDocument();
    expect(screen.getByLabelText('To date')).toBeInTheDocument();
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('calls onFilter with date values when apply is clicked', async () => {
    const onFilter = vi.fn();
    render(<DateRangeFilter onFilter={onFilter} />);
    const user = userEvent.setup();

    const fromInput = screen.getByLabelText('From date');
    const toInput = screen.getByLabelText('To date');

    await user.type(fromInput, '2026-01-01');
    await user.type(toInput, '2026-04-01');
    await user.click(screen.getByText('Apply'));

    expect(onFilter).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-04-01',
    });
  });

  it('calls onFilter with empty object when clear is clicked', async () => {
    const onFilter = vi.fn();
    render(<DateRangeFilter onFilter={onFilter} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('From date'), '2026-01-01');
    await user.click(screen.getByText('Apply'));

    // Clear button should appear after setting a value
    await user.click(screen.getByText('Clear'));
    expect(onFilter).toHaveBeenLastCalledWith({});
  });

  it('does not show clear button when no dates are set', () => {
    render(<DateRangeFilter onFilter={vi.fn()} />);
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });
});
