# Grove — Production Deployment Plan

> Status: Draft — refining in progress

## Overview

Grove is a self-hosted monorepo deployed on a local Windows machine, accessible to family members via Tailscale MagicDNS at `http://grove`. Nora is the primary interface — more apps will be added over time.

```
GitHub (source of truth)
    ↓ push to master
GitHub Actions (self-hosted runner on Windows)
    → yarn install
    → turbo test --filter=[changed]
    → turbo build --filter=[changed]
    → watt restart
    ↓
Platformatic Watt (port 80 — service composer + router)
    /          → nora     (Next.js app)
    /tools/*   → future apps
    ↓
Tailscale MagicDNS → http://grove
```

---

## Process Manager & Routing: Platformatic Watt

**[Platformatic Watt](https://docs.platformatic.dev/docs/watt/overview)** is the single process manager and HTTP router from day one.

- Node-native — no separate binary, installs as a dev dependency
- Composes multiple apps/services under one runtime on port 80
- Built-in routing: nora is the root, future apps get path prefixes
- Works naturally with a monorepo layout — each `apps/*` entry is a Watt service
- Replaces both PM2 (process management) and a reverse proxy in one tool

Note: validate the Watt Next.js adapter (`@platformatic/next`) for production stability before go-live.

---

## Machine Setup (Windows)

### Prerequisites

```bash
npm i -g turbo
```

- Install [GitHub Actions self-hosted runner](https://docs.github.com/en/actions/hosting-your-own-runners) — register as a Windows service so it survives reboots
- Tailscale: rename this machine to `grove` in the admin panel, enable MagicDNS
- Watt is a project dependency — no global install needed

### Port Allocation

| App | Internal port | Public |
|---|---|---|
| Watt (entry point) | 80 | `http://grove` |
| nora | 3000 | via Watt `/` |
| future app | 3001 | via Watt `/tools/*` |

---

## Platformatic Watt Config

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
        run: yarn turbo test --filter=...[HEAD^1] --passWithNoTests

      - name: Build affected packages
        run: yarn turbo build --filter=...[HEAD^1]

      - name: Restart Watt
        run: npx wattpm restart watt.json
```

---

## Environment & Secrets

Each app keeps a `.env.production.local` in its own folder on the machine — never committed.

**`apps/nora/.env.production.local`:**
```
OLLAMA_BASE_URL=http://ai:11434
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

1. Self-hosted GitHub Actions runner registered and running as a service
2. Tailscale: machine named `grove`, MagicDNS enabled, family invited
3. Validate `@platformatic/next` adapter works with nora's Next.js build
4. Run `npx wattpm start watt.json` manually — confirm `http://grove` resolves and serves nora
5. Register Watt as a Windows service (survives reboots)
6. Push a trivial change to `apps/nora/` — confirm pipeline runs end-to-end
7. Foundation done — every future app slots in with a `watt.json` service block

---

## Future: Documentation Portal (Outline)

When grove has grown to multiple apps and the Obsidian-per-developer workflow becomes insufficient, introduce **[Outline](https://www.getoutline.com/)** as a self-hosted team wiki.

- Runs as another app in the monorepo at e.g. `http://grove/docs` (behind Platformatic Watt)
- Browser-accessible to all family members — no Obsidian install needed
- Backlinks, nested docs, full-text search, embedded diagrams
- Requires Postgres + S3-compatible storage (e.g. MinIO locally)
- Scaffold as `apps/docs` following the same CI/CD pattern as other apps

**Trigger for this**: when the Obsidian vault becomes unwieldy or when family members need to read/contribute to docs without a dev setup.

---

## Open Questions

- [ ] Validate `@platformatic/next` adapter stability with nora's Next.js build
- [ ] Decide on Windows service registration for Watt (`wattpm` service vs Task Scheduler)
- [ ] HTTPS: Tailscale can issue certs via `tailscale cert` for `grove.tailnet-name.ts.net` if needed later
- [ ] Outline: evaluate MinIO vs local filesystem for storage backend when the time comes
