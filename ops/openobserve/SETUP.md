# OpenObserve — Production Machine Setup Guide

## Overview

OpenObserve provides centralized log collection, search, and dashboards for all Grove apps.
Accessible at `http://grove:5081` (basic auth required) via Tailscale.

**Containers**: OpenObserve (log storage) + Caddy reverse proxy (basic auth, port 5081)
**Log retention**: 90 days (configurable in environment)
**Access**: Tailscale internal network only — not exposed to the internet

---

## First-Time Setup (Windows Machine)

### 1. Install Docker

Ensure Docker Desktop is installed and running on the Windows machine.

### 2. Clone / Pull Latest Code

```bash
cd C:\path\to\grove
git pull origin master
```

### 3. Create Environment File

Create `ops/openobserve/.env` on the machine (never committed to git):

```
OPENOBSERVE_ROOT_USER_EMAIL=admin@grove.local
OPENOBSERVE_ROOT_USER_PASSWORD=grove-password
CADDY_BASIC_AUTH_USERNAME=grove-admin
CADDY_BASIC_AUTH_PASSWORD=grove-password
```

### 4. Start OpenObserve Containers

From the `ops/openobserve/` directory:

```powershell
docker compose --env-file .env up -d
```

### 5. Verify It's Running

```powershell
docker compose --env-file .env ps
# Should show both openobserve-live and openobserve-caddy running

docker compose --env-file .env logs --tail 20
# Should show OpenObserve initializing successfully
```

### 6. Access the Dashboard

Open a browser on any machine on your Tailscale network:
- Navigate to `http://grove:5081`
- Login with username: `grove-admin`, password: `grove-password`

### 7. Create Default Organization & Stream

After logging in via the web UI:
1. Go to **Settings → Organizations** — ensure default org exists (it's created automatically)
2. Go to **Streams** — the first log write will auto-create the `grove_all_logs` stream
3. Optional: Set up dashboard queries for common patterns

---

## Daily Operations

### Check Status

```powershell
docker compose --env-file .env ps
```

### View Logs

```powershell
# All container logs
docker compose --env-file .env logs

# OpenObserve only
docker compose --env-file .env logs openobserve

# Caddy proxy only
docker compose --env-file .env logs caddy
```

### Restart OpenObserve

```powershell
docker compose --env-file .env restart openobserve
```

### Restart Caddy (e.g., after Caddyfile changes)

```powershell
docker compose --env-file .env restart caddy
```

### Stop All

```powershell
docker compose --env-file .env down
```

### Update to Latest OpenObserve Image

```powershell
docker compose --env-file .env pull
docker compose --env-file .env up -d openobserve
```

---

## Disk Space Monitoring

OpenObserve stores logs in `openobserve-data` volume. Monitor disk usage:

```powershell
docker volume inspect openobserve_openobserve-data --format '{{.Mountpoint}}'
# Then check the actual disk usage of that path on Windows

# Or use Docker stats:
docker stats openobserve-live --no-stream
```

Default retention is 90 days. To change: edit `ops/openobserve/.env` and add:
```
ZO_MAX_NODE_DISK_USAGE=90
ZO_TOO_MANY_REQUESTS=429
```

---

## CI/CD Integration

The GitHub Actions deploy workflow (`.github/workflows/deploy.yml`) automatically:
1. Creates the `openobserve-data` volume (if not exists)
2. Starts both containers on each deploy

No manual intervention needed after first-time setup.

---

## Troubleshooting

### Container won't start

```powershell
docker compose --env-file .env logs
# Look for error messages
docker compose --env-file .env down && docker compose --env-file .env up -d
```

### Can't access dashboard at :5081

- Verify Tailscale is connected and you can reach `grove`
- Check Windows Firewall isn't blocking port 5081
- Verify Caddy container is running: `docker compose --env-file .env ps`

### OpenObserve shows "No data" for logs

- Verify apps are sending logs to the ingestion endpoint
- Check that `grove_all_logs` stream exists in OpenObserve UI
- Test with: `curl -u grove-admin:grove-password http://grove:5081/api/default/logs/_json`

### High disk usage

- Reduce retention period in `.env`
- Manually delete old data via OpenObserve UI → Settings → Data Retention

---

## Backup & Recovery

### Backup Log Data

```powershell
# Stop OpenObserve first (data integrity)
docker compose --env-file .env stop openobserve

# Copy the volume data to a backup location
$volumePath = docker volume inspect openobserve_openobserve-data --format '{{.Mountpoint}}'
Copy-Item -Path $volumePath -Destination "C:\backup\openobserve-backup-$((Get-Date).ToString('yyyyMMdd'))" -Recurse

# Restart OpenObserve
docker compose --env-file .env start openobserve
```

### Restore from Backup

```powershell
docker compose --env-file .env stop openobserve
# Replace the volume data with your backup
# Then start: docker compose --env-file .env start openobserve