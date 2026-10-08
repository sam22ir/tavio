import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Core infrastructure tables (DATA_MODEL.md sections 2.7 to 2.10).
// `created_by` references users.id (better-auth, see auth.ts). `company_id`
// references companies(id). Neither is a DB foreign key here: other schema
// files are not imported. RLS and triggers are hand-written SQL, not in this file.

const commonColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // null for system or seed rows and for self-signup
  createdBy: uuid('created_by'),
};

// 2.7 audit_log: append-only. The trigger that rejects UPDATE and DELETE is hand SQL.
export const auditLog = pgTable(
  'audit_log',
  {
    ...commonColumns,
    companyId: uuid('company_id').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorType: text('actor_type').notNull(),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    recordId: uuid('record_id'),
    changes: jsonb('changes'),
    requestId: text('request_id'),
    ip: inet('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [
    check(
      'audit_log_actor_type_check',
      sql`${t.actorType} in ('user', 'system', 'job', 'api_key')`,
    ),
    index('audit_log_company_entity_record_created_idx').on(
      t.companyId,
      t.entity,
      t.recordId,
      t.createdAt,
    ),
    index('audit_log_company_actor_created_idx').on(t.companyId, t.actorUserId, t.createdAt),
    index('audit_log_company_created_idx').on(t.companyId, t.createdAt),
  ],
);

// 2.8 sequences: gap-free numbering, one row per (company, code).
export const sequences = pgTable(
  'sequences',
  {
    ...commonColumns,
    companyId: uuid('company_id').notNull(),
    code: text('code').notNull(),
    prefix: text('prefix').notNull().default(''),
    padding: smallint('padding').notNull().default(5),
    // the next number to hand out
    nextNumber: bigint('next_number', { mode: 'number' }).notNull().default(1),
    // reset next_number each fiscal year (guess in DATA_MODEL)
    resetYearly: boolean('reset_yearly').notNull().default(false),
    // last year the counter was reset for
    fiscalYear: smallint('fiscal_year'),
  },
  (t) => [
    unique('sequences_company_code_unique').on(t.companyId, t.code),
    index('sequences_company_idx').on(t.companyId),
  ],
);

// 2.9 outbox: transactional outbox for slow or fallible work.
export const outbox = pgTable(
  'outbox',
  {
    ...commonColumns,
    // the drain job runs as owner to read across tenants (guess in DATA_MODEL)
    companyId: uuid('company_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    // retry backoff
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    // lease for a worker
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastError: text('last_error'),
  },
  (t) => [
    check(
      'outbox_status_check',
      sql`${t.status} in ('pending', 'processing', 'done', 'failed')`,
    ),
    index('outbox_available_at_pending_idx')
      .on(t.availableAt)
      .where(sql`${t.status} in ('pending', 'failed')`),
    index('outbox_company_status_idx').on(t.companyId, t.status),
  ],
);

// 2.10 files: metadata for objects in R2 or MinIO. Accessed by signed URL only.
export const files = pgTable(
  'files',
  {
    ...commonColumns,
    companyId: uuid('company_id').notNull(),
    // object key in the private bucket. Never a public URL.
    storageKey: text('storage_key').notNull(),
    bucket: text('bucket').notNull(),
    originalName: text('original_name'),
    mimeType: text('mime_type').notNull(),
    // byte count, not money
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    kind: text('kind').notNull(),
    // owning record entity, for example credit_sales.contract
    entity: text('entity'),
    recordId: uuid('record_id'),
    // true for id_photo (encrypted at rest)
    encrypted: boolean('encrypted').notNull().default(false),
    // soft delete. Hard delete only by retention job.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('files_bucket_check', sql`${t.bucket} in ('tavio-files', 'tavio-id-photos')`),
    check(
      'files_kind_check',
      sql`${t.kind} in ('id_photo', 'contract_pdf', 'receipt_pdf', 'attachment', 'logo', 'other')`,
    ),
    unique('files_company_storage_key_unique').on(t.companyId, t.storageKey),
    index('files_company_entity_record_idx').on(t.companyId, t.entity, t.recordId),
    index('files_company_kind_idx').on(t.companyId, t.kind),
  ],
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
export type Sequence = typeof sequences.$inferSelect;
export type NewSequence = typeof sequences.$inferInsert;
export type OutboxRow = typeof outbox.$inferSelect;
export type NewOutboxRow = typeof outbox.$inferInsert;
export type FileRow = typeof files.$inferSelect;
export type NewFileRow = typeof files.$inferInsert;
