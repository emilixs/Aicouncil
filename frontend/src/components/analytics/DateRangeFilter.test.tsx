import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-04-01' } });
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

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-01-01' } });
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
