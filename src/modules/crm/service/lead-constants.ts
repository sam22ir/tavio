export const LEAD_CHANNELS = ['phone', 'whatsapp', 'showroom', 'web', 'referral', 'other'] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];
