import { z } from 'zod';

/** Algerian mobile or landline numbers, with +213, 00213 or a leading 0. Spaces, dots and dashes are ignored. */
const PHONE = /^(\+213|00213|0)[1-9][0-9]{7,8}$/;

/** Request types offered in the contact form. `?type=` in the URL preselects one of them. */
export const CONTACT_TYPES = ['audit', 'demo', 'services', 'other'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const contactSchema = z.object({
  type: z.enum(CONTACT_TYPES).default('other'),
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().max(150).optional().default(''),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s.-]/g, ''))
    .pipe(z.string().regex(PHONE)),
  email: z.email().max(254),
  wilaya: z.string().trim().min(2).max(60),
  message: z.string().trim().min(10).max(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Name of the hidden honeypot field. Bots tend to fill every input, humans never see this one. */
export const HONEYPOT_FIELD = 'website';
