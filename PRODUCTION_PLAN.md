# Grove — Production Deployment Plan

> Status: Draft — refining in progress

> Current trial mode: Active CI workflow is back on Watt retry path. PM2 fallback workflow is saved at `ops/deploy/deploy.pm2.backup.yml`.

## Overview

Grove is a self-hosted monorepo deployed on a local Windows machine, accessible to family members via Tailscale MagicDNS at `http://grove`. Nora is the primary interface — more apps will be added over time.

```
GitHub (source of truth)
    ↓ push to master
GitHub Actions (self-hosted runner on Windows)
    → yarn install
    → turbo test --filter=[changed]
    → turbo build --filter=[changed]
  → pm2 startOrRestart nora
    ↓
PM2 (process manager)
  nora (Next.js app on port 80)
    ↓
Tailscale MagicDNS → http://grove
```

---

## Process Manager: PM2 (Current)

PM2 is the current production process manager while Watt integration is deferred.

- Keeps Nora alive and auto-restarts on crashes
- Supports idempotent `startOrRestart` during CI deploys
- Simple first step while stabilizing production delivery

`ecosystem.config.cjs` at repo root defines Nora:

```js
module.exports = {
  apps: [
    {
      name: 'nora',
      cwd: './apps/nora',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 80',
      env: {
        NODE_ENV: 'production',
        PORT: '80',
      },
      autorestart: true,
    },
  ],
}
```

---

## Platformatic Watt (Deferred)

**[Platformatic Watt](https://docs.platformatic.dev/docs/watt/overview)** is the single process manager and HTTP router from day one.

- Node-native — no separate binary, installs as a dev dependency
- Composes multiple apps/services under one runtime on port 80
- Built-in routing: nora is the root, future apps get path prefixes
- Works naturally with a monorepo layout — each `apps/*` entry is a Watt service
- Single tool for both process management and HTTP routing — no reverse proxy needed

Note: Watt remains the target architecture, but is deferred until runtime discovery issues are resolved.

---

## Machine Setup (Windows)

### Prerequisites

```bash
npm i -g turbo
```

- ✅ `turbo` available in Git Bash PATH
- ✅ [GitHub Actions self-hosted runner](https://docs.github.com/en/actions/hosting-your-own-runners) registered with label `grove`, running as a Windows service
- ✅ Tailscale installed, machine named `grove`, MagicDNS enabled
- PM2 will be installed/updated during each deploy

### Port Allocation

| App | Internal port | Public |
|---|---|---|
| nora | 80 | `http://grove` |

---

## PM2 Deploy Config

`ecosystem.config.cjs` at repo root (committed) is used by CI:

```bash
pm2 startOrRestart ecosystem.config.cjs --env production
pm2 save
```

---

## Platformatic Watt Config (Deferred)

`watt.json` at repo root (committed):

```json
{
  "$schema": "https://platformatic.dev/schemas/v2/watt",
  "server": {
    "port": 80,
    "hostname": "0.0.0.0"
  },
  "services": [
    {
      "id": "nora",
      "path": "./apps/nora",
      "url": "http://localhost:3000"
    }
  ],
  "composer": {
    "services": [
      {
        "id": "nora",
        "proxy": { "prefix": "/" }
      }
    ]
  }
}
```

Add a new service block per app as grove grows — each gets a `prefix` path.

First-time start (run once on the machine):

```bash
npx wattpm start watt.json
```

Register Watt as a Windows service using `wattpm` or Task Scheduler. After this, CI handles restarts.

---

## CI/CD Pipeline

`.github/workflows/deploy.yml`:

```yaml
name: Deploy grove

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: self-hosted

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # needed for turbo --filter=[HEAD^1]

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Test affected packages
        run: yarn turbo test --filter=...[HEAD^1]

      - name: Build affected packages
        run: yarn turbo build --filter=...[HEAD^1]

      - name: Restart Nora (PM2)
        run: |
          npm i -g pm2
          pm2 startOrRestart ecosystem.config.cjs --env production
          pm2 save
```

---

## Environment & Secrets

Each app keeps a `.env.production.local` in its own folder on the machine — never committed.

**`apps/nora/.env.production.local`:**
```
OLLAMA_BASE_URL=http://grove:11434
```

Add per-app env files as new apps are introduced.

---

## Family Access

| Step | Who |
|---|---|
| Install Tailscale | Each family member |
| Join your Tailscale network (send invite from admin panel) | You |
| Visit `http://grove` | Done |

No port forwarding, no public IP exposure. Tailscale encrypts all traffic end-to-end.

---

## Adding a New App (future workflow)

1. Scaffold `apps/my-new-tool/` in the monorepo
2. Pick the next available port (e.g. 3001)
3. Add a service block to `watt.json` with its port and path prefix
4. `npx wattpm restart watt.json` once on the machine — CI takes over from there

---

## Rollout Order

1. ✅ Self-hosted GitHub Actions runner registered with label `grove`, running as a Windows service
2. ✅ Tailscale: machine named `grove`, MagicDNS enabled
3. ✅ `turbo` on PATH in Git Bash
4. ✅ `watt.json` created at repo root
5. ✅ `.github/workflows/deploy.yml` created with `runs-on: grove`
6. Create `apps/nora/.env.production.local` on the machine with `OLLAMA_BASE_URL`
7. Open port 80 in Windows Firewall
8. Push a trivial change to `apps/nora/` — confirm pipeline runs end-to-end and PM2 keeps `nora` online
9. Foundation done — stabilize Nora on PM2
10. Revisit Watt routing once runtime detection issue is resolved

---

## Future: Documentation Portal (Outline)

When grove has grown to multiple apps and the Markdown-in-repo workflow becomes insufficient for non-developer family members, introduce **[Outline](https://www.getoutline.com/)** as a self-hosted team wiki.

- Runs as another app in the monorepo at e.g. `http://grove/docs` (behind Platformatic Watt)
- Browser-accessible to all family members — no dev tooling needed
- Backlinks, nested docs, full-text search, embedded diagrams
- Requires Postgres + S3-compatible storage (e.g. MinIO locally)
- Scaffold as `apps/docs` following the same CI/CD pattern as other apps

**Trigger for this**: when family members need to read/contribute to docs without a developer setup.

---

## Open Questions

- [ ] Revisit Watt runtime detection and adapter stability (`@platformatic/next`)
- [ ] Decide migration timing from PM2 to Watt + routing on port 80
- [ ] HTTPS: Tailscale can issue certs via `tailscale cert` for `grove.tailnet-name.ts.net` if needed later
- [ ] Outline: evaluate MinIO vs local filesystem for storage backend when the time comes
