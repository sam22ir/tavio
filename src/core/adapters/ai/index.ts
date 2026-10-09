// STUB owned by W6-C. Signatures are frozen.
import type { AiProvider } from './types';
export type { AiProvider, AiMessage, AiCompleteOptions, AiResult } from './types';
/**
 * Returns the configured provider, or null when AI is not configured (AI_API_KEY unset).
 * Env: AI_PROVIDER ('openai-compatible' | 'anthropic' | 'mock'), AI_BASE_URL (openai-compatible, e.g. https://api.deepseek.com/v1),
 * AI_API_KEY, AI_MODEL, AI_VISION_MODEL (optional).
 */
export function getAi(): AiProvider | null { throw new Error('not implemented'); }
/** Parses the first JSON object in a model reply; returns null if none is valid. */
export function parseJsonReply<T = unknown>(_text: string): T | null { throw new Error('not implemented'); }
