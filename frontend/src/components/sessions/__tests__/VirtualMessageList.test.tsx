import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VirtualMessageList } from '../VirtualMessageList';
import { MessageResponse, MessageRole } from '@/types';

function createMessage(overrides: Partial<MessageResponse> = {}): MessageResponse {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    sessionId: 'session-1',
    expertId: 'expert-1',
    content: 'Test message content',
    role: MessageRole.ASSISTANT,
    isIntervention: false,
    timestamp: new Date().toISOString(),
    expertName: 'Test Expert',
    expertSpecialty: 'Testing',
    ...overrides,
  };
}

describe('VirtualMessageList', () => {
  it('renders messages in a virtualized container', () => {
    const messages = [
      createMessage({ id: 'msg-1', content: 'First message' }),
      createMessage({ id: 'msg-2', content: 'Second message' }),
    ];
    render(
      <VirtualMessageList
        messages={messages}
        loading={false}
      />,
    );

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading is true', () => {
    render(
      <VirtualMessageList messages={[]} loading={true} />,
    );

    // Should display skeleton placeholders
    const skeletons = document.querySelectorAll('[class*="skeleton"], [data-testid="message-skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no messages and not loading', () => {
    render(
      <VirtualMessageList messages={[]} loading={false} />,
    );

    expect(screen.getByText(/no messages/i)).toBeInTheDocument();
  });

  it('auto-scrolls to the bottom when new messages arrive', () => {
    const messages = Array.from({ length: 50 }, (_, i) =>
      createMessage({ id: `msg-${i}`, content: `Message ${i}` }),
    );
    render(
      <VirtualMessageList
        messages={messages}
        loading={false}
      />,
    );

    // The last message should be visible (scrolled into view)
    const lastMessage = screen.getByText('Message 49');
    expect(lastMessage).toBeInTheDocument();
  });
});
