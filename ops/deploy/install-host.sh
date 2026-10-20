#!/usr/bin/env bash
# One-time installer for the Grove host daemon. Run it ON the machine that hosts
# grove (after checking out this repo). It is idempotent — safe to re-run.
#
#   - Creates ~/.grove (daemon state, logs, checkout, host.env)
#   - Clones the repo into ~/.grove/checkout (the daemon's build context)
#   - Installs the daemon next to its state: ~/.grove/host-daemon.mjs
#   - Writes a launchd agent that keeps it alive across reboots
#   - Ensures `tailscale funnel` is active for the webhook port
#
# Requirements: node 18+, docker, git, tailscale (logged in), gh (authenticated).
set -euo pipefail

REPO="${GROVE_REPO:-kod88vn/grove}"
REPO_URL="https://github.com/${REPO}"
GROVE_HOME="${GROVE_HOME:-$HOME/.grove}"
CHECKOUT_DIR="${CHECKOUT_DIR:-$GROVE_HOME/checkout}"
DAEMON_PORT="${DAEMON_PORT:-8080}"
NODE_BIN="$(command -v node || true)"
DOCKER_BIN="$(command -v docker || true)"
DOCKER_DIR=""
[ -n "$DOCKER_BIN" ] && DOCKER_DIR="$(dirname "$DOCKER_BIN")"
PLIST="$HOME/Library/LaunchAgents/com.grove.host-daemon.plist"
LABEL="com.grove.host-daemon"

[ -n "$NODE_BIN" ] || { echo "node not found in PATH — install Node 18+ first"; exit 1; }
if [ -z "$DOCKER_BIN" ]; then
  echo "WARNING: docker not found in PATH — deploys cannot build images (install Docker/OrbStack/Colima first)"
else
  echo "docker      : $DOCKER_BIN (dir added to launchd PATH)"
fi
command -v tailscale >/dev/null || echo "WARNING: tailscale not found — webhook will be unavailable, polling still works"
command -v gh >/dev/null || echo "WARNING: gh not found — daemon cannot poll GitHub or report status"

echo "=== Grove host installer ==="
echo "repo        : $REPO"
echo "grove home  : $GROVE_HOME"
echo "checkout    : $CHECKOUT_DIR"
echo "node        : $NODE_BIN"

# ── layout ────────────────────────────────────────────────────────────────────
mkdir -p "$GROVE_HOME/logs" "$CHECKOUT_DIR"
REPO_ROOT="$(cd "$(dirname "$0")/.." && cd .. && pwd)"
cp "$REPO_ROOT/ops/deploy/host-daemon.mjs" "$GROVE_HOME/host-daemon.mjs"
chmod 600 "$GROVE_HOME/host.env" 2>/dev/null || true

# ── checkout ──────────────────────────────────────────────────────────────────
if [ ! -d "$CHECKOUT_DIR/.git" ]; then
  echo "cloning $REPO_URL → $CHECKOUT_DIR"
  git clone --single-branch --branch master "$REPO_URL" "$CHECKOUT_DIR"
fi
git -C "$CHECKOUT_DIR" fetch origin master --prune --quiet

# ── host.env ──────────────────────────────────────────────────────────────────
if [ ! -f "$GROVE_HOME/host.env" ]; then
  cp "$REPO_ROOT/ops/deploy/host.env.example" "$GROVE_HOME/host.env"
  chmod 600 "$GROVE_HOME/host.env"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    TOKEN="$(gh auth token)"
    sed -i '' "s|^GITHUB_TOKEN=.*|GITHUB_TOKEN=$TOKEN|" "$GROVE_HOME/host.env" 2>/dev/null \
      || sed -i "s|^GITHUB_TOKEN=.*|GITHUB_TOKEN=$TOKEN|" "$GROVE_HOME/host.env"
  fi
  if ! grep -q '^GROVE_DEPLOY_TOKEN=.\+' "$GROVE_HOME/host.env"; then
    if command -v openssl >/dev/null; then
      DTOKEN="$(openssl rand -hex 32)"
      sed -i '' "s|^GROVE_DEPLOY_TOKEN=.*|GROVE_DEPLOY_TOKEN=$DTOKEN|" "$GROVE_HOME/host.env" 2>/dev/null \
        || sed -i "s|^GROVE_DEPLOY_TOKEN=.*|GROVE_DEPLOY_TOKEN=$DTOKEN|" "$GROVE_HOME/host.env"
      echo
      echo "Generated a deploy token. Set it as the GitHub repo secret with:"
      echo "  gh secret set GROVE_DEPLOY_TOKEN --repo $REPO <<< '$DTOKEN'"
    fi
  fi
  echo "Wrote $GROVE_HOME/host.env — fill in the empty values (LM Studio URL, credentials)."
else
  echo "host.env already exists — leaving it alone"
fi

# ── launchd ───────────────────────────────────────────────────────────────────
mkdir -p "$HOME/Library/LaunchAgents"
NODE_DIR="$(dirname "$NODE_BIN")"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$GROVE_HOME/host-daemon.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$GROVE_HOME</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$NODE_DIR:$DOCKER_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>GROVE_HOME</key>
    <string>$GROVE_HOME</string>
    <key>CHECKOUT_DIR</key>
    <string>$CHECKOUT_DIR</string>
    <key>DAEMON_PORT</key>
    <string>$DAEMON_PORT</string>
  </dict>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$GROVE_HOME/logs/daemon.out.log</string>
  <key>StandardErrorPath</key>
  <string>$GROVE_HOME/logs/daemon.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "launchd agent registered: $LABEL"

# ── funnel ────────────────────────────────────────────────────────────────────
if command -v tailscale >/dev/null 2>&1; then
  tailscale funnel "$DAEMON_PORT" 2>&1 | sed 's/^/  /' || echo "  funnel failed — daemon will retry in the background"
  echo "webhook (once the machine is named via Tailscale): https://<host>.<tailnet>/deploy/\$GROVE_DEPLOY_TOKEN"
  echo "Set the GitHub variable with, e.g.:"
  echo "  gh variable set GROVE_DEPLOY_URL --repo $REPO --value https://<host>.<tailnet>"
fi

echo
echo "=== done ==="
echo "Tail logs : tail -f $GROVE_HOME/logs/daemon.out.log"
echo "Status    : curl -s http://127.0.0.1:$DAEMON_PORT/healthz"
