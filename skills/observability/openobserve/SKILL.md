# OpenObserve — AI Observability Skill

## Purpose

OpenObserve is Grove's centralized logging infrastructure. It collects logs from **all apps** (Nora, Games, Homeworks, Shopping List, Reminders) into a single searchable store. AI agents use it to diagnose production issues, track error patterns, and verify fixes.

**Access**: `http://grove:5081` (basic auth: `$CADDY_BASIC_AUTH_USERNAME` / `$CADDY_BASIC_AUTH_PASSWORD`) via Tailscale
**API endpoint**: `http://grove:5081/api/default/` (same auth)

---

## Quick Reference

### Query Logs Programmatically (Primary AI Method)

Use Nora's log query endpoint — it abstracts the OpenObserve API:

```
GET /chat/api/nora/logs/query?service=nora&level=error&limit=50&since_minutes=60
```

**Response format**: See [DESIGN.md](../../ops/openobserve/DESIGN.md) for schema.

**Example — check recent errors in Nora**:
```javascript
const res = await fetch('http://grove:3001/chat/api/nora/logs/query?service=nora&level=error&limit=50')
const data = await res.json()
// data.logs[] contains structured error entries with stack traces, timestamps, metadata
```

**Example — check errors across all apps**:
```javascript
const res = await fetch('http://grove:3001/chat/api/nora/logs/query?level=error&limit=100&since_minutes=30')
// Omits service filter → returns errors from all apps in last 30 minutes
```

**Example — check warnings only**:
```javascript
const res = await fetch('http://grove:3001/chat/api/nora/logs/query?level=warn&limit=50')
```

**Example — check specific app + recent**:
```javascript
const res = await fetch('http://grove:3001/chat/api/nora/logs/query?service=games&level=error&limit=25&since_minutes=10')
```

### Query OpenObserve Directly (Advanced)

For complex searches, use the OpenObserve API directly:

```
GET http://grove:5081/api/default/grove_all_logs/_search?sql=true&q=select * from grove_all_logs where level='error' order by timestamp desc limit 50
```

Auth header: `Basic <base64 of $CADDY_BASIC_AUTH_USERNAME:$CADDY_BASIC_AUTH_PASSWORD>`

More conveniently, use curl with `-u`:
```bash
curl -s -u "$CADDY_BASIC_AUTH_USERNAME:$CADDY_BASIC_AUTH_PASSWORD" \
  "http://grove:5081/api/default/grove_all_logs/_search?sql=true&q=SELECT * FROM grove_all_logs WHERE level='error' AND timestamp > now() - INTERVAL '1 hour' ORDER BY timestamp DESC LIMIT 50"
```

---

## Common Troubleshooting Patterns

### Pattern 1: "Something is broken in production"

```
1. GET /chat/api/nora/logs/query?level=error&limit=100&since_minutes=60
2. Group errors by message field — identify the most frequent error signature
3. Check if errors correlate with a specific service, route, or user ID
4. Read stack traces to identify root cause file/line
5. Fix the code, deploy, then re-query to confirm errors stopped
```

### Pattern 2: "Ollama / AI response is slow"

```
1. GET /chat/api/nora/logs/query?service=nora&level=warn&limit=50
2. Look for entries with durationMs > 5000 in metadata
3. Check if specific models are slower than others
4. Verify Ollama container health (docker ps | grep ollama)
```

### Pattern 3: "Database errors"

```
1. GET /chat/api/nora/logs/query?service=nora&level=error&limit=100
2. Filter for messages containing "sqlite" or "db" or better-sqlite3 errors
3. Check if errors indicate disk full, lock contention, or schema mismatch
```

### Pattern 4: "After deployment something is wrong"

```
1. GET /chat/api/nora/logs/query?level=error&limit=200&since_minutes=120
   (Double the window — issues often appear 30-60 min after deploy as traffic ramps)
2. Compare error patterns before and after the commit timestamp in metadata.commitHash
3. Focus on errors that appeared AFTER the deploy time
```

### Pattern 5: "Check if a specific fix worked"

```
1. GET /chat/api/nora/logs/query?service=nora&level=error&limit=50
2. Search for the specific error message that was fixed:
   Use OpenObserve direct SQL search with WHERE message LIKE '%specific_error_text%'
3. If no matching errors in last 2 hours → fix confirmed
```

---

## Log Format Reference

Every log entry contains these fields:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO string | When the log was emitted |
| `level` | enum | debug, info, warn, error, fatal |
| `service` | string | App name: nora, games, homeworks, shopping-list, reminders, grove |
| `message` | string | Human-readable description |
| `error` | string \| null | Error message / reason |
| `stack` | string \| null | Full stack trace (errors only) |
| `metadata` | object | Context: route, method, userId, durationMs, model, requestId, etc. |

---

## When to Use OpenObserve (AI Agent Rules)

