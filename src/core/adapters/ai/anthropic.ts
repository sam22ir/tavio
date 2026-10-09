import { z } from 'zod';
import { AiError } from './errors';
import { hasImages, postJson, textOf } from './http';
import type { AiCompleteOptions, AiContent, AiMessage, AiProvider, AiResult } from './types';

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  visionModel?: string;
}

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

function toAnthropicContent(content: AiContent): string | AnthropicBlock[] {
  if (typeof content === 'string') return content;
  return content.map((p): AnthropicBlock =>
    p.type === 'text'
      ? { type: 'text', text: p.text }
      : { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.dataBase64 } },
  );
}

const responseSchema = z.object({
  model: z.string().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  usage: z
    .object({ input_tokens: z.number().int().nonnegative().optional(), output_tokens: z.number().int().nonnegative().optional() })
    .optional(),
});

export function createAnthropicProvider(config: AnthropicConfig): AiProvider {
  return {
    name: 'anthropic',
    model: config.model,
    supportsVision: true,
    async complete(messages: AiMessage[], opts: AiCompleteOptions): Promise<AiResult> {
      const model = hasImages(messages) && config.visionModel ? config.visionModel : config.model;
      const systemText = messages
        .filter((m) => m.role === 'system')
        .map((m) => textOf(m.content))
        .join('\n\n');
      const system = [systemText, opts.json ? 'Reply with a single JSON object only.' : '']
        .filter((s) => s.length > 0)
        .join('\n\n');
      const body = {
        model,
        max_tokens: opts.maxTokens ?? 800,
        temperature: opts.temperature ?? 0.2,
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
        ...(system ? { system } : {}),
      };
      const raw = await postJson(
        ENDPOINT,
        { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
        body,
      );
      const parsed = responseSchema.safeParse(raw);
      const text = parsed.success
        ? parsed.data.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text ?? '')
            .join('')
        : '';
      if (!parsed.success || text.length === 0) {
        throw new AiError('AI_BAD_RESPONSE', 'AI provider reply has no text content');
      }
      return {
        text,
        inputTokens: parsed.data.usage?.input_tokens ?? 0,
        outputTokens: parsed.data.usage?.output_tokens ?? 0,
        model: parsed.data.model ?? model,
      };
    },
  };
}
