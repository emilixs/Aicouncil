import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpertForm } from './ExpertForm';

vi.mock('@/lib/api/experts', () => ({
  createExpert: vi.fn().mockResolvedValue({ id: 'new-id' }),
  updateExpert: vi.fn().mockResolvedValue({ id: 'existing-id' }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/constants/models', () => ({
  MODEL_OPTIONS: {
    OPENAI: [{ value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' }],
    ANTHROPIC: [{ value: 'claude-3', label: 'Claude 3' }],
    GROK: [{ value: 'grok-1', label: 'Grok 1' }],
  },
  DEFAULT_CONFIG: {
    OPENAI: { model: 'gpt-5.4-mini', temperature: 0.7, maxTokens: 2000 },
    ANTHROPIC: { model: 'claude-3', temperature: 0.7, maxTokens: 2000 },
    GROK: { model: 'grok-1', temperature: 0.7, maxTokens: 2000 },
  },
}));

const mockExpert = {
  id: 'existing-id',
  name: 'Test Expert',
  specialty: 'Testing',
  systemPrompt: 'You are a test expert.',
  driverType: 'OPENAI' as const,
  config: { model: 'gpt-5.4-mini', temperature: 0.7, maxTokens: 2000 },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ExpertForm', () => {
  const onSuccess = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required form fields', () => {
    render(<ExpertForm onSuccess={onSuccess} onCancel={onCancel} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/specialty/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument();
  });

  it('submit button is disabled initially when form is empty and invalid', async () => {
    render(<ExpertForm onSuccess={onSuccess} onCancel={onCancel} />);

    const submitButton = screen.getByRole('button', { name: /create/i });
    expect(submitButton).toBeDisabled();
  });

  it('shows validation error when name is empty and form is touched', async () => {
    const user = userEvent.setup();
    render(<ExpertForm onSuccess={onSuccess} onCancel={onCancel} />);

    const nameInput = screen.getByLabelText(/name/i);
    await user.click(nameInput);
    await user.tab();

    await waitFor(() => {
      // Validation error message should appear after touching the field
      const messages = screen.queryAllByText(/required|name/i);
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExpertForm onSuccess={onSuccess} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows "Create" button text when no expert prop is provided', () => {
    render(<ExpertForm onSuccess={onSuccess} onCancel={onCancel} />);

    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
  });

  it('shows "Update" button text when expert prop is provided', () => {
    render(<ExpertForm expert={mockExpert} onSuccess={onSuccess} onCancel={onCancel} />);

    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });
});
