# Grove Host Deploy

The grove site is hosted **on the grove machine itself** (the Mac on the tailnet,
hostname `grove`). There is intentionally no GitHub self-hosted runner: the repo
is public and the account is on the free plan, which cannot use self-hosted
runners on public repos.

## Architecture

```
GitHub Actions (free, GitHub-hosted runners)
   ├─ PR CI      → tests + build (free minutes)
   ├─ PR merge   → agent review + merge gate (free — the agent reviews)
   └─ Deploy     → test, then POST the commit SHA to the host daemon ──┐
                                                                       │ Tailscale Funnel
   grove machine (this Mac)                                            ▼
   ├─ host-daemon.mjs  (launchd, kept alive)  ← webhook + GitHub polling
   │     └─ deploy.sh <sha>
   │          ├─ git checkout <sha> in ~/.grove/checkout
   │          ├─ docker build → grove:<sha>
   │          ├─ openobserve + caddy (ops/openobserve, :5081)
   │          ├─ swap grove-live container (port 80)
   │          ├─ health checks + model pre-warm (local LM Studio)
   │          └─ commit status "grove-host/deploy" → GitHub
   └─ LM Studio (:1234) — local AI backend, reachable as host.docker.internal
```

- **Instant path**: CI posts `POST /deploy/<token>` via the machine's Tailscale
  Funnel URL. The token is a repo secret (`GROVE_DEPLOY_TOKEN`).
- **Fallback path**: the daemon polls GitHub every 60s for a new master commit
  whose checks are green, so a missed webhook (machine asleep, funnel off, CI
  down) still deploys within minutes of coming back.
- **Status**: every deploy reports back to GitHub as a commit status
  (`grove-host/deploy`), so the deploy is visible in the commit/PR checks.

## Setup on the host machine (one-time)

```bash
# from this repo's checkout
bash ops/deploy/install-host.sh
```

Then:

1. Fill the remaining values in `~/.grove/host.env` (OpenObserve + Caddy
   credentials, LM Studio URL/model). The installer already filled
   `GITHUB_TOKEN` (from `gh auth token`) and generated `GROVE_DEPLOY_TOKEN`.
2. Set the GitHub repo secret to the generated token:
   `gh secret set GROVE_DEPLOY_TOKEN --repo kod88vn/grove <<< "$(grep GROVE_DEPLOY_TOKEN ~/.grove/host.env | cut -d= -f2)"`
3. Set the GitHub repo variable to the machine's Funnel URL (the daemon prints
   the exact URL once `tailscale funnel` is active):
   `gh variable set GROVE_DEPLOY_URL --repo kod88vn/grove --value https://grove.<tailnet>`

## Operate

```bash
# daemon health
curl -s http://127.0.0.1:8080/healthz
tail -f ~/.grove/logs/daemon.out.log

# last deploy output
cat ~/.grove/logs/deploy-last.log

# restart the daemon (launchd auto-restarts it; manual nudge)
launchctl kickstart -k "gui/$(id -u)/com.grove.host-daemon"

# deploy a specific SHA by hand
bash ~/.grove/checkout/ops/deploy/deploy.sh <sha>

# after updating this repo, refresh the installed daemon + scripts:
cp ops/deploy/host-daemon.mjs ~/.grove/
launchctl kickstart -k "gui/$(id -u)/com.grove.host-daemon"
```

## Notes

- The app container binds `0.0.0.0:80`, so it is reachable on the tailnet as
  `http://grove` (and the OpenObserve dashboard at `http://grove:5081` with
  basic auth).
- The chat AI runs against the **local** LM Studio server (`host.docker.internal:1234`);
  no external AI API key is needed anywhere in this pipeline.
- Nora's database lives in the `nora-data` Docker volume (survives container swaps).
