/**
 * Tests that ExpertTurnStartEvent includes injectedMemoryIds field.
 */
import { ExpertTurnStartEvent } from './discussion.events';

describe('ExpertTurnStartEvent', () => {
  it('should include injectedMemoryIds field', () => {
    const event: ExpertTurnStartEvent = {
      sessionId: 'sess1',
      expertId: 'exp1',
      expertName: 'Expert 1',
      turnNumber: 1,
      injectedMemoryIds: ['mem1', 'mem2'],
    };

    expect(event.injectedMemoryIds).toEqual(['mem1', 'mem2']);
  });

  it('should allow empty injectedMemoryIds', () => {
    const event: ExpertTurnStartEvent = {
      sessionId: 'sess1',
      expertId: 'exp1',
      expertName: 'Expert 1',
      turnNumber: 1,
      injectedMemoryIds: [],
    };

    expect(event.injectedMemoryIds).toEqual([]);
  });
});
