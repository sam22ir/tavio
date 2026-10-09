import { describe, expect, it } from 'vitest';
import { ticketInput } from '../service/tickets';

describe('ticketInput', () => {
  it('rejects an unknown channel and an empty subject', () => {
    expect(ticketInput.safeParse({ subject: 'Help', channel: 'fax' }).success).toBe(false);
    expect(ticketInput.safeParse({ subject: '   ', channel: 'email' }).success).toBe(false);
  });

  it('defaults priority and blanks optional ids to undefined', () => {
    const parsed = ticketInput.parse({ subject: 'Printer', channel: 'walk_in', partnerId: '', teamId: '' });
    expect(parsed.priority).toBe('normal');
    expect(parsed.partnerId).toBeUndefined();
    expect(parsed.teamId).toBeUndefined();
  });
});
