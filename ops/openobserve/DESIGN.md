# OpenObserve — Technical Design Document

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      All Grove Apps                     │
│  (nora, games, homeworks, shopping-list, reminders)     │
└──────────────┬──────────────────────────────────────────┘
               │ Browser SDK: POST /chat/api/ingest
               ▼
┌─────────────────────────────┐
│  apps/nora/app/api/ingest   │  Central log ingestion endpoint
│         /route.js           │  Forwards to OpenObserve via HTTP JSON
└──────────────┬──────────────┘
               │ HTTP POST → /api/default/logs/_json
               ▼
┌──────────────────────────────────────┐
│  Caddy Reverse Proxy (port 5081)     │
│  - Basic auth: grove-admin           │
│  - No auto-HTTPS (Tailscale internal)│
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  OpenObserve (internal port 5080)    │
│  - Organization: default             │
│  - Stream: grove_all_logs            │
│  - Retention: 90 days                │
│  - Data dir: /data (persistent)      │
└──────────────────────────────────────┘
```

---

## Container Specifications

### OpenObserve

| Parameter | Value |
|-----------|-------|
| Image | `public.ecr.aws/zinclabs/openobserve:latest` |
| Container name | `openobserve-live` |
| Internal port | 5080 (no public mapping) |
| Memory limit | 1G (256M reserved) |
| CPU limit | 0.5 cores |
| Volume | `openobserve-data:/data` (Docker volume, local driver) |
| Restart policy | always |

### Caddy Reverse Proxy

| Parameter | Value |
|-----------|-------|
| Image | `caddy:2.8.4-alpine` |
| Container name | `openobserve-caddy` |
| Public port | 5081 (Tailscale accessible) |
| Memory limit | 64M |
| CPU limit | 0.1 cores |
| Config volume | `./Caddyfile:/etc/caddy/Caddyfile:ro` |
| Restart policy | always |

---

## Log Data Model

### Stream Configuration

All logs from all apps go to a **single stream**: `grove_all_logs`

This is by design — it makes AI troubleshooting simpler because a single query covers all apps. Each log entry carries a `service` field to distinguish the source app.

### Log Entry Schema

```json
{
  "timestamp": "2026-05-20T20:30:00.000Z",
  "level": "error",
  "service": "nora",
  "message": "Ollama API call failed",
  "error": "connection refused to http://grove:11434",
  "stack": "Error: connection refused\n    at callOllama (apps/nora/lib/ollama.js:42)",
  "metadata": {
    "route": "/chat/api/chat",
    "method": "POST",
    "userId": "user@example.com",
    "model": "llama3.2:3b",
    "durationMs": 5023,
    "requestId": "req-a1b2c3d4"
  }
}
```

### Level Values

| Level | When to Use |
|-------|-------------|
| `debug` | Detailed diagnostic info during development (auto-filtered in production) |
| `info` | Normal operational events: API requests, page navigations |
| `warn` | Recoverable issues: slow queries, deprecated API usage, retry attempts |
| `error` | Failures that need attention: Ollama timeouts, DB errors, unhandled exceptions |
| `fatal` | Unrecoverable errors: database corruption, service crash imminent |

### Service Values

| Service | App |
|---------|-----|
| `nora` | Nora chat app |
| `games` | Games app |
| `homeworks` | Homeworks app |
| `shopping-list` | Shopping List app |
| `reminders` | Reminders app |
| `grove` | Grove shell / home page |

---

## API Endpoints

### 1. Log Ingestion (Browser/Client Side)

**Endpoint**: `POST /chat/api/ingest`
**Auth**: None (internal to Grove network)

**Request Body**:
```json
{
  "level": "error",
  "message": "Something went wrong",
  "service": "nora",
  "metadata": { "route": "/chat/api/chat" },
  "timestamp": "2026-05-20T20:30:00Z"
}
```

**Response**:
```json
{ "ok": true }
// or { "error": "...", "status": 400/500 }
```

### 2. AI Log Query (Server-to-Server)

**Endpoint**: `GET /chat/api/nora/logs/query`
**Auth**: None (internal to Grove network, only reachable from sibling apps)

**Query Parameters**:
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `service` | No | (all) | Filter by app name |
| `level` | No | error | Minimum log level (debug, info, warn, error) |
| `limit` | No | 50 | Max results (1-500) |
| `since_minutes` | No | 60 | Look back N minutes from now |

**Response**:
```json
{
  "query": { "service": "nora", "level": "error", "since_minutes": 60 },
  "count": 12,
  "logs": [
    {
      "timestamp": "2026-05-20T20:30:00Z",
      "level": "error",
      "service": "nora",
      "message": "Ollama API call failed",
      "error": "connection refused",
      "stack": "...",
      "metadata": { }
    },
    ...
  ]
}
```

### 3. OpenObserve Direct API (Admin)

**Endpoint**: `http://grove:5081/api/default/...`
**Auth**: Basic (username: `grove-admin`, password in `.env`)

