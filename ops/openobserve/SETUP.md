# OpenObserve Setup Guide — Production Machine

## First-Time Setup (Windows machine)

Run these commands on the production Windows machine:

```powershell
# 1. Set environment variables for OpenObserve credentials (persistent across sessions)
[Environment]::SetEnvironmentVariable('OPENOBSERVE_ROOT_USER_EMAIL', 'admin@grove.local', 'User')
[Environment]::SetEnvironmentVariable('OPENOBSERVE_ROOT_USER_PASSWORD', 'grove-password', 'User')
[Environment]::SetEnvironmentVariable('CADDY_BASIC_AUTH_USERNAME', 'grove-admin', 'User')
[Environment]::SetEnvironmentVariable('CADDY_BASIC_AUTH_PASSWORD', 'grove-password', 'User')

# 2. Create persistent Docker volume for log data
docker volume create openobserve_openobserve-data

# 3. Start the stack (reads credentials from environment variables)
cd ops\openobserve
docker compose up -d

# 4. Verify running
docker compose ps
```

**Dashboard:** `http://grove:5081` — user: `grove-admin`, password: `grove-password`

## GitHub Actions Variables Setup

Add these 4 variables to your GitHub repository:
**Settings → Secrets and Variables → Actions → Variables**

| Variable Name | Value |
|---|---|
| `OPENOBSERVE_ROOT_USER_EMAIL` | `admin@grove.local` |
| `OPENOBSERVE_ROOT_USER_PASSWORD` | your-secure-password |
| `CADDY_BASIC_AUTH_USERNAME` | `grove-admin` |
| `CADDY_BASIC_AUTH_PASSWORD` | your-secure-password |

The deploy workflow reads these from `${{ vars.VAR_NAME }}` and passes them to `docker compose`.

## Daily Operations

```powershell
# Restart the stack
cd ops\openobserve && docker compose restart

# Check logs
docker compose --no-TTY logs -f openobserve

# Stop the stack
cd ops\openobserve && docker compose down

# Update to latest OpenObserve image
docker compose pull && docker compose up -d
```

## How Credentials Work

No files needed. Everything uses environment variables:

- **docker-compose.yml** references `${VAR:-default}` syntax in `environment:` blocks
- **GitHub Actions** passes them via the `env:` block on the deploy step → `docker compose` inherits them
- **Local machine** sets them via `[Environment]::SetEnvironmentVariable()` so they persist across terminal sessions

## Troubleshooting

If OpenObserve fails to start on deploy:
1. Check the env vars are set (local): `echo $env:OPENOBSERVE_ROOT_USER_EMAIL`
2. Check container logs: `docker compose --no-TTY logs openobserve`
3. Verify GitHub vars exist in Settings → Secrets and Variables → Actions