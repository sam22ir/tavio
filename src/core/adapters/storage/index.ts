import { S3Storage } from './s3';
import type { Storage } from './types';

export type { Storage } from './types';
export { S3Storage } from './s3';

// In-memory storage for dev and tests. Objects live only in this process.
export class MemoryStorage implements Storage {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async signedGetUrl(key: string, expiresSec = 300): Promise<string> {
    return `memory://${encodeURIComponent(key)}?expires=${expiresSec}`;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

let memory: MemoryStorage | undefined;

// S3Storage when the S3_* env is set, else one shared MemoryStorage.
export function getStorage(): Storage {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (endpoint && bucket && accessKeyId && secretAccessKey) {
    return new S3Storage({
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
      region: process.env.S3_REGION || 'auto',
    });
  }
  memory ??= new MemoryStorage();
  return memory;
}
