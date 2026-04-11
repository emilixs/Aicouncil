import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title text', () => {
    render(<EmptyState title="No items found" description="Try adjusting your filters" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<EmptyState title="No items" description="Nothing to display here" />);
    expect(screen.getByText('Nothing to display here')).toBeInTheDocument();
  });

  it('renders an icon when provided', () => {
    const TestIcon = () => <svg data-testid="test-icon" />;
    render(
      <EmptyState title="Empty" description="No data" icon={<TestIcon />} />,
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders a CTA button when actionLabel is provided', () => {
    render(
      <EmptyState
        title="No items"
        description="Get started"
        actionLabel="Create New"
        onAction={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Create New' })).toBeInTheDocument();
  });

  it('does not render a CTA button when actionLabel is omitted', () => {
    render(<EmptyState title="No items" description="Nothing here" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onAction callback when CTA button is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <EmptyState
        title="No items"
        description="Get started"
        actionLabel="Create New"
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Create New' }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
