-- App role: non-owner, no BYPASSRLS. withTenant() runs `set local role tavio_app`.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'tavio_app') then
    create role tavio_app nologin;
  end if;
end
$$;--> statement-breakpoint
grant tavio_app to current_user;--> statement-breakpoint
grant usage on schema public to tavio_app;--> statement-breakpoint
grant select, insert, update, delete on all tables in schema public to tavio_app;--> statement-breakpoint
grant usage, select on all sequences in schema public to tavio_app;--> statement-breakpoint
alter default privileges in schema public grant select, insert, update, delete on tables to tavio_app;--> statement-breakpoint
-- Auth tables are never visible to the app role; better-auth uses the owner connection.
revoke all on users, sessions, accounts, verifications from tavio_app;--> statement-breakpoint
-- Tenant isolation (RLS). Tenant is read from app.company_id, set by withTenant().
alter table memberships enable row level security;--> statement-breakpoint
alter table memberships no force row level security;--> statement-breakpoint
alter table roles enable row level security;--> statement-breakpoint
alter table roles no force row level security;--> statement-breakpoint
alter table role_permissions enable row level security;--> statement-breakpoint
alter table role_permissions no force row level security;--> statement-breakpoint
alter table company_modules enable row level security;--> statement-breakpoint
alter table company_modules no force row level security;--> statement-breakpoint
alter table audit_log enable row level security;--> statement-breakpoint
alter table audit_log no force row level security;--> statement-breakpoint
alter table sequences enable row level security;--> statement-breakpoint
alter table sequences no force row level security;--> statement-breakpoint
alter table outbox enable row level security;--> statement-breakpoint
alter table outbox no force row level security;--> statement-breakpoint
alter table files enable row level security;--> statement-breakpoint
alter table files no force row level security;--> statement-breakpoint
drop policy if exists tenant_isolation on memberships;--> statement-breakpoint
create policy tenant_isolation on memberships for all
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
drop policy if exists tenant_isolation on roles;--> statement-breakpoint
create policy tenant_isolation on roles for all
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
drop policy if exists tenant_isolation on role_permissions;--> statement-breakpoint
create policy tenant_isolation on role_permissions for all
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
drop policy if exists tenant_isolation on company_modules;--> statement-breakpoint
create policy tenant_isolation on company_modules for all
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
drop policy if exists tenant_isolation on audit_log;--> statement-breakpoint
create policy tenant_isolation on audit_log for all
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
drop policy if exists tenant_isolation on sequences;--> statement-breakpoint
create policy tenant_isolation on sequences for all
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
drop policy if exists tenant_isolation on outbox;--> statement-breakpoint
create policy tenant_isolation on outbox for all
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
drop policy if exists tenant_isolation on files;--> statement-breakpoint
create policy tenant_isolation on files for all
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
-- companies: a tenant sees only its own company row.
alter table companies enable row level security;--> statement-breakpoint
alter table companies no force row level security;--> statement-breakpoint
drop policy if exists tenant_isolation on companies;--> statement-breakpoint
create policy tenant_isolation on companies for all
  using (id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
-- Foreign keys to users (created_by / user_id / actor_user_id columns, all nullable except memberships.user_id).
alter table memberships drop constraint if exists memberships_user_id_users_id_fk;--> statement-breakpoint
alter table memberships add constraint memberships_user_id_users_id_fk
  foreign key (user_id) references users(id) on delete cascade;--> statement-breakpoint
alter table companies drop constraint if exists companies_created_by_users_id_fk;--> statement-breakpoint
alter table companies add constraint companies_created_by_users_id_fk
  foreign key (created_by) references users(id);--> statement-breakpoint
alter table company_modules drop constraint if exists company_modules_created_by_users_id_fk;--> statement-breakpoint
alter table company_modules add constraint company_modules_created_by_users_id_fk
  foreign key (created_by) references users(id);--> statement-breakpoint
alter table memberships drop constraint if exists memberships_created_by_users_id_fk;--> statement-breakpoint
alter table memberships add constraint memberships_created_by_users_id_fk
  foreign key (created_by) references users(id);--> statement-breakpoint
alter table role_permissions drop constraint if exists role_permissions_created_by_users_id_fk;--> statement-breakpoint
alter table role_permissions add constraint role_permissions_created_by_users_id_fk
  foreign key (created_by) references users(id);--> statement-breakpoint
alter table roles drop constraint if exists roles_created_by_users_id_fk;--> statement-breakpoint
alter table roles add constraint roles_created_by_users_id_fk
  foreign key (created_by) references users(id);--> statement-breakpoint
alter table audit_log drop constraint if exists audit_log_created_by_users_id_fk;--> statement-breakpoint
alter table audit_log add constraint audit_log_created_by_users_id_fk
  foreign key (created_by) references users(id);--> statement-breakpoint
alter table audit_log drop constraint if exists audit_log_actor_user_id_users_id_fk;--> statement-breakpoint
alter table audit_log add constraint audit_log_actor_user_id_users_id_fk
  foreign key (actor_user_id) references users(id);--> statement-breakpoint
alter table files drop constraint if exists files_created_by_users_id_fk;--> statement-breakpoint
alter table files add constraint files_created_by_users_id_fk
  foreign key (created_by) references users(id);--> statement-breakpoint
alter table outbox drop constraint if exists outbox_created_by_users_id_fk;--> statement-breakpoint
alter table outbox add constraint outbox_created_by_users_id_fk
  foreign key (created_by) references users(id);--> statement-breakpoint
alter table sequences drop constraint if exists sequences_created_by_users_id_fk;--> statement-breakpoint
alter table sequences add constraint sequences_created_by_users_id_fk
  foreign key (created_by) references users(id);--> statement-breakpoint
-- Posted-document guard for P4+ tables: posted rows are immutable except posted -> cancelled.
create or replace function tavio_forbid_posted_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.state = 'posted' then
      raise exception 'POSTED_IMMUTABLE';
    end if;
    return old;
  end if;
  if old.state = 'posted' then
    if new.state = 'cancelled' and to_jsonb(new) - 'state' - 'updated_at' = to_jsonb(old) - 'state' - 'updated_at' then
      return new;
    end if;
    raise exception 'POSTED_IMMUTABLE';
  end if;
  return new;
end
$$;
