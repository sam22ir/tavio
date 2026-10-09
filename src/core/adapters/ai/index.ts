// Provider-neutral AI entry point. Features import from here, never from a vendor adapter.
import { createAnthropicProvider } from './anthropic';
import { createMockProvider } from './mock';
import { createOpenAiCompatibleProvider } from './openai-compatible';
import { readEnv, type AiEnv } from './http';
import type { AiProvider } from './types';

export type { AiProvider, AiMessage, AiCompleteOptions, AiResult } from './types';
export { AiError, type AiErrorCode } from './errors';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-5-5';

const KNOWN_PROVIDERS = ['openai-compatible', 'anthropic', 'mock'] as const;

function resolveProviderName(env: AiEnv): string | null {
  const explicit = env.AI_PROVIDER?.trim();
  if (explicit) return explicit;
  return env.AI_API_KEY ? 'openai-compatible' : null;
}

/** Name of the configured provider for usage rows, or 'none'. Never reads the key itself. */
export function currentProviderName(): string {
  return resolveProviderName(readEnv()) ?? 'none';
}

/**
 * Returns the configured provider, or null when AI is not configured (AI_API_KEY unset).
 * Env: AI_PROVIDER ('openai-compatible' | 'anthropic' | 'mock'), AI_BASE_URL (openai-compatible, e.g. https://api.deepseek.com/v1),
 * AI_API_KEY, AI_MODEL, AI_VISION_MODEL (optional).
 */
export function getAi(): AiProvider | null {
  const env = readEnv();
  const name = resolveProviderName(env);
  if (!name || !(KNOWN_PROVIDERS as readonly string[]).includes(name)) return null;
  const visionModel = env.AI_VISION_MODEL?.trim() || undefined;

  if (name === 'mock') {
    return createMockProvider(env.AI_MODEL?.trim() || 'mock-1', Boolean(visionModel));
  }

  const apiKey = env.AI_API_KEY?.trim();
  if (!apiKey) return null;

  if (name === 'anthropic') {
    return createAnthropicProvider({
      apiKey,
      model: env.AI_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
      visionModel,
    });
  }

  return createOpenAiCompatibleProvider({
    baseUrl: env.AI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
    apiKey,
    model: env.AI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    visionModel,
  });
}

function candidatesOf(text: string): string[] {
  const trimmed = text.trim();
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  const span = first !== -1 && last > first ? trimmed.slice(first, last + 1) : '';
  return [trimmed, fenced, span];
}

/** Parses the first JSON object in a model reply; returns null if none is valid. */
export function parseJsonReply<T = unknown>(text: string): T | null {
  for (const candidate of candidatesOf(text)) {
    if (!candidate) continue;
    try {
      const value: unknown = JSON.parse(candidate);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
