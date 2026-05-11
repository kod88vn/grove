# Configuration

| Variable | Used in | Default |
|----------|---------|---------|
| `DEFAULT_MODEL` | `app/api/chat/lib/constants.js` | `qwen3.5:9b` |
| `NEXT_PUBLIC_DEFAULT_MODEL` | `app/page.js` | `qwen3.5:9b` |
| `ROLLING_WINDOW` | `constants.js` | `20` |
| `RECENT_KEEP` | `constants.js` | `10` |
| `MAX_TOOL_PLANNING_PASSES` | `constants.js` | `3` |
| `NORA_DB_PATH` | `lib/db/db.js` | `<cwd>/data/nora.db` |
| `ORCHESTRATOR_URL` | `orchestratorClient.js` | `http://127.0.0.1:4010` |
| `OLLAMA_HOST` | `app/api/chat/lib/ollama.js` | `http://grove:11434` |
| `HOMEWORKS_OLLAMA_MODEL` | `app/api/nora-homework/exercise/route.js` | `DEFAULT_MODEL` |

`/api/models` proxies `http://grove:11434/api/tags` and keeps `DEFAULT_MODEL` first.
