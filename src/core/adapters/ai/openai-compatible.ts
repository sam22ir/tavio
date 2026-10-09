import { z } from 'zod';
import { AiError } from './errors';
import { hasImages, postJson } from './http';
import type { AiContent, AiMessage, AiProvider, AiResult, AiCompleteOptions } from './types';

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel?: string;
}

type OpenAiPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

function toOpenAiContent(content: AiContent): string | OpenAiPart[] {
  if (typeof content === 'string') return content;
  return content.map((p): OpenAiPart =>
    p.type === 'text'
      ? { type: 'text', text: p.text }
      : { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.dataBase64}` } },
  );
}

const responseSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z
    .object({ prompt_tokens: z.number().int().nonnegative().optional(), completion_tokens: z.number().int().nonnegative().optional() })
    .optional(),
});

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): AiProvider {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  return {
    name: 'openai-compatible',
    model: config.model,
    supportsVision: Boolean(config.visionModel),
    async complete(messages: AiMessage[], opts: AiCompleteOptions): Promise<AiResult> {
      const model = hasImages(messages) && config.visionModel ? config.visionModel : config.model;
      const body = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: toOpenAiContent(m.content) })),
        max_tokens: opts.maxTokens ?? 800,
        temperature: opts.temperature ?? 0.2,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      };
      const raw = await postJson(`${baseUrl}/chat/completions`, { authorization: `Bearer ${config.apiKey}` }, body);
      const parsed = responseSchema.safeParse(raw);
      const text = parsed.success ? parsed.data.choices[0]?.message.content ?? '' : '';
      if (!parsed.success || text.length === 0) {
        throw new AiError('AI_BAD_RESPONSE', 'AI provider reply has no message content');
      }
      return {
        text,
        inputTokens: parsed.data.usage?.prompt_tokens ?? 0,
        outputTokens: parsed.data.usage?.completion_tokens ?? 0,
        model: parsed.data.model ?? model,
      };
    },
  };
}

