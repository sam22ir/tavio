export type AiErrorCode = 'AI_UNAVAILABLE' | 'AI_BAD_RESPONSE';

// Thrown by adapters. Messages never include the API key or the raw provider body.
export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiError';
    this.code = code;
  }
}
