# On-prem deployment

Tavio runs as one container plus PostgreSQL, Gotenberg (PDF rendering) and MinIO (S3-compatible file storage). The `docker-compose.yml` at the repo root wires them together.

## Requirements

- Docker Engine 24+ with the Compose plugin
- A host with at least 2 vCPU, 4 GB RAM and 40 GB disk
- A DNS name and a TLS reverse proxy in front of port 3000 (Caddy, nginx or Traefik)

## First start

Create `.env` next to `docker-compose.yml`:

```
POSTGRES_PASSWORD=<long random>
BETTER_AUTH_URL=https://tavio.example.dz
BETTER_AUTH_SECRET=<32+ random bytes>
BETTER_AUTH_TRUSTED_ORIGINS=https://tavio.example.dz
CRON_SECRET=<random>
MINIO_ROOT_USER=<user>
MINIO_ROOT_PASSWORD=<12+ chars>
# optional
APP_PORT=3000
MINIO_BUCKET=tavio
```

Then:

```
docker compose up -d --build
docker compose logs -f migrate app
```

The `migrate` service runs `drizzle-kit migrate` and exits. The `app` service starts only after it succeeds. Re-run `docker compose up -d --build` after each upgrade; migrations apply again and do nothing when they are already applied.

## Upgrades

1. Back up first (see below).
2. `git pull` the new release.
3. `docker compose up -d --build`.

## Backups

`scripts/backup.sh` runs `pg_dump`, gzips the result into `./backups` and keeps the last 14 files. To copy off-site, set `BACKUP_S3_URI` (and `BACKUP_S3_ENDPOINT` for R2 or MinIO) and have aws-cli credentials in the environment. The script needs `pg_dump` and a `DATABASE_URL` it can reach. On the host, publish PostgreSQL to localhost only (add `ports: ["127.0.0.1:5432:5432"]` to the `postgres` service) and set `DATABASE_URL=postgres://tavio:<password>@localhost:5432/tavio`.

Also back up the MinIO volume (`miniodata`) with the same schedule, because the database only holds references to files.

Restore a dump with `gunzip -c tavio-<stamp>.sql.gz | docker compose exec -T postgres psql -U tavio -d tavio`, on an empty database.

## Scheduled jobs

Call `/api/cron/outbox` (and the other `/api/cron/*` routes) every minute with header `Authorization: Bearer $CRON_SECRET`, from the host's cron or any scheduler.

## Security notes

- Keep ports 5432, 9000 and 9001 closed to the internet. Only the reverse proxy should reach 3000.
- Rotate `BETTER_AUTH_SECRET` only with a planned logout for all users.
- Store `.env` with mode 600.
