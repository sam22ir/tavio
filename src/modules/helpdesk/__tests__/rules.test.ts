import { describe, expect, it } from 'vitest';
import { TICKET_STAGES, canTransition, type TicketStage } from '../service/rules';

describe('ticket stage transitions', () => {
  it('allows the documented workflow moves', () => {
    expect(canTransition('new', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'waiting')).toBe(true);
    expect(canTransition('waiting', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'solved')).toBe(true);
    expect(canTransition('solved', 'closed')).toBe(true);
    expect(canTransition('solved', 'in_progress')).toBe(true);
  });

  it('refuses skipped and backwards moves', () => {
    expect(canTransition('new', 'closed')).toBe(false);
    expect(canTransition('closed', 'new')).toBe(false);
    expect(canTransition('closed', 'in_progress')).toBe(false);
    expect(canTransition('waiting', 'new')).toBe(false);
  });

  it('never allows a move onto the same stage', () => {
    for (const stage of TICKET_STAGES) {
      expect(canTransition(stage as TicketStage, stage as TicketStage)).toBe(false);
    }
  });
});
