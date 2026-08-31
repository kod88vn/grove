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
| `.github/` | Exists: `.github/instructions/bot.instructions.md`, telling Chat how to use the MCP server | 2026-09-01 | `ls .github/instructions` |
| Shared agents present | 8: `builder`, `code-reviewer`, `docs-researcher`, `milestone-verifier`, `planner`, `reviewer`, `spec-lookup`, `validator` | 2026-08-28 | `ls .copilot-config/agents/` |

## Scheduling — VS Code tasks (launchd removed)

The hourly `launchd` runner was dropped. Refresh is now manual, interval-driven from the
dashboard server, and best-effort per chat turn via MCP.

| Fact | Value | Verified on | Source |
| --- | --- | --- | --- |
| Auto-start mechanism | `"runOptions": { "runOn": "folderOpen" }` in `.vscode/tasks.json` | 2026-08-31 | VS Code tasks docs, "Run behavior" |
| Auto-task gate | Setting `task.allowAutomaticTasks`: `off` (default, prompts once) or `on`; never runs in an untrusted workspace | 2026-08-31 | VS Code tasks docs |
| Task shell | Tasks run **non-login, non-interactive** — shell startup files do not run, so **nvm is not on `PATH`** | 2026-08-31 | VS Code tasks docs, "Why do I get 'command not found'" |
| Consequence | Any task invoking node must use the absolute path `~/.nvm/versions/node/v24.18.0/bin/node` | 2026-08-31 | derived from the two rows above |
| `~/Library/LaunchAgents` | Empty — nothing installed, nothing to remove | 2026-08-28 | `ls ~/Library/LaunchAgents` |

## Jira Data Center — verified 2026-08-31

Host `https://jira.corp.clover.com`, header `Authorization: Bearer $JIRA_DC_TOKEN`.

| Fact | Value | Source |
| --- | --- | --- |
| Identity | `GET /rest/api/2/myself` -> 200; `name=jay.quach`, `key=JIRAUSER22842` | live probe |
| Search | `POST /rest/api/2/search` with `{jql, maxResults, fields}` -> 200; returns `total`, `startAt`, `maxResults`, `issues[]` | live probe |
| My unresolved issues | 66 (`assignee = currentUser() AND resolution = Unresolved`) | live probe |
| **Agile API works on DC** | `/rest/agile/1.0/board/1386` -> 200. Board is `storefront platform`, type `scrum` | live probe |
| Board columns | `To Do`, `In Progress`, `Done` via `/rest/agile/1.0/board/1386/configuration` | live probe |
| Sprints | `/rest/agile/1.0/board/1386/sprint?state=active\|closed` -> 200. 38 closed; active is id `12388` `Platform_13`, `2026-08-24` -> `2026-09-04` | live probe |
| Sprint issues | `/rest/agile/1.0/board/1386/sprint/12388/issue` -> 200, `total=39` | live probe |
| Board JQL | `/rest/agile/1.0/board/1386/issue?jql=…` accepts JQL -> 200 | live probe |
| Transitions | `GET /rest/api/2/issue/<K>/transitions?expand=transitions.fields` -> 200. On WS-6316: `301` Stop Progress, **`5` Resolve Issue -> Resolved**, `2` Close Issue, `711` Code Review -> In Review, `721`, `751`, `801` | live probe |
| **Resolve required fields** | **`resolution` is the ONLY required field.** `fixVersions` and `customfield_10206` are on the screen but **optional** | `transitions.fields[].required` |
| Resolution values | `Fixed`, `Won't Fix`, `Duplicate`, `Done`, `Cancelled`, … (18 total) | `allowedValues` |
| Custom field ids | `10205` Sprint, `10206` Epic Link, `10207` Epic Name, `10202` Story Points, `12400` Environment_pd | `GET /rest/api/2/field` |

## GitHub Enterprise — verified 2026-08-31

| Fact | Value | Source |
| --- | --- | --- |
| GHE version | **3.21** | error `documentation_url` on a 404 |
| Cross-repo PR search | `gh search prs --author=@me --state=open --json …` works | live probe |
| Search qualifiers | `--author=@me`, `--review-requested=@me`, `--reviewed-by=@me`, `--involves=@me --updated=">=YYYY-MM-DD"` all return results | live probe |
| Review-requested backlog | 20+ open PRs currently request my review | live probe |
| `gh pr list --json` fields | Includes `reviewDecision`, `reviews`, `latestReviews`, `reviewRequests`, `mergeable`, `mergeStateStatus`, `statusCheckRollup`, `autoMergeRequest`, `closingIssuesReferences`, `headRefName`, `baseRefName`, `isDraft`, `mergedAt`, `mergedBy` | `gh pr list --json` with no value |
| `reviewDecision` | `REVIEW_REQUIRED` \| `APPROVED` \| `CHANGES_REQUESTED` | live probe |
| `reviewRequests` | Mixed list of `User` (`login`) and `Team` (`name`, `slug`), discriminated by `__typename` | live probe |
| Repo merge methods | merge, squash, rebase all enabled; `delete_branch_on_merge: true` | `gh api repos/clover/web-storefront-engine` |
| My repo permissions | `admin:false`, `maintain:false`, `push:true`, `triage:true`, `pull:true` | same |
| Branch protection API | **404 Not Found** — requires admin, which I do not have | `gh api …/branches/main/protection` |
| Org-enforced checks | A `JIRA Link` status check exists and gates merge; a `Semantic Title` check exists | `statusCheckRollup` on PR 2390 |

