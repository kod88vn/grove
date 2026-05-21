#!/usr/bin/env python3
"""AI code quality gate for Husky pre-commit. Reads staged diff and rejects blocking violations."""
import json
import os
import re
import subprocess
import sys

import anthropic

try:
    with open("AGENTS.md") as f:
        _agents_md = f.read()
except FileNotFoundError:
    raise RuntimeError("AGENTS.md not found — cannot run AI review without project standards")

SYSTEM_PROMPT = f"""You are a strict code reviewer for the Grove monorepo. Your job is to catch real problems before they are committed.

## Grove Project Standards

The following are the authoritative project standards from AGENTS.md.
Enforce every rule marked "(Non-Negotiable)" as a blocking issue.

{_agents_md}

## Response Format

Respond with ONLY a JSON object (no markdown fences, no prose):
{{
  "verdict": "APPROVE" | "REQUEST_CHANGES",
  "issues": [
    {{
      "severity": "blocking" | "warning",
      "file": "path/to/file.js",
      "line": 42,
      "description": "Clear description of the problem and how to fix it"
    }}
  ]
}}

Rules:
- APPROVE if zero blocking issues
- REQUEST_CHANGES if ANY blocking issue exists
- Blocking: security holes, missing tests for non-trivial bug fixes, SQLite violations, Ollama violations, silent failures, side-by-side test violations
- Warning: style, minor inefficiencies, non-critical violations
- Do not invent issues. Only flag real problems visible in the diff.
"""


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("ai-precommit: ANTHROPIC_API_KEY not set — skipping", file=sys.stderr)
        sys.exit(0)

    result = subprocess.run(["git", "diff", "--cached"], capture_output=True, text=True)
    diff = result.stdout

    if not diff.strip():
        sys.exit(0)

    truncated = False
    if len(diff) > 80_000:
        diff = diff[:80_000]
        truncated = True

    changed_files = "\n".join(re.findall(r"^diff --git a/(.+) b/", diff, re.MULTILINE))

    user_message = f"""Review these staged changes for Grove project standard violations:

**Changed files**:
{changed_files}

**Diff**{"  *(truncated at 80k chars)*" if truncated else ""}:
```diff
{diff}
```
"""

    print("ai-precommit: reviewing staged changes...", file=sys.stderr)

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    response_text = message.content[0].text.strip()

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", response_text, re.DOTALL)
        result = json.loads(match.group()) if match else None

    if result is None:
        print(
            "ai-precommit: ERROR — malformed response from Claude; commit gate FAILS.",
            file=sys.stderr,
        )
        print(
            "ai-precommit: Set SKIP_AI_REVIEW=1 to bypass, or ensure your API key is valid.",
            file=sys.stderr,
        )
        sys.exit(1)

    blocking = [i for i in result.get("issues", []) if i.get("severity") == "blocking"]

    if blocking:
        print("\nai-precommit: COMMIT REJECTED — blocking issues found:\n", file=sys.stderr)
        for issue in blocking:
            loc = issue.get("file", "")
            if issue.get("line"):
                loc += f":{issue['line']}"
            print(f"  ✗ {loc}: {issue.get('description', '')}", file=sys.stderr)
        print("\nFix the issues above or run with SKIP_AI_REVIEW=1 to bypass.\n", file=sys.stderr)
        sys.exit(1)

    print("ai-precommit: no blocking issues found.", file=sys.stderr)
    sys.exit(0)


if __name__ == "__main__":
    main()
