@AGENTS.md

## Aider Workflow (Non-Negotiable — Claude Code only)

**Claude plans and reviews. Aider executes every file change. No exceptions.**

Never use Edit or Write tools on source code files — not for one-liners, not for "quick fixes". The only allowed direct edits are config value tweaks (JSON/YAML, no logic) that are too trivial to warrant an aider invocation.

### Canonical aider invocation

```bash
aider \
  --openai-api-base http://192.168.68.121:1234/v1 \
  --openai-api-key lm-studio \
  --model openai/qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx \
  --yes \
  --no-auto-commits \
  --file <specific-file(s)> \
  --message "<precise instruction: file path, what to change, exact behavior, what NOT to touch>"
```

Full reference: [`.claude/aider-config.md`](.claude/aider-config.md)

### After every aider run
```bash
git diff          # verify the diff matches intent
git diff --stat   # confirm only listed files were touched
```
