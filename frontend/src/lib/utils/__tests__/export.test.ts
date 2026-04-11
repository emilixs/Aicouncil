import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messagesToMarkdown, downloadMarkdown } from '../export';
import { MessageResponse, MessageRole } from '@/types';

function createMessage(overrides: Partial<MessageResponse> = {}): MessageResponse {
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    expertId: 'expert-1',
    content: 'Test message content',
    role: MessageRole.ASSISTANT,
    isIntervention: false,
    timestamp: '2026-04-11T10:00:00Z',
    expertName: 'Dr. Smith',
    expertSpecialty: 'AI Ethics',
    ...overrides,
  };
}

describe('messagesToMarkdown', () => {
  it('produces valid markdown with a header', () => {
    const messages = [createMessage()];
    const result = messagesToMarkdown(messages, 'Test Session');

    expect(result).toContain('# Test Session');
  });

  it('includes session metadata', () => {
    const messages = [createMessage()];
    const result = messagesToMarkdown(messages, 'Test Session');

    expect(result).toMatch(/date/i);
    expect(result).toMatch(/messages.*1/i);
  });

  it('formats each message with expert name and role', () => {
    const messages = [
      createMessage({
        expertName: 'Dr. Smith',
        role: MessageRole.ASSISTANT,
        content: 'My analysis is...',
      }),
    ];
    const result = messagesToMarkdown(messages, 'Session');

    expect(result).toContain('Dr. Smith');
    expect(result).toContain('My analysis is...');
  });

  it('handles intervention messages distinctly', () => {
    const messages = [
      createMessage({
        isIntervention: true,
        role: MessageRole.USER,
        expertName: null,
        content: 'Please focus on safety.',
      }),
    ];
    const result = messagesToMarkdown(messages, 'Session');

    expect(result).toMatch(/intervention/i);
    expect(result).toContain('Please focus on safety.');
  });

  it('handles system messages', () => {
    const messages = [
      createMessage({
        role: MessageRole.SYSTEM,
        expertName: null,
        content: 'Discussion started.',
      }),
    ];
    const result = messagesToMarkdown(messages, 'Session');

    expect(result).toMatch(/system/i);
    expect(result).toContain('Discussion started.');
  });

  it('includes timestamps for each message', () => {
    const messages = [
      createMessage({ timestamp: '2026-04-11T10:30:00Z' }),
    ];
    const result = messagesToMarkdown(messages, 'Session');

    // Should contain some formatted representation of the timestamp
    expect(result).toMatch(/10:30|Apr.*11/);
  });

  it('handles empty message array', () => {
    const result = messagesToMarkdown([], 'Empty Session');
    expect(result).toContain('# Empty Session');
  });
});

describe('downloadMarkdown', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers a file download with .md extension', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.fn();

    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    });

    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
      setAttribute: vi.fn(),
    } as unknown as HTMLAnchorElement);

    downloadMarkdown('# content', 'test-session');

    expect(createElement).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });
});
