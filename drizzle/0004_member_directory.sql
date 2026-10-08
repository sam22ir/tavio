-- Safe, tenant-scoped view of company members' display names for tavio_app (which has no access to users).
CREATE OR REPLACE VIEW member_directory WITH (security_barrier = true) AS
  SELECT m.company_id, m.user_id, u.name, u.email, m.status
  FROM memberships m
  JOIN users u ON u.id = m.user_id
  WHERE m.company_id = nullif(current_setting('app.company_id', true), '')::uuid;
--> statement-breakpoint
GRANT SELECT ON member_directory TO tavio_app;
