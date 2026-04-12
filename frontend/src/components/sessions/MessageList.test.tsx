import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from './MessageList';
import { MessageRole } from '@/types';

vi.mock('./MessageItem', () => ({
  MessageItem: ({ message }: { message: { content: string } }) => (
    <div data-testid="message-item">{message.content}</div>
  ),
}));

const mockMessages = [
  {
    id: 'msg-1',
    content: 'Hello',
    role: MessageRole.ASSISTANT,
    expertId: 'exp-1',
    expertName: 'Expert 1',
    expertSpecialty: 'Testing',
    sessionId: 'session-1',
    isIntervention: false,
    timestamp: '2026-01-01T00:00:00Z',
  },
  {
    id: 'msg-2',
    content: 'World',
    role: MessageRole.ASSISTANT,
    expertId: 'exp-2',
    expertName: 'Expert 2',
    expertSpecialty: 'Testing',
    sessionId: 'session-1',
    isIntervention: false,
    timestamp: '2026-01-01T00:01:00Z',
  },
];

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeletons when loading=true', () => {
    const { container } = render(
      <MessageList messages={[]} consensusReached={false} loading={true} />,
    );

    // Skeleton elements render as divs with animate-pulse class
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when messages=[] and loading=false', () => {
    render(<MessageList messages={[]} consensusReached={false} loading={false} />);

    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('renders message items for each message', () => {
    render(
      <MessageList messages={mockMessages} consensusReached={false} loading={false} />,
    );

    const items = screen.getAllByTestId('message-item');
    expect(items).toHaveLength(mockMessages.length);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('shows consensus alert when consensusReached=true', () => {
    render(
      <MessageList messages={mockMessages} consensusReached={true} loading={false} />,
    );

    expect(screen.getByText(/consensus reached/i)).toBeInTheDocument();
  });

  it('does not show consensus alert when consensusReached=false', () => {
    render(
      <MessageList messages={mockMessages} consensusReached={false} loading={false} />,
    );

    expect(screen.queryByText(/consensus reached/i)).not.toBeInTheDocument();
  });
});
