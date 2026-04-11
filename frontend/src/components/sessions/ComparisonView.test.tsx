import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComparisonView } from './ComparisonView';
import type { SessionResponse, MessageResponse } from '@/types/session';
import { MessageRole } from '@/types/session';
import { DriverType } from '@/types/expert';

describe('ComparisonView', () => {
  const mockSession: SessionResponse = {
    id: 'session-1',
    problemStatement: 'How should we design the API?',
    statusDisplay: 'active',
    maxMessages: 20,
    consensusReached: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    experts: [
      {
        id: 'expert-1',
        name: 'GPT Expert',
        specialty: 'Backend',
        systemPrompt: 'You are a backend expert.',
        driverType: DriverType.OPENAI,
        config: { model: 'gpt-4' },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'expert-2',
        name: 'Claude Expert',
        specialty: 'Architecture',
        systemPrompt: 'You are an architecture expert.',
        driverType: DriverType.ANTHROPIC,
        config: { model: 'claude-sonnet-4-20250514' },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ],
  };

  const makeMessage = (overrides: Partial<MessageResponse> = {}): MessageResponse => ({
    id: 'msg-1',
    sessionId: 'session-1',
    expertId: 'expert-1',
    content: 'This is my analysis of the API design.',
    role: MessageRole.ASSISTANT,
    isIntervention: false,
    timestamp: '2025-01-01T00:00:01Z',
    expertName: 'GPT Expert',
    expertSpecialty: 'Backend',
    // New metric fields for comparison mode
    durationMs: 1500,
    tokenCount: 300,
    modelUsed: 'gpt-4',
    ...overrides,
  });

  it('should render a column for each expert', () => {
    const messages = [
      makeMessage({
        id: 'msg-1',
        expertId: 'expert-1',
        expertName: 'GPT Expert',
        content: 'GPT response here.',
        durationMs: 1200,
        tokenCount: 250,
        modelUsed: 'gpt-4',
      }),
      makeMessage({
        id: 'msg-2',
        expertId: 'expert-2',
        expertName: 'Claude Expert',
        content: 'Claude response here.',
        durationMs: 800,
        tokenCount: 180,
        modelUsed: 'claude-sonnet-4-20250514',
      }),
    ];

    render(
      <ComparisonView
        session={mockSession}
        messages={messages}
        isConnected={true}
      />,
    );

    // Each expert should have a column with their name (also in summary table)
    expect(screen.getAllByText('GPT Expert').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Claude Expert').length).toBeGreaterThanOrEqual(1);

    // Each expert's response content should be displayed
    expect(screen.getByText(/GPT response here/)).toBeInTheDocument();
    expect(screen.getByText(/Claude response here/)).toBeInTheDocument();
  });

  it('should display metrics (duration, token count, model) for each expert', () => {
    const messages = [
      makeMessage({
        id: 'msg-1',
        expertId: 'expert-1',
        expertName: 'GPT Expert',
        durationMs: 1500,
        tokenCount: 300,
        modelUsed: 'gpt-4',
      }),
      makeMessage({
        id: 'msg-2',
        expertId: 'expert-2',
        expertName: 'Claude Expert',
        durationMs: 950,
        tokenCount: 220,
        modelUsed: 'claude-sonnet-4-20250514',
      }),
    ];

    render(
      <ComparisonView
        session={mockSession}
        messages={messages}
        isConnected={true}
      />,
    );

    // Duration should be displayed (in card metrics and summary table)
    expect(screen.getAllByText(/1\.5s|1500/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/0\.95s|950/).length).toBeGreaterThanOrEqual(1);

    // Token counts should be displayed
    expect(screen.getAllByText(/300/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/220/).length).toBeGreaterThanOrEqual(1);

    // Model names should be displayed
    expect(screen.getAllByText(/gpt-4/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/claude-sonnet-4-20250514/).length).toBeGreaterThanOrEqual(1);
  });

  it('should show loading spinners for experts without responses yet', () => {
    // No messages yet — all experts should show loading state
    render(
      <ComparisonView
        session={mockSession}
        messages={[]}
        isConnected={true}
      />,
    );

    // Both expert columns should show some loading indicator
    // (Skeleton, Spinner, or loading text)
    const loadingIndicators = screen.getAllByTestId('expert-loading') ||
      screen.getAllByRole('status') ||
      document.querySelectorAll('[data-loading="true"]');
    expect(loadingIndicators.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle 3+ expert layouts', () => {
    const threeExpertSession = {
      ...mockSession,
      experts: [
        ...mockSession.experts,
        {
          id: 'expert-3',
          name: 'Grok Expert',
          specialty: 'Creative',
          systemPrompt: 'You are a creative expert.',
          driverType: DriverType.GROK,
          config: { model: 'grok-2' },
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const messages = [
      makeMessage({
        id: 'msg-1',
        expertId: 'expert-1',
        expertName: 'GPT Expert',
        content: 'GPT analysis.',
      }),
      makeMessage({
        id: 'msg-2',
        expertId: 'expert-2',
        expertName: 'Claude Expert',
        content: 'Claude analysis.',
      }),
      makeMessage({
        id: 'msg-3',
        expertId: 'expert-3',
        expertName: 'Grok Expert',
        content: 'Grok analysis.',
      }),
    ];

    render(
      <ComparisonView
        session={threeExpertSession}
        messages={messages}
        isConnected={true}
      />,
    );

    // All three experts should be rendered (also in summary table)
    expect(screen.getAllByText('GPT Expert').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Claude Expert').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Grok Expert').length).toBeGreaterThanOrEqual(1);
  });
});
