import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../MessageList';
import { MessageRole } from '@/types';
import type { MessageResponse } from '@/types';

vi.mock('react-markdown', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/lib/utils/date', () => ({ formatMessageTimestamp: (ts: string) => ts }));

const makeMessage = (overrides: Partial<MessageResponse> = {}): MessageResponse => ({
  id: 'msg-1',
  sessionId: 'session-1',
  expertId: 'expert-1',
  content: 'Test message content',
  role: MessageRole.ASSISTANT,
  isIntervention: false,
  timestamp: '2024-01-01T00:00:00Z',
  expertName: 'Expert Alice',
  expertSpecialty: 'Engineering',
  ...overrides,
});

describe('MessageList', () => {
  it('shows loading skeletons when loading=true', () => {
    const { container } = render(
      <MessageList messages={[]} consensusReached={false} loading={true} />
    );
    const skeletons = container.querySelectorAll('[class*="skeleton"], [data-testid="skeleton"]');
    expect(container.querySelector('.space-y-3')).toBeInTheDocument();
  });

  it('shows empty state when messages=[] and loading=false', () => {
    render(<MessageList messages={[]} consensusReached={false} loading={false} />);
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByText('Start the discussion to see expert messages')).toBeInTheDocument();
  });

  it('renders messages when provided', () => {
    const messages = [makeMessage()];
    render(<MessageList messages={messages} consensusReached={false} loading={false} />);
    expect(screen.getByText('Test message content')).toBeInTheDocument();
  });

  it('shows consensus alert when consensusReached=true', () => {
    const messages = [makeMessage()];
    render(<MessageList messages={messages} consensusReached={true} loading={false} />);
    expect(screen.getByText('Consensus Reached')).toBeInTheDocument();
  });

  it('does not show consensus alert when consensusReached=false', () => {
    const messages = [makeMessage()];
    render(<MessageList messages={messages} consensusReached={false} loading={false} />);
    expect(screen.queryByText('Consensus Reached')).not.toBeInTheDocument();
  });

  it('renders intervention messages with "You" sender name', () => {
    const messages = [makeMessage({ isIntervention: true, expertName: null })];
    render(<MessageList messages={messages} consensusReached={false} loading={false} />);
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('identifies consensus messages by id starting with "consensus-"', () => {
    const messages = [
      makeMessage({ id: 'consensus-1', content: 'Consensus message content' }),
    ];
    render(<MessageList messages={messages} consensusReached={false} loading={false} />);
    expect(screen.getByText('Consensus message content')).toBeInTheDocument();
    expect(screen.getByText('Consensus')).toBeInTheDocument();
  });
});