See OpenObserve docs at https://developer.zinc.io for full API reference.

---

## Network Configuration

### Docker Networks

- **Bridge network**: `logging-net` — connects OpenObserve and Caddy
- Containers on this network can reach each other by container name:
  - `http://openobserve:5080` (internal only)
  - Caddy reaches OpenObserve at this address

### External Access

- Only port **5081** is exposed externally (via Caddy)
- All access is through Tailscale MagicDNS at `http://grove:5081`
- Basic auth protects all requests on port 5081

---

## Environment Variables Reference

### OpenObserve Container

| Variable | Default | Description |
|----------|---------|-------------|
| `ZO_ROOT_USER_EMAIL` | `admin@grove.local` | Admin login username |
| `ZO_ROOT_USER_PASSWORD` | (set in .env) | Admin password |
| `ZO_DATA_DIR` | `/data` | Persistent data directory |

### Caddy Container

| Variable | Default | Description |
|----------|---------|-------------|
| `CADDY_BASIC_AUTH_USERNAME` | `grove-admin` | Basic auth username |
| `CADDY_BASIC_AUTH_PASSWORD` | (set in .env) | Basic auth password |

---

## Resource Allocation

Total OpenObserve stack: ~1.07G RAM + 0.6 CPU cores

On a 64GB machine this is negligible. The current reservation is conservative and can be increased if needed for higher log throughput or longer retention.

---

## Security Considerations

1. **Network isolation**: OpenObserve port 5080 has no public mapping — only Caddy can reach it
2. **Basic auth**: All external access requires credentials via Caddy's `basicauth` directive
3. **Tailscale only**: Port 5081 is only reachable on the Tailscale network
4. **No HTTPS needed**: Tailscale encrypts all traffic end-to-end with Noise protocol
5. **Credentials in .env**: Never committed to git; only exist on the production machine
6. **Log redaction**: The logger library (below) does NOT include file contents, user passwords, or Ollama API keys

---

## Integration with Sibling Apps

Each sibling app (games, homeworks, etc.) gets a copy of the logger client:

```javascript
// In any app's lib/logger.js or shared utils:
import { createLogger } from '../../nora/lib/logger'

const logger = createLogger({ service: 'games', level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })

logger.error('game crash', { level: 'error', message: err.message, metadata: { gameId } })
```

The logger automatically sends logs to the central ingestion endpoint (`/chat/api/ingest`), which is proxied through the Platformatic gateway to Nora's API.

---

## Log Retention Policy

- **Default**: 90 days (set via environment; can be changed in OpenObserve UI)
- **Storage**: Local filesystem (Docker volume `openobserve-data`)
- **Growth rate estimate**: ~50MB/month at current log volume (adjust based on actual usage)
- **Monitoring**: Check disk usage via `docker stats openobserve-live`