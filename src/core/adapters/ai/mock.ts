import { textOf } from './http';
import type { AiCompleteOptions, AiMessage, AiProvider, AiResult } from './types';

// Deterministic provider for tests and dev. No network, no key.
export function createMockProvider(model: string, supportsVision: boolean): AiProvider {
  return {
    name: 'mock',
    model,
    supportsVision,
    async complete(messages: AiMessage[], opts: AiCompleteOptions): Promise<AiResult> {
      const text = opts.json ? '{}' : `[mock:${opts.feature}] Mock reply.`;
      const inputChars = messages.reduce((n, m) => n + textOf(m.content).length, 0);
      return {
        text,
        inputTokens: Math.ceil(inputChars / 4),
        outputTokens: Math.ceil(text.length / 4),
        model,
      };
    },
  };
}
