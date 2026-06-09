# Aider + LM Studio Config

## Endpoint
- Base URL: `http://192.168.68.121:1234/v1`
- API key: `lm-studio` (placeholder, LM Studio ignores it)

## Models (in preference order for coding tasks)
- `openai/qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx` — primary
- `openai/kimi-dev-72b-dwq` — alternative if Qwen drifts
- `openai/openai/gpt-oss-120b` — heavy lifting

## Canonical Invocation

```bash
aider \
  --openai-api-base http://192.168.68.121:1234/v1 \
  --openai-api-key lm-studio \
  --model openai/qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx \
  --yes \
  --no-auto-commits \
  --file <path> \
  --message "<precise instruction>"
```

`--no-auto-commits` keeps git state clean so Claude can review the full diff before committing.

## Review Commands (run after each aider invocation)
```bash
git diff          # full diff
git diff --stat   # scope check
yarn build        # must compile per AGENTS.md
```