1. **Every bug report** — Always query logs before attempting a fix
2. **Before assuming root cause** — Verify with actual log data, not speculation
3. **After every fix** — Re-query logs to confirm the error stopped occurring
4. **During code review of bug fixes** — Include log evidence in PR comments
5. **For performance issues** — Query for high `durationMs` values, not just errors

### Rules:
- **NEVER** ignore error logs — if an error appears, investigate it
- **ALWAYS** include the query parameters in your analysis (what window you checked, what filters)
- **PREFER** the Nora log query endpoint over direct OpenObserve API (it's simpler and more reliable)
- **INCLUDE** relevant log excerpts when documenting bug fixes in PR comments

---

## Log Ingestion from Apps

### Browser-Side (Client Logging)

When a JavaScript error occurs in any app's browser:
1. The logger catches `window.onerror`, `unhandledrejection`, and navigation errors
2. Logs are sent to `/chat/api/ingest` (Nora's ingestion endpoint)
3. The ingestion endpoint batches and forwards to OpenObserve

### Server-Side (API Routes)

Every API route should wrap with logging:
```javascript
const startTime = Date.now()
try {
  // ... route logic
} catch (err) {
  logger.error(err.message, { error: err.message, stack: err.stack, metadata })
  return Response.json({ error: 'Internal error' }, { status: 500 })
} finally {
  logger.info('request completed', { metadata: { durationMs: Date.now() - startTime } })
}
```

### Ollama Calls

Every call to Ollama should be logged:
- **info**: model, prompt tokens, completion tokens, durationMs on success
- **error**: error message, stack, model on failure

```javascript
const t = Date.now()
try {
  const res = await callOllama(...)
  logger.info('ollama response', { metadata: { model, durationMs: Date.now()-t } })
} catch (err) {
  logger.error('ollama error', { metadata: { model, durationMs: Date.now()-t }, error: err.message })
}
```

---

## Dashboard Setup (Manual, via OpenObserve UI)

Once per setup, create these dashboards for quick visual access:

### Dashboard 1: "Grove System Health"
- **Panel A**: Error count by service (bar chart, last 24h)
- **Panel B**: Request latency p50/p95/p99 histogram (line chart, last 6h)
- **Panel C**: Top 5 error messages (table, last 24h)

### Dashboard 2: "Ollama Performance"
- **Panel A**: Average response time by model (bar chart)
- **Panel B**: Ollama error count over time (line chart)
- **Panel C**: Failed model names (table, last 24h)

### Dashboard 3: "Error Digest"
- **Panel A**: All errors grouped by message (table, last 7 days)
- **Panel B**: Error count per app (pie chart)
- **Panel C**: First vs last seen for each error group

---

## Related Files

| File | Purpose |
|------|---------|
| [DESIGN.md](../../ops/openobserve/DESIGN.md) | Technical architecture, API schemas, network config |
| [SETUP.md](../../ops/openobserve/SETUP.md) | Machine setup, daily operations, backup procedures |
| [docker-compose.yml](../../ops/openobserve/docker-compose.yml) | Container definitions, resource limits |
| [Caddyfile](../../ops/openobserve/Caddyfile) | Reverse proxy config with basic auth |
| [logger.js](../../../apps/nora/lib/logger.js) | Shared logger client used by all apps |
| [ingest/route.js](../../../apps/nora/app/api/ingest/route.js) | Central log ingestion API |
| [logs/query/route.js](../../../apps/nora/app/api/nora/logs/query/route.js) | AI-friendly log query endpoint |

---

## Troubleshooting OpenObserve Itself

### OpenObserve container won't start
```bash
docker compose --env-file ops/openobserve/.env logs openobserve
# Check for port conflicts, disk space, or permission errors
```

### No logs appearing in OpenObserve
1. Verify ingestion endpoint works: `curl -X POST http://grove:3001/chat/api/ingest`
2. Check that `grove_all_logs` stream exists in OpenObserve UI
3. Verify the app is actually emitting logs (check server-side logs)

### OpenObserve API returns 401
- Basic auth credentials are in `ops/openobserve/.env`
- Username: `grove-admin`, password from file

### OpenObserve API returns 403
- Stream doesn't exist yet. The first log write auto-creates it.
- Or the organization name differs. Default is `default`.

---

## Configuration Quick Reference

| Setting | Value | Location |
|---------|-------|----------|
| OpenObserve URL (internal) | `http://openobserve:5080` | docker-compose.yml |
| OpenObserve URL (external) | `http://grove:5081` | Caddyfile, Tailscale network |
| API URL for log ingestion | `/chat/api/ingest` | All apps → Nora proxy |
| API URL for log query | `/chat/api/nora/logs/query` | AI agents → Nora proxy |
| Basic auth user | `grove-admin` | .env, Caddyfile |
| Log stream name | `grove_all_logs` | Auto-created on first write |
| Retention | 90 days | Environment variable in docker-compose.yml |