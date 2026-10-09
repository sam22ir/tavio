#!/usr/bin/env bash
# Dumps the Tavio database, gzips it, and optionally uploads it to S3 or R2.
#
# Env:
#   DATABASE_URL          required, postgres:// URL (pg_dump reads it)
#   BACKUP_DIR            local output dir (default ./backups)
#   BACKUP_S3_URI         optional, e.g. s3://tavio-backups/prod (R2 works too)
#   BACKUP_S3_ENDPOINT    optional, e.g. https://<account>.r2.cloudflarestorage.com
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION   used by aws-cli when uploading
#
# Example cron (daily 02:30): 30 2 * * * cd /opt/tavio && ./scripts/backup.sh >> backup.log 2>&1
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/tavio-$stamp.sql.gz"
tmp="$file.partial"

# Remove the partial file if anything fails, so no broken backup is left behind.
trap 'rm -f "$tmp"' EXIT

pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip -9 > "$tmp"
mv "$tmp" "$file"
trap - EXIT
echo "backup written: $file ($(du -h "$file" | cut -f1))"

# Keep 14 local copies.
ls -1t "$BACKUP_DIR"/tavio-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws-cli not found, skipping upload" >&2
    exit 1
  fi
  endpoint_args=()
  if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
    endpoint_args=(--endpoint-url "$BACKUP_S3_ENDPOINT")
  fi
  aws "${endpoint_args[@]}" s3 cp "$file" "${BACKUP_S3_URI%/}/$(basename "$file")"
  echo "uploaded to ${BACKUP_S3_URI%/}/"
fi
