import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ExportButton } from '../ExportButton';
import { MessageResponse, MessageRole } from '@/types';

function createMessage(overrides: Partial<MessageResponse> = {}): MessageResponse {
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    expertId: 'expert-1',
    content: 'Test content',
    role: MessageRole.ASSISTANT,
    isIntervention: false,
    timestamp: new Date().toISOString(),
    expertName: 'Expert',
    expertSpecialty: 'Testing',
    ...overrides,
  };
}

describe('ExportButton', () => {
  it('renders a button with export text', () => {
    render(<ExportButton messages={[]} sessionTitle="Test" />);
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('is disabled when there are no messages', () => {
    render(<ExportButton messages={[]} sessionTitle="Test" />);
    expect(screen.getByRole('button', { name: /export/i })).toBeDisabled();
  });

  it('is enabled when messages are present', () => {
    const messages = [createMessage()];
    render(<ExportButton messages={messages} sessionTitle="Test" />);
    expect(screen.getByRole('button', { name: /export/i })).toBeEnabled();
  });

  it('triggers export on click', async () => {
    const user = userEvent.setup();
    const messages = [createMessage()];

    // Mock the download utility
    vi.mock('@/lib/utils/export', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/utils/export')>();
      return {
        ...actual,
        downloadMarkdown: vi.fn(),
      };
    });

    render(<ExportButton messages={messages} sessionTitle="Test Session" />);
    const button = screen.getByRole('button', { name: /export/i });
    await user.click(button);

    // The export should have been triggered (downloadMarkdown called)
    const { downloadMarkdown } = await import('@/lib/utils/export');
    expect(downloadMarkdown).toHaveBeenCalled();
  });
});
