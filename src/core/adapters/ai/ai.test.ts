import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError, getAi, parseJsonReply } from './index';
import type { AiMessage } from './types';

const ENV_KEYS = ['AI_PROVIDER', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL', 'AI_VISION_MODEL'] as const;
const saved: Record<string, string | undefined> = {};

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>): void {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

const imageMessages: AiMessage[] = [
  { role: 'system', content: 'You read invoices.' },
  {
    role: 'user',
    content: [
      { type: 'text', text: 'Extract the total.' },
      { type: 'image', mediaType: 'image/png', dataBase64: 'QUJD' },
    ],
  },
];

describe('getAi', () => {
  it('returns null when AI_API_KEY is unset', () => {
    setEnv({ AI_BASE_URL: 'https://api.example.com/v1' });
    expect(getAi()).toBeNull();
  });

  it('returns the mock provider without any key', () => {
    setEnv({ AI_PROVIDER: 'mock' });
    const ai = getAi();
    expect(ai?.name).toBe('mock');
    expect(ai?.supportsVision).toBe(false);
  });

  it('is vision-capable for anthropic and for openai-compatible with a vision model', () => {
    setEnv({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'test-key' });
    expect(getAi()?.supportsVision).toBe(true);
    setEnv({ AI_API_KEY: 'test-key', AI_BASE_URL: 'https://api.example.com/v1', AI_MODEL: 'm' });
    expect(getAi()?.supportsVision).toBe(false);
    setEnv({ AI_API_KEY: 'test-key', AI_BASE_URL: 'https://api.example.com/v1', AI_VISION_MODEL: 'v' });
    expect(getAi()?.supportsVision).toBe(true);
  });
});

describe('openai-compatible adapter', () => {
  it('sends bearer auth, data-URL images and JSON mode, then reads usage', async () => {
    setEnv({ AI_API_KEY: 'test-key', AI_BASE_URL: 'https://api.example.com/v1/', AI_MODEL: 'chat-model', AI_VISION_MODEL: 'vision-model' });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ model: 'vision-model', choices: [{ message: { content: '{"total":12}' } }], usage: { prompt_tokens: 40, completion_tokens: 7 } }),
    );

    const result = await getAi()!.complete(imageMessages, { feature: 'test.ocr', json: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe('vision-model');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toEqual([
      { role: 'system', content: 'You read invoices.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the total.' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } },
        ],
      },
    ]);
    expect(result).toEqual({ text: '{"total":12}', inputTokens: 40, outputTokens: 7, model: 'vision-model' });
  });

  it('omits response_format when json is not requested', async () => {
    setEnv({ AI_API_KEY: 'test-key', AI_BASE_URL: 'https://api.example.com/v1', AI_MODEL: 'chat-model' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'hi' } }] }));
    await getAi()!.complete([{ role: 'user', content: 'hello' }], { feature: 'test.chat' });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('response_format');
    expect(body.max_tokens).toBe(800);
  });

  it('maps a provider error to AI_UNAVAILABLE without leaking the key', async () => {
    setEnv({ AI_API_KEY: 'test-key', AI_BASE_URL: 'https://api.example.com/v1', AI_MODEL: 'chat-model' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'bad key test-key' }, 401));
    const error = await getAi()!.complete([{ role: 'user', content: 'x' }], { feature: 'f' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).code).toBe('AI_UNAVAILABLE');
    expect((error as AiError).message).not.toContain('test-key');
  });

  it('maps a reply without content to AI_BAD_RESPONSE', async () => {
    setEnv({ AI_API_KEY: 'test-key', AI_BASE_URL: 'https://api.example.com/v1', AI_MODEL: 'chat-model' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [] }));
    await expect(getAi()!.complete([{ role: 'user', content: 'x' }], { feature: 'f' })).rejects.toMatchObject({
      code: 'AI_BAD_RESPONSE',
    });
  });
});

describe('anthropic adapter', () => {
  it('uses the messages endpoint, top-level system, base64 image blocks and usage tokens', async () => {
    setEnv({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'test-key', AI_MODEL: 'claude-haiku-5-5' });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ model: 'claude-haiku-5-5', content: [{ type: 'text', text: '{"total":12}' }], usage: { input_tokens: 30, output_tokens: 5 } }),
    );

    const result = await getAi()!.complete(imageMessages, { feature: 'test.ocr', json: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.system).toContain('You read invoices.');
    expect(body.system).toContain('single JSON object');
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the total.' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
        ],
      },
    ]);
    expect(result).toEqual({ text: '{"total":12}', inputTokens: 30, outputTokens: 5, model: 'claude-haiku-5-5' });
  });
});

describe('mock adapter', () => {
  it('echoes the feature name and returns an empty object in JSON mode', async () => {
    setEnv({ AI_PROVIDER: 'mock' });
    const ai = getAi()!;
    const text = await ai.complete([{ role: 'user', content: 'hi' }], { feature: 'credit.reminder_draft' });
    expect(text.text).toContain('credit.reminder_draft');
    const json = await ai.complete([{ role: 'user', content: 'hi' }], { feature: 'f', json: true });
    expect(json.text).toBe('{}');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('parseJsonReply', () => {
  it('reads fenced, prefixed and plain objects', () => {
    expect(parseJsonReply('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonReply('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(parseJsonReply('Here you go: {"a":3} thanks')).toEqual({ a: 3 });
  });

  it('returns null when there is no valid object', () => {
    expect(parseJsonReply('no json here')).toBeNull();
    expect(parseJsonReply('[1,2,3]')).toBeNull();
    expect(parseJsonReply('{"broken":')).toBeNull();
  });
});
