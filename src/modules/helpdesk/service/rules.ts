export const TICKET_STAGES = ['new', 'in_progress', 'waiting', 'solved', 'closed'] as const;
export type TicketStage = (typeof TICKET_STAGES)[number];

export const TICKET_CHANNELS = ['whatsapp', 'phone', 'email', 'walk_in'] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

/** Allowed stage changes. Closed tickets are final. Anything else is refused with CONFLICT. */
export const TICKET_TRANSITIONS: Record<TicketStage, readonly TicketStage[]> = {
  new: ['in_progress', 'waiting', 'solved'],
  in_progress: ['waiting', 'solved'],
  waiting: ['in_progress', 'solved'],
  solved: ['closed', 'in_progress'],
  closed: [],
};

export function canTransition(from: TicketStage, to: TicketStage): boolean {
  return TICKET_TRANSITIONS[from].includes(to);
}

/** Sequence code and format for ticket numbers (TK-{YYYY}-00001), passed to core/sequences. */
export const TICKET_NUMBER_PREFIX = 'TK-{YYYY}-';
export const TICKET_NUMBER_PADDING = 5;
