// Outbound message channels. Email sends through Resend (core/adapters/email). WhatsApp is manual for now.
import { sendEmail } from '@/core/adapters/email';

export type ChannelId = 'email' | 'whatsapp';

export interface OutboundMessage {
  /** Email address for email, E.164 phone for whatsapp. */
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult =
  | { status: 'sent'; providerId?: string }
  | { status: 'failed'; error: string }
  | { status: 'manual'; url: string };

export interface MessageChannel {
  readonly id: ChannelId;
  send(message: OutboundMessage): Promise<SendResult>;
}

/** wa.me link with the message text prefilled. The phone keeps digits only. */
export function waMeUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export const emailChannel: MessageChannel = {
  id: 'email',
  async send(message) {
    const res = await sendEmail({ to: message.to, subject: message.subject, html: message.html, text: message.text });
    if (res.sent) return { status: 'sent', providerId: res.id };
    return { status: 'failed', error: res.error ?? 'Email provider is not configured' };
  },
};

/**
 * WhatsApp channel stub. Today it only returns the wa.me link, which the user opens and sends by hand.
 * TODO(whatsapp-cloud-api): replace send() with a WhatsApp Cloud API template message. Keep the id and the signature.
 */
export const whatsappChannel: MessageChannel = {
  id: 'whatsapp',
  async send(message) {
    return { status: 'manual', url: waMeUrl(message.to, message.text) };
  },
};

const CHANNELS: Record<ChannelId, MessageChannel> = { email: emailChannel, whatsapp: whatsappChannel };

export function channelFor(id: string): MessageChannel | null {
  return (CHANNELS as Record<string, MessageChannel | undefined>)[id] ?? null;
}
