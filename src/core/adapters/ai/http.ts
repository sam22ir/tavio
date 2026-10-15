import { getCloudflareContext } from '@opennextjs/cloudflare';
import { AiError } from './errors';
import type { AiContent, AiMessage } from './types';

export const AI_TIMEOUT_MS = 60_000;

export type AiEnv = Record<string, string | undefined>;

// Workers bindings win when running on Cloudflare; otherwise process.env. Never log the result.
export function readEnv(): AiEnv {
  const merged: AiEnv = { ...process.env };
  try {
    const cf = getCloudflareContext({ async: false });
    for (const [key, value] of Object.entries(cf.env as Record<string, unknown>)) {
      if (typeof value === 'string') merged[key] = value;
    }
  } catch {
    // Not running on Workers: process.env alone is used.
  }
  return merged;
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch {
    throw new AiError('AI_UNAVAILABLE', 'AI provider request failed');
  }
  if (!res.ok) throw new AiError('AI_UNAVAILABLE', `AI provider responded with status ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new AiError('AI_BAD_RESPONSE', 'AI provider returned a non-JSON body');
  }
}

export function textOf(content: AiContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

export function hasImages(messages: AiMessage[]): boolean {
  return messages.some((m) => typeof m.content !== 'string' && m.content.some((p) => p.type === 'image'));
}
