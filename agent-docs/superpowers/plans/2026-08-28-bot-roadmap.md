# `bot` Roadmap

**Goal:** A personal automation runner that watches my Jira tickets, branches and PRs, reports
what has stopped moving, and — only under explicit, expiring, rate-limited pre-approval —
moves it, with a full audit trail and a local dashboard.

**Source spec:** [DESIGN.md](../../../DESIGN.md) · **Verified facts:** [STACK.md](../../../STACK.md)

> Rewritten 2026-09-01, after the read-only tool and the executor were built. The original
> P0–P10 sequencing is superseded: the phases below are what was actually delivered, in the
> order they were delivered. A plan that no longer matches the repository is worse than no
> plan, because it gets quoted with confidence.

---

## Delivered

| # | Phase | Delivers | Commit |
|---|---|---|---|
| R0 | Verification spike | Jira DC and GHE probed live, fixtures captured, one remembered "fact" disproved | `15c2020` |
| R1 | Scaffold & core model | TypeScript toolchain, pure domain model, guard layer map | `8d24087` |
| R2 | Store | Mirror schema, forward-only migrations, WAL, FTS5 | `46e89ab` |
| R3 | Connectors & `doctor` | Jira client, GitHub via `gh`, git branch reader, config | `6379920`, `18d4ff5` |
| R4 | Sync engine | Mirrors Jira, GitHub and local branches; events; issue↔PR correlation | `c21787a` |
| R5 | Stall engine | The eighteen ways work stops moving, plus `bot stalls` | `f61b742` |
| R6 | Dashboard | Read-only control surface on 127.0.0.1, hardened | `7e8a353` |
| R7 | Executor | Merge and resolve, behind guards, with an audit trail | `d084e5e` |
| R8 | Triggers | Read-only MCP server, folder-open sync task | `3e9e4be` |

**Where the value actually appeared:** R5 was the first phase that produced something worth
having. It found seven tickets still open behind merged pull requests — the exact failure this
project was built for — none of which I would have found by looking.

**What the later phases changed about the answer, not the code:**

- R4 mirrored only *open* pull requests at first, so the rule that matters most could never
  fire. Adding merged PRs took `issue_pr_links` from 15 to 67 and surfaced those seven.
- R6 made a ranking defect visible: 76 of 199 items were review requests, nearly all routed
  through a team rather than addressed to me by name. Ranking those lower cut the
  high-severity list from a wall to 32.

Both were found by looking at real output. Neither was visible in the tests.

---

## Not built

| Phase | Delivers | Note |
|---|---|---|
| R9 | Scheduling | `launchd`, quiet hours, sleep and offline catch-up. Must use `StartCalendarInterval` — `StartInterval` silently loses runs across sleep (STACK.md). |
| R10 | Pre-approvals | Rules with expiry and rate limits, so a merge can happen without a click. Deliberately last: everything before it is safe by construction. |
| R11 | Notifications | Surfacing a stall without my opening a window. |
| R12 | Chat handoff | `chat:handoff` actions prepared by the bot and initiated by me in VS Code Chat. There is no headless model on this machine (DESIGN.md §13). |

Nothing runs unattended today. Every mutation needs a button press, which is the right default
until pre-approval rules exist and have been watched for a while.

---

## Boundaries that still hold

- **The default is queue.** An action runs only where a rule explicitly allows it. Absence of
  a rule is never permission.
- **The bot never invokes a language model.** No phase may add one.
- **`src/mcp/` never imports `src/executor/`.** An agent reading this system cannot change it.
- **Guards re-read live state.** The mirror can be an hour old, and a reviewer may have
  objected in that hour.
