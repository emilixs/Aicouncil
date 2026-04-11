import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ComparisonView } from './ComparisonView';
import type { SessionResponse, MessageResponse } from '@/types/session';

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
        driverType: 'OPENAI',
        config: { model: 'gpt-4' },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'expert-2',
        name: 'Claude Expert',
        specialty: 'Architecture',
        driverType: 'ANTHROPIC',
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
    role: 'ASSISTANT' as any,
    isIntervention: false,
    timestamp: '2025-01-01T00:00:01Z',
    expertName: 'GPT Expert',
    expertSpecialty: 'Backend',
    // New metric fields for comparison mode
    durationMs: 1500,
    tokenCount: 300,
    modelUsed: 'gpt-4',
    ...overrides,
  } as any);

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
      } as any),
      makeMessage({
        id: 'msg-2',
        expertId: 'expert-2',
        expertName: 'Claude Expert',
        content: 'Claude response here.',
        durationMs: 800,
        tokenCount: 180,
        modelUsed: 'claude-sonnet-4-20250514',
      } as any),
    ];

    render(
      <ComparisonView
        session={mockSession}
        messages={messages}
        isConnected={true}
      />,
    );

    // Each expert should have a column with their name
    expect(screen.getByText('GPT Expert')).toBeInTheDocument();
    expect(screen.getByText('Claude Expert')).toBeInTheDocument();

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
      } as any),
      makeMessage({
        id: 'msg-2',
        expertId: 'expert-2',
        expertName: 'Claude Expert',
        durationMs: 950,
        tokenCount: 220,
        modelUsed: 'claude-sonnet-4-20250514',
      } as any),
    ];

    render(
      <ComparisonView
        session={mockSession}
        messages={messages}
        isConnected={true}
      />,
    );

    // Duration should be displayed (e.g., "1.5s" or "1500ms")
    expect(screen.getByText(/1\.5s|1500/)).toBeInTheDocument();
    expect(screen.getByText(/0\.95s|950/)).toBeInTheDocument();

    // Token counts should be displayed
    expect(screen.getByText(/300/)).toBeInTheDocument();
    expect(screen.getByText(/220/)).toBeInTheDocument();

    // Model names should be displayed
    expect(screen.getByText(/gpt-4/)).toBeInTheDocument();
    expect(screen.getByText(/claude-sonnet-4-20250514/)).toBeInTheDocument();
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
          driverType: 'GROK',
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
      } as any),
      makeMessage({
        id: 'msg-2',
        expertId: 'expert-2',
        expertName: 'Claude Expert',
        content: 'Claude analysis.',
      } as any),
      makeMessage({
        id: 'msg-3',
        expertId: 'expert-3',
        expertName: 'Grok Expert',
        content: 'Grok analysis.',
      } as any),
    ];

    render(
      <ComparisonView
        session={threeExpertSession}
        messages={messages}
        isConnected={true}
      />,
    );

    // All three experts should be rendered
    expect(screen.getByText('GPT Expert')).toBeInTheDocument();
    expect(screen.getByText('Claude Expert')).toBeInTheDocument();
    expect(screen.getByText('Grok Expert')).toBeInTheDocument();
  });
});
