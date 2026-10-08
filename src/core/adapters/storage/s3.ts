import { AwsClient } from 'aws4fetch';
import type { Storage } from './types';

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

// Path-style S3 object API. Works with Cloudflare R2 and MinIO.
export class S3Storage implements Storage {
  private readonly client: AwsClient;
  private readonly endpoint: string;
  private readonly bucket: string;

  constructor(config: S3Config) {
    this.endpoint = config.endpoint.replace(/\/+$/, '');
    this.bucket = config.bucket;
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: config.region ?? 'auto',
    });
  }

  private objectUrl(key: string): string {
    const path = key.split('/').map(encodeURIComponent).join('/');
    return `${this.endpoint}/${this.bucket}/${path}`;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const res = await this.client.fetch(this.objectUrl(key), {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body: body as BodyInit,
    });
    if (!res.ok) throw new Error(`S3 PUT failed with status ${res.status}`);
  }

  async signedGetUrl(key: string, expiresSec = 300): Promise<string> {
    const url = new URL(this.objectUrl(key));
    url.searchParams.set('X-Amz-Expires', String(expiresSec));
    const signed = await this.client.sign(url, { method: 'GET', aws: { signQuery: true } });
    return signed.url;
  }

  async delete(key: string): Promise<void> {
    const res = await this.client.fetch(this.objectUrl(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE failed with status ${res.status}`);
  }
}
