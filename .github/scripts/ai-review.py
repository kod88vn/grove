#!/usr/bin/env python3
"""Real AI code review for Grove PRs using Claude."""
import json
import os
import re
import sys

import anthropic

SYSTEM_PROMPT = """You are a strict code reviewer for the Grove monorepo. Your job is to catch real problems.

## Grove Project Standards (enforce these)

1. **BDD Bug Fixes** — bug fixes MUST include a failing test written first; no test = blocking issue
2. **Side-by-Side Tests** — test files live next to production code (`foo.js` → `foo.test.js`)
   - NO `test/`, `__tests__/`, or separate test directories
   - EXCEPTION: never write tests for `lib/db/*` (SQLite native module — unreliable in CI)
3. **No Silent Failures** — never suppress errors, return empty fallbacks, or mask failures
4. **Ollama Access Pattern** — ONLY `apps/nora` may call `http://grove:11434` directly
   - Other apps must call Nora's API routes via `PLT_NORA_URL`
   - `OLLAMA_HOST`, `OLLAMA_BASE_URL`, or direct Ollama fetches in non-Nora apps = blocking
5. **Homeworks Data Persistence** — SQLite ONLY via `apps/homeworks/lib/db.js`
   - File-based JSON, in-memory Maps, or ad-hoc storage = blocking
6. **Security** — no XSS, SQL injection, command injection, eval() on user input, or hardcoded secrets
7. **User-facing text** — say "Nora", never "AI" in UI strings
8. **Keep Nora Thin** — major features belong in sibling apps, not `apps/nora`
9. **No unnecessary comments** — only WHY comments when non-obvious; no docblocks explaining WHAT
10. **Routing changes** — new top-level routes need updates in BOTH gateway config AND grove dev rewrites

## Response Format

Respond with ONLY a JSON object (no markdown fences, no prose):
{
  "verdict": "APPROVE" | "REQUEST_CHANGES",
  "summary": "One sentence describing what this PR does",
  "issues": [
    {
      "severity": "blocking" | "warning",
      "file": "path/to/file.js",
      "line": 42,
      "description": "Clear description of the problem and how to fix it"
    }
  ],
  "praise": "One sentence on what was done well (optional, omit if nothing notable)"
}

Rules:
- APPROVE if zero blocking issues (warnings are OK to approve)
- REQUEST_CHANGES if ANY blocking issue exists
- Blocking: security holes, missing tests for non-trivial bug fixes, SQLite violations, Ollama violations, silent failures
- Warning: style, minor inefficiencies, non-critical violations
- Do not invent issues. Only flag real problems visible in the diff.
"""


def build_review_markdown(result: dict) -> str:
    verdict = result.get("verdict", "REQUEST_CHANGES")
    lines = [
        "## AI Code Review",
        "",
        f"**Verdict**: {'✅ APPROVED' if verdict == 'APPROVE' else '❌ CHANGES REQUESTED'}",
        "",
        f"**Summary**: {result.get('summary', '')}",
        "",
    ]

    issues = result.get("issues", [])
    blocking = [i for i in issues if i.get("severity") == "blocking"]
    warnings = [i for i in issues if i.get("severity") == "warning"]

    if blocking:
        lines += ["### Blocking Issues", ""]
        for issue in blocking:
            loc = issue.get("file", "")
            if issue.get("line"):
                loc += f":{issue['line']}"
            lines.append(f"- **{loc}**: {issue.get('description', '')}")
        lines.append("")

    if warnings:
        lines += ["### Warnings", ""]
        for issue in warnings:
            loc = issue.get("file", "")
            if issue.get("line"):
                loc += f":{issue['line']}"
            lines.append(f"- **{loc}**: {issue.get('description', '')}")
        lines.append("")

    praise = result.get("praise", "")
    if praise:
        lines += ["### What's Good", praise, ""]

    lines += [
        "---",
        "*Reviewed by Claude — fix blocking issues and push to re-trigger*",
    ]
    return "\n".join(lines)


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set — cannot run AI review", file=sys.stderr)
        sys.exit(1)

    diff_path = "/tmp/pr.diff"
    try:
        diff = open(diff_path).read()
    except FileNotFoundError:
        diff = ""

    if not diff.strip():
        result = {
            "verdict": "APPROVE",
            "summary": "No file changes detected in diff",
            "issues": [],
        }
        _write_outputs(result)
        return

    # Truncate diff to stay within token limits (~80k chars ≈ ~20k tokens)
    truncated = False
    if len(diff) > 80_000:
        diff = diff[:80_000]
        truncated = True

    pr_title = os.environ.get("PR_TITLE", "(no title)")
    pr_body = os.environ.get("PR_BODY", "(no description)")
    pr_author = os.environ.get("PR_AUTHOR", "unknown")
    changed_files = "\n".join(
        re.findall(r"^diff --git a/(.+) b/", diff, re.MULTILINE)
    )

    user_message = f"""Review this pull request:

**Title**: {pr_title}
**Author**: {pr_author}
**Description**: {pr_body}

**Changed files**:
{changed_files}

**Diff**{"  *(truncated at 80k chars)*" if truncated else ""}:
```diff
{diff}
```
"""

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    response_text = message.content[0].text.strip()

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group())
            except json.JSONDecodeError:
                result = None
        else:
            result = None

    if result is None:
        result = {
            "verdict": "REQUEST_CHANGES",
            "summary": "AI review failed to produce valid JSON — human review required",
            "issues": [
                {
                    "severity": "blocking",
                    "file": "N/A",
                    "description": f"Malformed AI response (first 300 chars): {response_text[:300]}",
                }
            ],
        }

    _write_outputs(result)


def _write_outputs(result: dict):
    verdict = result.get("verdict", "REQUEST_CHANGES")

    github_output = os.environ.get("GITHUB_OUTPUT", "")
    if github_output:
        with open(github_output, "a") as f:
            f.write(f"verdict={verdict}\n")

    review_md = build_review_markdown(result)
    with open("/tmp/review_body.md", "w") as f:
        f.write(review_md)

    print(f"\nVerdict: {verdict}")
    print(review_md)


if __name__ == "__main__":
    main()
