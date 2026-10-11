// Signed unsubscribe tokens: base64url(payload).base64url(HMAC-SHA256). Pure Web Crypto, runs on Workers and Node.

export interface UnsubscribePayload { c: string; p: string; ch: 'email' | 'whatsapp' }

const DOMAIN = 'tavio:unsubscribe:v1:';
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(DOMAIN + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signUnsubscribe(payload: UnsubscribePayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/** Returns the payload when the signature is valid, else null. Never throws. */
export async function verifyUnsubscribe(token: string, secret: string): Promise<UnsubscribePayload | null> {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlDecode(sig), enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Partial<UnsubscribePayload>;
    if (typeof data.c !== 'string' || typeof data.p !== 'string') return null;
    if (data.ch !== 'email' && data.ch !== 'whatsapp') return null;
    return { c: data.c, p: data.p, ch: data.ch };
  } catch {
    return null;
  }
}

/** Absolute unsubscribe URL for the public route. Pure given base and secret. */
export async function buildUnsubscribeUrl(base: string, payload: UnsubscribePayload, secret: string): Promise<string> {
  const token = await signUnsubscribe(payload, secret);
  return `${base}/api/messaging/unsubscribe?token=${encodeURIComponent(token)}`;
}
