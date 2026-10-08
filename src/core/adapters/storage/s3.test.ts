import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorage, MemoryStorage } from './index';
import { S3Storage } from './s3';

const config = {
  endpoint: 'https://s3.example.test/',
  bucket: 'tavio-files',
  accessKeyId: 'AKIDTEST',
  secretAccessKey: 'SECRETTEST',
  region: 'auto',
};

describe('S3Storage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('PUTs the object to a path-style URL with the content type and a SigV4 header', async () => {
    const storage = new S3Storage(config);
    await storage.put('co/entity/rec/a b.pdf', new Uint8Array([1, 2, 3]), 'application/pdf');

    const req = fetchMock.mock.calls[0]?.[0] as Request;
    expect(req.method).toBe('PUT');
    expect(req.url).toBe('https://s3.example.test/tavio-files/co/entity/rec/a%20b.pdf');
    expect(req.headers.get('content-type')).toBe('application/pdf');
    expect(req.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDTEST\//);
  });

  it('builds a presigned GET URL with the requested expiry', async () => {
    const storage = new S3Storage(config);
    const url = new URL(await storage.signedGetUrl('co/x.pdf'));
    expect(url.origin + url.pathname).toBe('https://s3.example.test/tavio-files/co/x.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();

    const custom = new URL(await storage.signedGetUrl('co/x.pdf', 60));
    expect(custom.searchParams.get('X-Amz-Expires')).toBe('60');
  });

  it('DELETEs the object and throws on server errors', async () => {
    const storage = new S3Storage(config);
    await storage.delete('co/x.pdf');
    expect((fetchMock.mock.calls[0]?.[0] as Request).method).toBe('DELETE');

    fetchMock.mockResolvedValueOnce(new Response('denied', { status: 403 }));
    await expect(storage.delete('co/x.pdf')).rejects.toThrow('403');
  });
});

describe('getStorage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns MemoryStorage when the S3 env is not set', () => {
    vi.stubEnv('S3_ENDPOINT', '');
    vi.stubEnv('S3_BUCKET', '');
    expect(getStorage()).toBeInstanceOf(MemoryStorage);
  });

  it('returns S3Storage when the S3 env is set', () => {
    vi.stubEnv('S3_ENDPOINT', 'https://s3.example.test');
    vi.stubEnv('S3_BUCKET', 'tavio-files');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'AKIDTEST');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'SECRETTEST');
    expect(getStorage()).toBeInstanceOf(S3Storage);
  });
});
