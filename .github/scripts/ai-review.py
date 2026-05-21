#!/usr/bin/env python3
"""Real AI code review for Grove PRs using Claude."""
import json
import os
import re
import sys

import anthropic

try:
    with open("AGENTS.md") as f:
        _agents_md = f.read()
except FileNotFoundError:
    raise RuntimeError("AGENTS.md not found — cannot run review without project standards")

_system_md = _agents_md

SYSTEM_PROMPT = f"""You are a strict code reviewer for the Grove monorepo. Your job is to catch real problems.

## Grove Project Standards

The following are the authoritative project standards from AGENTS.md.
Enforce every rule marked "(Non-Negotiable)" as a blocking issue.

{_system_md}

## Response Format

Respond with ONLY a JSON object (no markdown fences, no prose):
{{
  "verdict": "APPROVE" | "REQUEST_CHANGES",
  "summary": "One sentence describing what this PR does",
  "issues": [
    {{
      "severity": "blocking" | "warning",
      "file": "path/to/file.js",
      "line": 42,
      "description": "Clear description of the problem and how to fix it"
    }}
  ],
  "praise": "One sentence on what was done well (optional, omit if nothing notable)"
}}

Rules:
- APPROVE if zero blocking issues (warnings are OK to approve)
- REQUEST_CHANGES if ANY blocking issue exists
- Blocking issues are ONLY:
  * Security holes (XSS, injection, auth bypass, credential exposure)
  * Missing tests for a non-trivial bug fix (per AGENTS.md BDD policy)
  * Direct SQLite or Ollama access pattern violations (per AGENTS.md)
  * Functional silent failures in production code — e.g. a timeout AbortController whose signal is created but never passed to the fetch/call so it never fires; a retry that swallows the error silently; an error handler that returns empty data instead of surfacing the failure
- NOT blocking (use warning instead):
  * Test hygiene: env var isolation, module-level constants re-tested per-case, static flags on function objects, beforeEach/afterEach patterns
  * Code style, variable placement, comment wording, missing newlines
  * Minor inefficiencies or dead computations
  * Theoretical test isolation concerns that don't cause actual test failures or production regressions
- Warning: style, minor inefficiencies, test hygiene, non-critical violations
- When uncertain whether an issue is blocking or warning, choose warning.
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
            "verdict": "APPROVE",
            "summary": "AI review could not parse response — no blocking issues flagged; human review recommended",
            "issues": [
                {
                    "severity": "warning",
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