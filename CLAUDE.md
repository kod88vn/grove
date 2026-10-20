@AGENTS.md

## Aider Workflow (Non-Negotiable — Claude Code only)

**Claude plans and reviews. Aider executes every file change. No exceptions.**

Never use Edit or Write tools on source code files — not for one-liners, not for "quick fixes". The only allowed direct edits are config value tweaks (JSON/YAML, no logic) that are too trivial to warrant an aider invocation.

### Canonical aider invocation

```bash
aider \
  --openai-api-base "$AIDER_LMSTUDIO_API_BASE" \
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

## Code Review & Merging (Free, Agent-Performed)

Review each PR yourself (code-review skill), fix findings, then `gh pr review <n> --approve` and merge when green. CI uses no paid review API; the merge gate (`.github/scripts/merge-gate.mjs`) requires your (human-account) approval on the head SHA plus a green `PR CI` run. Hosting deploys via the host daemon on the grove machine — see `ops/deploy/README.md`.
