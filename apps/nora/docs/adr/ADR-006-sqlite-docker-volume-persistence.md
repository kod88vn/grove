# ADR-006 — Persist SQLite chat history via Docker named volume

## Status
Accepted

## Context
Nora stores all chat history in a SQLite database (`better-sqlite3`). The DB path defaults to `<cwd>/data/nora.db`. When deployed with Docker, the container filesystem is ephemeral: every container swap (`docker stop` + `docker run`) destroyed the entire chat history because no persistent storage was mounted.

This was discovered in production when users reported seeing no conversation history after a redeploy.

## Decision
Use a named Docker volume (`nora-data`) mounted at `/data` inside the container, and set `NORA_DB_PATH=/data/nora.db` via an environment variable. The volume is created with `docker volume create nora-data` in the deploy workflow before the container swap step; `docker volume create` is idempotent so it is safe to run on every deploy.

The `createDatabase` function in `lib/db/db.js` already calls `mkdirSync(dirname(dbPath), { recursive: true })` so no code change was needed — only deploy configuration.

## Consequences
- Chat history now survives container swaps and image upgrades.
- The SQLite file is stored on the Docker host at the volume's backing path (typically `/var/lib/docker/volumes/nora-data/_data/nora.db` on Linux).
- Backups must target the Docker volume, not the container.
- Any history created before this change (while the DB lived inside the container) was lost and is not recoverable.
- Running Nora locally without Docker continues to use `<cwd>/data/nora.db` (the `NORA_DB_PATH` env var is not set in the dev workflow).
