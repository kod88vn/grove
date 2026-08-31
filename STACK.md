# STACK.md — Verified Fact Ledger

> Every row was confirmed by running the cited command or reading the cited file on the stated
> date. **Never add a row from memory.** If you cannot cite a source, do not add the row.
> Re-verify any row older than 90 days before relying on it.

## How To Use This File

- Read this before stating any version, flag, endpoint, or CLI option.
- If the fact you need is absent, verify it against the real source, then add a row.
- If a row contradicts the source, the source wins — fix the row in the same change.

## Runtime

| Fact | Value | Verified on | Source |
| --- | --- | --- | --- |
| Node version | `v24.18.0` | 2026-08-28 | `node --version` |
| Node install path | `~/.nvm/versions/node/v24.18.0/bin` | 2026-08-28 | `which copilot` |
| Package manager | **none yet** — no `package.json` exists; P0 creates it | 2026-08-28 | `ls /Users/jay.quach/dev/bot` |

## Database

| Fact | Value | Verified on | Source |
| --- | --- | --- | --- |
| `node:sqlite` availability | Built in; **no `--experimental-*` flag, no ExperimentalWarning** | 2026-08-28 | `node -e "require('node:sqlite')"` |
| `node:sqlite` exports | `DatabaseSync`, `StatementSync`, `Session`, `constants`, `backup` | 2026-08-28 | `Object.keys(require('node:sqlite'))` |
| Bundled SQLite version | `3.53.1` | 2026-08-28 | `SELECT sqlite_version()` |
| WAL mode | `PRAGMA journal_mode=WAL` returns `wal` on a file-backed DB | 2026-08-28 | verified on `/tmp/waltest.db` |
| `busy_timeout` | Settable; read back as `5000` | 2026-08-28 | `PRAGMA busy_timeout` |
| `user_version` | Settable and readable — usable for migrations | 2026-08-28 | `PRAGMA user_version=3` |
| FTS5 | **Available** — `CREATE VIRTUAL TABLE … USING fts5` + `MATCH` work | 2026-08-28 | in-memory DB test |
| json1 | Available — `json_extract` works | 2026-08-28 | in-memory DB test |

## Tooling

| Fact | Value | Verified on | Source |
| --- | --- | --- | --- |
| GitHub CLI | `2.97.0` | 2026-08-28 | `gh --version` |
| GitHub host | `github.corp.clover.com`, account `jay-quach` | 2026-08-28 | `gh auth status` |
| Git protocol | **ssh** | 2026-08-28 | `gh auth status` |
| GitHub token scopes | `admin:public_key`, `gist`, `read:org`, `repo` | 2026-08-28 | `gh auth status` |
| `jq` | present at `/usr/bin/jq` | 2026-08-28 | `which jq` |
| Copilot CLI | Installed `1.0.81` — **BLOCKED by org policy, unusable** | 2026-08-28 | `copilot --version`, then `copilot -p …` |
| Copilot CLI non-interactive | Fails: `Error: Access denied by policy settings (Request ID: 5A74:32B222:30F7C3:36D5A4:6A91D982)`, exit 1 | 2026-08-28 | `copilot -p "…" --allow-all-tools` in an empty dir |
| Alternative agent CLIs | **None installed**: `claude`, `codex`, `aider`, `cursor-agent`, `gemini`, `ollama`, `llm` | 2026-08-28 | `command -v <name>` |
| Headless LLM access | **None available to this machine** | 2026-08-28 | derived from the three rows above |

### Copilot CLI flags — documented, never successfully exercised

Read from `copilot --help` (1.0.81) before the policy block was discovered. **Do not write code
against these.** The binary refuses every non-interactive request, so none of these flags has
been observed to do anything. Retained only so a future re-test knows what to try.

| Flag | Behaviour per `--help` | Read on |
| --- | --- | --- |
| `-p, --prompt` | Non-interactive scripting mode | 2026-08-28 |
| `--allow-all-tools` | **Required** for non-interactive mode; env `COPILOT_ALLOW_ALL` | 2026-08-28 |
| `--allow-tool[=tools...]` | Allowlist specific tools | 2026-08-28 |
| `--allow-all` | `--allow-all-tools` + `--allow-all-paths` + `--allow-all-urls` | 2026-08-28 |
| `--add-dir <directory>` | Grant file access to a directory; loads its `.github/skills` and `.github/agents` | 2026-08-28 |
| `--agent <agent>` | Select a custom agent | 2026-08-28 |
| `--assisted-approval` | Safety judge; **takes precedence over `--allow-all-tools`**; needs `--experimental` or `enabledFeatureFlags.AUTO_APPROVAL`; env `COPILOT_ASSISTED_APPROVAL` | 2026-08-28 |

### Chat customization discovery (this repo)