## Model Context Protocol — verified 2026-09-01

Spec pages `modelcontextprotocol.io/specification/2025-06-18/{basic/lifecycle,server/tools}`.
The site states the latest revision is **`2026-07-28`**.

| Fact | Value | Source |
| --- | --- | --- |
| Version negotiation | "If the server supports the requested protocol version, it MUST respond with the same version. Otherwise, the server MUST respond with another protocol version it supports." | spec, lifecycle |
| `initialize` result | `{protocolVersion, capabilities, serverInfo, instructions?}` | spec, lifecycle |
| `tools/list` result | `{tools: [{name, title, description, inputSchema}]}` | spec, tools |
| `tools/call` result | `{content: [{type:'text', text}], isError}` | spec, tools |
| Notifications | Have no `id` and **must not be answered** | spec, lifecycle |
| Error codes used | `-32700` parse, `-32601` method not found, `-32602` invalid params / unknown tool | spec |
| Live handshake | `initialize` → `notifications/initialized` → `tools/list` → `tools/call` all correct against `bot mcp`; `2026-07-28` echoed back; the notification correctly unanswered | live probe |
| VS Code registration | `.vscode/mcp.json`, `{"servers":{"bot":{"type":"stdio","command":…,"args":…}}}` | `.vscode/mcp.json` |
| Spawn shell | Same non-login constraint as tasks — absolute node path required | derived; see Scheduling above |

## NOT YET VERIFIED — do not state these as fact

| Unknown | What must be checked |
| --- | --- |
| Whether `gh pr merge` actually succeeds | Cannot be verified without performing a real merge. `mergeStateStatus` is the best pre-flight signal; treat merge failure as expected and surface the error. |
| Jira transition **write** path | The executor and `prepareResolve` are built and the payload has been produced for real tickets (WS-6114, WS-6326 — `{"resolution":{"name":"Fixed"}}`, transition `5`), but **no live `POST` has been issued**. The write remains unverified until one is. |
| Non-`WS` project behaviour | All probes used project `WS` and board `1386` only. |
| Sprint field on other boards | `customfield_10205` shape was only checked on board 1386 issues. |

## Environment Variables

| Name | Required | Purpose | Verified on | Source |
| --- | --- | --- | --- | --- |
| `JIRA_DC_TOKEN` | For writes only | Bearer token for Jira Data Center REST v2. `loadConfig(env, false)` omits the requirement, so the MCP server and other mirror-only readers start without it | 2026-09-01 | presence checked via `${JIRA_DC_TOKEN:+yes}`; value never read |
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

## NOT YET VERIFIED — superseded

The P3 unknowns listed here were resolved by the R0 verification spike on 2026-08-31; see the
Jira Data Center and GitHub Enterprise sections above. Remaining unknowns are listed there.

## Known Divergences From Public Defaults

The highest-value section: where this environment does **not** behave the way public
documentation implies, which is exactly where models hallucinate.

| Topic | Public default / common assumption | Here | Source |
| --- | --- | --- | --- |
| `node:sqlite` | Widely documented as experimental, needing `--experimental-sqlite` | Stable in v24.18.0, no flag, no warning | verified 2026-08-28 |
| Hourly cron on macOS | `StartInterval` is the obvious choice | Moot — launchd dropped entirely. `StartInterval` also **loses** runs across sleep | `man launchd.plist` |
| GitHub host | `github.com` | `github.corp.clover.com` (GHE 3.21) | `gh auth status` |
| GitHub write scopes | `repo` implies broad write | **No `write:org`, no `workflow`**; also **not repo admin** | `gh auth status`, `gh api repos/…` |
| SQLite `DELETE` | Assumed to free disk space | Does **not** shrink the file; needs checkpoint / `VACUUM` | SQLite behaviour, see DESIGN §8 |
| Jira resolve payload | A prior session note claimed `resolution` + `fixVersions` + `customfield_10206` were all required | **Only `resolution` is required.** Never hardcode — read `transitions.fields[].required` live | verified 2026-08-31 on WS-6316 |
| Jira sprint via core search | Assumed to be a JSON object | `customfield_10205` returns a **legacy GreenHopper `toString` blob**: `com.atlassian.greenhopper.service.sprint.Sprint@…[id=…,name=…,state=ACTIVE]`. Core search returns **no** `sprint`/`epic` fields at all — use `/rest/agile/1.0/…`, which returns proper objects | verified 2026-08-31 |
| `mergeable` on first read | Assumed immediately correct | Returns **`UNKNOWN`** on first query because GitHub computes it lazily; resolves on re-query. Never emit a stall from `UNKNOWN` | verified 2026-08-31 on PR 2390 |
| `statusCheckRollup` element shape | Assumed uniform | **Two shapes.** `StatusContext` has `context`/`state`; `CheckRun` has `name`/`status`/`conclusion`. Must normalise both | verified 2026-08-31 |
| Ticket -> PR links | `closingIssuesReferences` assumed populated | **Empty** — no Jira/GHE issue integration. Correlation must parse `WS-\d+` from branch name, title, and body | verified 2026-08-31 |
