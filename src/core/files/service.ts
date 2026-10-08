import { createHash, randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { files, type FileRow } from '@/core/db/schema';
import { getStorage } from '@/core/adapters/storage';
import { err, ok, type Result } from '@/core/result';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export interface UploadFileInput {
  entity: string;
  recordId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  kind: string;
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
  return cleaned || 'file';
}

// Stores the object in the private bucket and inserts its metadata row under the tenant's RLS.
export async function uploadFile(ctx: Ctx, input: UploadFileInput): Promise<Result<FileRow>> {
  if (input.bytes.byteLength > MAX_FILE_BYTES) {
    return err('VALIDATION', 'File is larger than 10 MB', { maxBytes: MAX_FILE_BYTES });
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(input.contentType)) {
    return err('VALIDATION', 'File type is not allowed', { contentType: input.contentType });
  }

  const key = `${ctx.companyId}/${input.entity}/${input.recordId}/${randomUUID()}-${safeName(input.fileName)}`;
  const encrypted = input.kind === 'id_photo';
  const bucket = encrypted ? 'tavio-id-photos' : 'tavio-files';
  const sha256 = createHash('sha256').update(input.bytes).digest('hex');

  await getStorage().put(key, input.bytes, input.contentType);

  const [row] = await ctx.tx
    .insert(files)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      storageKey: key,
      bucket,
      originalName: input.fileName,
      mimeType: input.contentType,
      sizeBytes: input.bytes.byteLength,
      sha256,
      kind: input.kind,
      entity: input.entity,
      recordId: input.recordId,
      encrypted,
    })
    .returning();
  if (!row) return err('INTERNAL', 'File row was not created');
  return ok(row);
}

// Signed GET URL for a file visible to the current tenant. Never a public URL.
export async function fileUrl(ctx: Ctx, fileId: string, expiresSec = 300): Promise<Result<string>> {
  const [row] = await ctx.tx
    .select()
    .from(files)
    .where(
      and(eq(files.id, fileId), eq(files.companyId, ctx.companyId), isNull(files.deletedAt)),
    )
    .limit(1);
  if (!row) return err('NOT_FOUND', 'File not found');
  return ok(await getStorage().signedGetUrl(row.storageKey, expiresSec));
}
