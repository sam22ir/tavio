// Provider-neutral AI contract. Features depend only on this file, never on a vendor SDK.
export type AiRole = 'system' | 'user' | 'assistant';
export type AiContent = string | Array<{ type: 'text'; text: string } | { type: 'image'; mediaType: string; dataBase64: string }>;
export interface AiMessage { role: AiRole; content: AiContent }

export interface AiCompleteOptions {
  maxTokens?: number;          // default 800
  temperature?: number;        // default 0.2
  json?: boolean;              // ask the model for a single JSON object
  feature: string;             // usage label, e.g. 'credit.reminder_draft'
}

export interface AiResult { text: string; inputTokens: number; outputTokens: number; model: string }

export interface AiProvider {
  readonly name: string;       // 'openai-compatible' | 'anthropic' | 'mock'
  readonly model: string;
  readonly supportsVision: boolean;
  complete(messages: AiMessage[], opts: AiCompleteOptions): Promise<AiResult>;
}
