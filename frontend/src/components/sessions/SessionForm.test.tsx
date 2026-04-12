import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionForm } from './SessionForm';

// Mock API calls
vi.mock('@/lib/api/experts', () => ({
  getExperts: vi.fn().mockResolvedValue([
    {
      id: 'expert-1',
      name: 'GPT Expert',
      specialty: 'General',
      driverType: 'OPENAI',
      config: { model: 'gpt-5.4-mini' },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'expert-2',
      name: 'Claude Expert',
      specialty: 'Analysis',
      driverType: 'ANTHROPIC',
      config: { model: 'claude-sonnet-4-20250514' },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'expert-3',
      name: 'Grok Expert',
      specialty: 'Creative',
      driverType: 'GROK',
      config: { model: 'grok-4.20-0309-reasoning' },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ]),
}));

vi.mock('@/lib/api/sessions', () => ({
  createSession: vi.fn().mockResolvedValue({ id: 'new-session-id' }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('SessionForm — comparison mode type selector', () => {
  const onSuccess = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render a session type selector with Discussion and Comparison options', async () => {
    render(<SessionForm onSuccess={onSuccess} onCancel={onCancel} />);

    // Wait for experts to load
    await waitFor(() => {
      expect(screen.queryByText('Loading experts...')).not.toBeInTheDocument();
    });

    // Type selector should be present
    expect(screen.getByText(/discussion/i)).toBeInTheDocument();
    expect(screen.getByText(/comparison/i)).toBeInTheDocument();
  });

  it('should default to Discussion mode', async () => {
    render(<SessionForm onSuccess={onSuccess} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading experts...')).not.toBeInTheDocument();
    });

    // Discussion should be selected by default
    const discussionOption = screen.getByText(/discussion/i);
    // The Discussion option should have an active/selected state
    expect(discussionOption.closest('[data-state="on"]') ||
           discussionOption.closest('[aria-checked="true"]') ||
           discussionOption.closest('[aria-pressed="true"]')).toBeTruthy();
  });

  it('should hide maxMessages field when Comparison mode is selected', async () => {
    const user = userEvent.setup();
    render(<SessionForm onSuccess={onSuccess} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading experts...')).not.toBeInTheDocument();
    });

    // maxMessages should be visible in Discussion mode
    expect(screen.getByLabelText(/maximum messages/i)).toBeInTheDocument();

    // Switch to Comparison mode
    const comparisonOption = screen.getByText(/comparison/i);
    await user.click(comparisonOption);

    // maxMessages should be hidden in Comparison mode
    expect(screen.queryByLabelText(/maximum messages/i)).not.toBeInTheDocument();
  });

  it('should show maxMessages field when switching back to Discussion mode', async () => {
    const user = userEvent.setup();
    render(<SessionForm onSuccess={onSuccess} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading experts...')).not.toBeInTheDocument();
    });

    // Switch to Comparison
    await user.click(screen.getByText(/comparison/i));
    expect(screen.queryByLabelText(/maximum messages/i)).not.toBeInTheDocument();

    // Switch back to Discussion
    await user.click(screen.getByText(/discussion/i));
    expect(screen.getByLabelText(/maximum messages/i)).toBeInTheDocument();
  });

  it('should include type in submission payload', async () => {
    const { createSession } = await import('@/lib/api/sessions');
    const user = userEvent.setup();

    render(<SessionForm onSuccess={onSuccess} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading experts...')).not.toBeInTheDocument();
    });

    // Switch to Comparison mode
    await user.click(screen.getByText(/comparison/i));

    // Fill in required fields — problem statement
    const textarea = screen.getByPlaceholderText(/describe|prompt/i);
    await user.type(textarea, 'Compare how different models approach this problem statement for testing');

    // Select 2 experts
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Submit
    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'COMPARISON',
        }),
      );
    });
  });
});
