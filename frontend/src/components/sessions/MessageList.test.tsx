import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageList } from './MessageList';

vi.mock('./MessageItem', () => ({
  MessageItem: ({ message }: any) => (
    <div data-testid="message-item">{message.content}</div>
  ),
}));

const mockMessages = [
  {
    id: 'msg-1',
    content: 'Hello',
    role: 'assistant',
    expertId: 'exp-1',
    expertName: 'Expert 1',
    sessionId: 'session-1',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'msg-2',
    content: 'World',
    role: 'assistant',
    expertId: 'exp-2',
    expertName: 'Expert 2',
    sessionId: 'session-1',
    createdAt: '2026-01-01T00:01:00Z',
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
