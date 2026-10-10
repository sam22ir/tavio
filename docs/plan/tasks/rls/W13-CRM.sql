-- W13-CRM: lead stage timestamp, attempt counter and channel.
-- The columns and checks come from schema.ts. stage_entered_at defaults to now(), so existing leads
-- are backfilled here with their creation time, which is the first stage they were in.
UPDATE leads SET stage_entered_at = created_at WHERE stage_entered_at IS DISTINCT FROM created_at;
