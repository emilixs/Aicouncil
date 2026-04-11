import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from './use-websocket';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
};

vi.mock('@/lib/socket', () => ({
  createSocketConnection: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
}));

vi.mock('@/lib/api/sessions', () => ({
  getSessionToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
}));

describe('useWebSocket — comparison events', () => {
  const sessionId = 'test-session-id';

  // Helper to simulate socket events
  const getEventHandler = (eventName: string) => {
    const call = mockSocket.on.mock.calls.find(([name]: [string]) => name === eventName);
    return call ? call[1] : undefined;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle comparison-response events by adding messages to state', async () => {
    const { result } = renderHook(() => useWebSocket(sessionId));

    // Wait for socket initialization
    await vi.waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    const handler = getEventHandler('comparison-response');
    expect(handler).toBeDefined();

    const comparisonMessage = {
      id: 'msg-1',
      sessionId,
      expertId: 'expert-1',
      content: 'Expert comparison response',
      role: 'ASSISTANT',
      isIntervention: false,
      timestamp: new Date().toISOString(),
      expertName: 'GPT Expert',
      expertSpecialty: 'Backend',
      durationMs: 1200,
      tokenCount: 300,
      modelUsed: 'gpt-4',
    };

    act(() => {
      handler({
        sessionId,
        message: comparisonMessage,
        completedCount: 1,
        totalExperts: 2,
      });
    });

    // Message should be added to the messages array
    expect(result.current.messages).toContainEqual(
      expect.objectContaining({
        id: 'msg-1',
        content: 'Expert comparison response',
      }),
    );
  });

  it('should handle comparison-complete events by marking session as complete', async () => {
    const { result } = renderHook(() => useWebSocket(sessionId));

    await vi.waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    const handler = getEventHandler('comparison-complete');
    expect(handler).toBeDefined();

    act(() => {
      handler({
        sessionId,
        messages: [],
        totalDurationMs: 3500,
      });
    });

    // Session should no longer be active
    expect(result.current.isDiscussionActive).toBe(false);
  });

  it('should handle comparison-error events for individual expert failures', async () => {
    const { result } = renderHook(() => useWebSocket(sessionId));

    await vi.waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    const handler = getEventHandler('comparison-error');
    expect(handler).toBeDefined();

    act(() => {
      handler({
        sessionId,
        expertId: 'expert-2',
        expertName: 'Claude Expert',
        error: 'API key invalid',
      });
    });

    // Error state should be set
    expect(result.current.error).toBeTruthy();
  });

  it('should handle comparison-started events', async () => {
    const { result } = renderHook(() => useWebSocket(sessionId));

    await vi.waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    const handler = getEventHandler('comparison-started');
    expect(handler).toBeDefined();

    act(() => {
      handler();
    });

    expect(result.current.isDiscussionActive).toBe(true);
  });
});