| Fact | Value | Verified on | Source |
| --- | --- | --- | --- |
| Agent discovery paths | `.copilot-config/agents`, `.github/agents` (both under `chat.promptFilesLocations`) | 2026-08-28 | `.vscode/settings.json` |
| Skill discovery path | `.copilot-config/skills` | 2026-08-28 | `.vscode/settings.json` |
| Instruction discovery paths | `.copilot-config/instructions`, `.github/instructions` | 2026-08-28 | `.vscode/settings.json` |
| `.github/` | **Does not exist yet** — created when the first bot agent is written (P10+) | 2026-08-28 | `ls -a .github` |
| Shared agents present | 8: `builder`, `code-reviewer`, `docs-researcher`, `milestone-verifier`, `planner`, `reviewer`, `spec-lookup`, `validator` | 2026-08-28 | `ls .copilot-config/agents/` |

## Scheduling (launchd)

| Fact | Value | Verified on | Source |
| --- | --- | --- | --- |
| `~/Library/LaunchAgents` | Empty — no conflicting agents | 2026-08-28 | `ls ~/Library/LaunchAgents` |
| `StartInterval` + sleep | Interval **is missed** if the system is asleep ("due to shortcomings in kqueue(3)") | 2026-08-28 | `man launchd.plist`, ~line 349 |
| `StartCalendarInterval` + sleep | Job **starts on next wake**; multiple missed intervals **coalesce into one event** | 2026-08-28 | `man launchd.plist`, ~line 363 |
| Interaction | `StartInterval` and `StartCalendarInterval` are evaluated **independently** and are not aware of each other | 2026-08-28 | `man launchd.plist`, ~line 368 |

## Environment Variables

| Name | Required | Purpose | Verified on | Source |
| --- | --- | --- | --- | --- |
| `JIRA_DC_TOKEN` | yes | Bearer token for Jira Data Center REST v2 | 2026-08-28 | presence checked via `${JIRA_DC_TOKEN:+yes}`; value never read |
| `SLACK_*` | no | **Not set** — no Slack credentials present | 2026-08-28 | `env \| grep -i slack` |

## Local Repositories

| Fact | Value | Verified on | Source |
| --- | --- | --- | --- |
| Watched repo (initial) | `~/dev/web-storefront-engine` | 2026-08-28 | `ls ~/dev` |
| Siblings available | `web-storefront-retail`, `-services`, `-ui`, `-developer-portal`, `-copilot-config` | 2026-08-28 | `ls ~/dev` |
| Shared Copilot config remote | `git@github.corp.clover.com:clover/web-storefront-copilot-config.git` | 2026-08-28 | `git remote -v` in that clone |
| Copilot config Mode A | Installed user-level — `~/.copilot/skills/*` symlink into `~/dev/web-storefront-copilot-config` | 2026-08-28 | `readlink ~/.copilot/skills/brainstorming` |
| Copilot config Mode B | Submodule `.copilot-config`, pinned at `b799aef` | 2026-08-28 | `git -C .copilot-config rev-parse --short HEAD` |
| Shared config has no `package.json` | Guard scripts run under plain `node`, zero dependencies | 2026-08-28 | `.copilot-config/README.md` "Layout" |

## NOT YET VERIFIED — do not state these as fact

These are needed by P3 and must be confirmed against the live system before any parsing code
is written. Prior session notes are **not** sufficient evidence.

| Unknown | What must be checked |
| --- | --- |
| Jira DC search endpoint | Exact path, request shape, pagination, and response field names on `https://jira.corp.clover.com` |
| Jira issue fields | Real names for status, sprint, updated, watcher on this instance |
| `gh pr list --json` fields | Which fields GHE `github.corp.clover.com` actually supports — GHE lags github.com |
| Jira transition ids | Workflow-specific; never hardcode a numeric id without reading it back |

## Known Divergences From Public Defaults

The highest-value section: where this environment does **not** behave the way public
documentation implies, which is exactly where models hallucinate.

| Topic | Public default / common assumption | Here | Source |
| --- | --- | --- | --- |
| `node:sqlite` | Widely documented as experimental, needing `--experimental-sqlite` | Stable in v24.18.0, no flag, no warning | verified 2026-08-28 |
| Hourly cron on macOS | `StartInterval` is the obvious choice | `StartInterval` **loses** runs across sleep; must use `StartCalendarInterval` | `man launchd.plist` |
| GitHub host | `github.com` | `github.corp.clover.com` (GHE) | `gh auth status` |
| GitHub write scopes | `repo` implies broad write | **No `write:org`, no `workflow`** — org and workflow writes will fail | `gh auth status` |
| SQLite `DELETE` | Assumed to free disk space | Does **not** shrink the file; needs checkpoint / `VACUUM` | SQLite behaviour, see DESIGN §8 |
