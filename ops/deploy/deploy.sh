#!/usr/bin/env bash
# Grove host deploy — runs ON the grove machine (the Mac that hosts the site).
#
# Invoked by ops/deploy/host-daemon.mjs with one argument: the commit SHA to deploy
# (default: latest master). It is executed from a dedicated checkout that this script
# updates to the target SHA, so each deploy always uses the deploy script that ships
# in the commit being deployed.
#
# Environment comes from ~/.grove/host.env (loaded by the daemon):
#   LMSTUDIO_BASE_URL, MODEL, AI_PROVIDER, GROVE_LOCATION, NORA_DB_PATH,
#   OPENOBSERVE_ROOT_USER_EMAIL/PASSWORD, CADDY_BASIC_AUTH_USERNAME/PASSWORD,
#   GROVE_REPO, CHECKOUT_DIR
set -euo pipefail

SHORT_ARG="${1:-}"
GROVE_REPO="${GROVE_REPO:-kod88vn/grove}"
CHECKOUT_DIR="${CHECKOUT_DIR:-$HOME/.grove/checkout}"
LOG_PREFIX="grove-deploy"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
fail() { log "FATAL: $*"; report_to_github "failure" "$*" "${DEPLOY_SHA:-}"; exit 1; }

DEPLOY_SHA=""
report_to_github() {
  local state="$1" desc="${2:-}" sha="${3:-$DEPLOY_SHA}"
  [ -n "$sha" ] && [ -n "${GITHUB_TOKEN:-}" ] || return 0
  curl -sS -o /dev/null -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$GROVE_REPO/statuses/$sha" \
    -d "$(cat <<JSON
{ "context": "grove-host/deploy", "state": "$state", "description": "${desc:0:140}", "target_url": "https://github.com/$GROVE_REPO/commits/$sha" }
JSON
)" || log "could not report status to GitHub (non-fatal)"
}

# ── 1. Resolve target SHA ──────────────────────────────────────────────────────
if [ -n "$SHORT_ARG" ]; then
  DEPLOY_SHA="$SHORT_ARG"
else
  DEPLOY_SHA=$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN:-}" \
    "https://api.github.com/repos/$GROVE_REPO/commits/master" | sed -n 's/.*"sha": "\([a-f0-9]\{40\}\)".*/\1/p' | head -1)
  [ -n "$DEPLOY_SHA" ] || fail "could not resolve latest master SHA"
fi
DEPLOY_SHORT="${DEPLOY_SHA:0:12}"
log "deploying $DEPLOY_SHA ($DEPLOY_SHORT)"
report_to_github "pending" "grove host: starting deploy of $DEPLOY_SHORT"

# ── 2. Checkout the exact commit ───────────────────────────────────────────────
[ -d "$CHECKOUT_DIR/.git" ] || git clone "https://github.com/$GROVE_REPO" "$CHECKOUT_DIR"
git -C "$CHECKOUT_DIR" fetch origin --prune --quiet
git -C "$CHECKOUT_DIR" checkout --quiet "$DEPLOY_SHA"
git -C "$CHECKOUT_DIR" reset --hard --quiet "$DEPLOY_SHA"
log "checked out $DEPLOY_SHORT"

# ── 3. Build the Docker image ──────────────────────────────────────────────────
# node:22-alpine has native arm64 builds; no cross-compile needed on Apple Silicon.
docker build -q \
  --build-arg COMMIT_HASH="$DEPLOY_SHORT" \
  --build-arg COMMIT_DATE="$(git -C "$CHECKOUT_DIR" log -1 --format=%cd)" \
  -t "grove:$DEPLOY_SHORT" -t grove:latest \
  "$CHECKOUT_DIR" > /dev/null
log "built grove:$DEPLOY_SHORT"

# ── 4. OpenObserve logging stack (idempotent) ─────────────────────────────────
if [ -f "$CHECKOUT_DIR/ops/openobserve/docker-compose.yml" ]; then
  (
    cd "$CHECKOUT_DIR/ops/openobserve"
    # Caddy needs a bcrypt hash; hash a plain value if that is what the env holds.
    if [ -n "${CADDY_BASIC_AUTH_PASSWORD:-}" ] && ! printf '%s' "$CADDY_BASIC_AUTH_PASSWORD" | grep -q '^\$2[aby]\$'; then
      CADDY_BASIC_AUTH_PASSWORD=$(docker run --rm httpd:2.4-alpine htpasswd -nbB -C 10 "${CADDY_BASIC_AUTH_USERNAME:-grove-admin}" "$CADDY_BASIC_AUTH_PASSWORD" | sed 's/.*:\(.*\)/\1/')
      export CADDY_BASIC_AUTH_PASSWORD
    fi
    docker compose --profile default up -d --quiet-pull 2>/dev/null || docker compose up -d
  )
  log "openobserve stack up (http://grove:5081)"
fi

# ── 5. Swap the live app container ─────────────────────────────────────────────
docker volume create nora-data > /dev/null
docker rm -f grove-live > /dev/null 2>&1 || true

docker run -d --name grove-live --restart always \
  -p 80:80 \
  -e NODE_ENV=production \
  -e NORA_DB_PATH="${NORA_DB_PATH:-/data/nora.db}" \
  -e AI_PROVIDER="${AI_PROVIDER:-lmstudio}" \
  -e MODEL="${MODEL:-qwen/qwen3.8-27b}" \
  -e LMSTUDIO_BASE_URL="${LMSTUDIO_BASE_URL:-http://host.docker.internal:1234/v1}" \
  -e GROVE_LOCATION="${GROVE_LOCATION:-}" \
  -v nora-data:/data \
  "grove:$DEPLOY_SHORT" > /dev/null
log "started grove-live on :80"

# ── 6. Health checks ───────────────────────────────────────────────────────────
ok=""
for i in $(seq 1 12); do
  sleep 5
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1/ || true)
  if [ "$CODE" = "200" ]; then ok="yes"; break; fi
done
[ "$ok" = "yes" ] || fail "app did not return 200 on :80 after 60s (last HTTP $CODE)"
log "app healthy on :80"

OO_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:5081/ || true)
log "openobserve :5081 → HTTP $OO_CODE (informational)"

# ── 7. Pre-warm the local model (non-fatal) ────────────────────────────────────
if [ -n "${LMSTUDIO_BASE_URL:-}" ]; then
  if curl -s --max-time 300 "${LMSTUDIO_BASE_URL%/}/chat/completions" \
      -H 'content-type: application/json' \
      -d "{\"model\":\"${MODEL:-qwen/qwen3.8-27b}\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"max_tokens\":1}" \
      > /dev/null 2>&1; then
    log "model ${MODEL} loaded and responding"
  else
    log "WARNING: model pre-warm failed — first real chat may be slow (model load)"
  fi
fi

# ── 8. Prune dangling images, record state ────────────────────────────────────
# (state.json belongs to the daemon — record this deploy in a separate file.)
docker image prune -f > /dev/null 2>&1 || true
mkdir -p "${GROVE_HOME:-$HOME/.grove}"
cat > "${GROVE_HOME:-$HOME/.grove}/last-deploy.json" <<JSON
{ "sha": "$DEPLOY_SHA", "short": "$DEPLOY_SHORT", "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)", "status": "success" }
JSON

log "deploy of $DEPLOY_SHORT complete"
report_to_github "success" "grove host: $DEPLOY_SHORT live"
exit 0
