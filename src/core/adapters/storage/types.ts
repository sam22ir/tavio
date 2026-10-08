// Object storage port. Implementations: S3Storage (R2, MinIO) and MemoryStorage (dev and tests).
export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Short-lived GET URL for a private object. Default expiry is 300 seconds. */
  signedGetUrl(key: string, expiresSec?: number): Promise<string>;
  delete(key: string): Promise<void>;
}
