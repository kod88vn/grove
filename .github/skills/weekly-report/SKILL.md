---
name: weekly-report
description: Use when asked to produce the weekly timesheet and/or weekly summary from central-command's mirrored Jira/GitHub activity. Hours are a guesstimate that always totals 8h per work day — no time-tracking accuracy is expected or attempted.
---

# Weekly Report (timesheet + summary)

## Ground rule

**Accuracy of hours is explicitly not the goal.** The timesheet exists to produce a plausible
8-hours-per-workday sheet from whatever Jira/GitHub activity actually happened, not to measure
real effort. Never hedge, caveat, or ask the user to confirm hour splits. Divide and move on.

## Step 1 — pick the week

Default to the current ISO week (Mon–Fri) up to today. If run on a Monday with nothing yet
this week, use last week instead. State the date range once at the top of the output.

**Label the week by its Monday date, never as "this week" or "last week".** A session that
starts Sunday night and continues past midnight changes which phrase is correct without the
week changing at all, and that has already caused a round of "you filled the wrong week" over
a week that was correctly filled. `2026-W37 (Mon 2026-09-07 → Fri 2026-09-11)` is unambiguous;
"current week" is not.

If the user says a different week is missing, do not argue and do not refill from scratch —
run the gap check in Step 6 and show them the per-day totals.

## Step 2 — refresh the mirror if stale

```bash
npm run cc -- sync all --max-age-seconds=900
```

Skip this if `sync_runs` already has a run finished in the last 15 minutes:

```bash
sqlite3 data/central-command.db "SELECT started_at, finished_at, ok FROM sync_runs ORDER BY started_at DESC LIMIT 1;"
```

## Step 3 — pull the week's activity from the mirror

Everything comes from `data/central-command.db`. Never hit live Jira/GitHub for this — the
mirror is the whole point.

```bash
WEEK_START=2026-09-08   # Monday of the target week, adjust each run
sqlite3 -json data/central-command.db "
  SELECT key, summary, status, updated
  FROM issues
  WHERE is_mine = 1 AND updated >= '${WEEK_START}'
  ORDER BY updated;
"

sqlite3 -json data/central-command.db "
  SELECT repo, number, title, state, updated_at
  FROM pull_requests
  WHERE is_mine = 1 AND updated_at >= '${WEEK_START}'
  ORDER BY updated_at;
"

sqlite3 -json data/central-command.db "
  SELECT at, kind, subject_kind, subject_id, detail
  FROM events
  WHERE at >= '${WEEK_START}'
  ORDER BY at;
"
```

`events` gives real day-level granularity (a status transition, a PR opening/merging) even
though the hours attached to it are made up. Use it to decide which ticket/PR "belongs" to
which weekday, and to write the narrative summary.

## Step 4 — build the timesheet

For each weekday (Mon–Fri) that has at least one issue/PR/event timestamped that day:

1. List the distinct tickets/PRs touched that day.
2. Split exactly 8.0 hours across them. Weight roughly by event count that day if there's an
   easy signal (e.g. a ticket with 3 events gets more than one with 1), otherwise split evenly.
   Round to the nearest 0.25h and adjust the largest entry so the day sums to exactly 8.00.
3. If a weekday has zero activity in the mirror, still add a row — put all 8h on the
   single most-recently-touched ticket/PR as of that day (carry-forward), or on the nearest
   open ticket if nothing at all is in the mirror for that week. Never leave a workday blank.

Render as a markdown table:

```markdown
| Day | Ticket/PR | Hours |
| --- | --- | --- |
| Mon 2026-09-08 | WS-6458 | 5.00 |
| Mon 2026-09-08 | clover/web-lib-RRS#472 | 3.00 |
| ... | **Total** | **8.00** |
```

One table per day, or one combined table with a day column — either is fine, pick whichever
is shorter for the week's actual row count.

## Step 5 — build the summary

**The summary is a fixed five-question form. Reproduce the five questions verbatim, in this
order, and answer each one underneath.** Do not rename them, do not reorder them, do not add
sections, and do not drop a question because the answer is empty — leave the answer blank
instead.

Answers are plain lines, one item per line. No markdown bullets, no bold, no tables, no
ticket-plus-PR citations. Short informal phrases, lowercase, the way a person types into a
status thread — not sentences and not a changelog.

```
Summarize your accomplishments for the week.

removed checkout MFE
bug fixes because MFE checkout was a mess
added stryker mutation tests
resolve old fortify tickets for legacy rrs

What are the tasks that you are trying to accomplish by the next week day?

clean up retail/service code. Ready for handing over

Are there any blockers hindering your progress?

List your pending assigned tasks along with their estimated completion time.

WS-6236 (8/29)
WS-6206 (8/29)

Have you updated your work hours in Jira (Tasks & Bugs).

Yes
```

Question-by-question rules:

1. **Accomplishments** — derive from issues resolved in the week and PRs merged in the week
   (Step 3). Collapse related PRs into one line describing the *outcome*, not the mechanism.
   Aim for 3–6 lines. Never list a PR number.
2. **Next working day** — derive from open PRs and Open/In Progress issues that are clearly
   mid-flight. One or two lines. This is "by the next week day", not "next week" — keep it to
   what is genuinely next.
3. **Blockers** — leave the answer blank unless the mirror shows something concretely stuck
   (Reopened issue, PR with CHANGES_REQUESTED against me, a stall). Blank is the common and
   correct answer; do not invent one.
4. **Pending assigned tasks** — the unresolved `is_mine = 1` issues that were **touched during
   the reporting week**, or that still carry an open PR from it. One per line, as
   `WS-XXXX (M/D)`. The date is an estimated completion date, `M/D`, no year, no zero-padding.
   Guess it; do not ask. **Cap the list at roughly ten.** The full unresolved backlog is
   ~90 tickets and dumping it makes the answer useless — this question means "what is on your
   plate now", not "what is assigned to you in Jira".
5. **Work hours in Jira** — always `Yes`. This answer is only allowed to be `Yes` because
   Step 6 actually posted the hours. Never answer it from the report alone.

## Step 6 — post the hours to Jira (this is the timesheet)

**The markdown table is not the timesheet. Jira worklogs are the timesheet.** A report that
stops at a table has not filled anything in, and answering question 5 `Yes` on the strength of
a table is a lie. Do this every run, without being asked.

### First, find the real gap

Never assume the target week is the empty one. Total the existing worklogs per day across the
last three weeks and look for workdays under 8h:

```bash
node tmp/worklog-gaps.mjs 2026-08-24 2026-09-13     # FROM TO, inclusive
```

The script (recreate it in `tmp/` if missing, ~50 lines) runs JQL
`worklogAuthor = jay.quach AND worklogDate >= "FROM" AND worklogDate <= "TO"`, then pulls
`/rest/api/2/issue/<KEY>/worklog` per hit and sums `timeSpentSeconds` per day, flagging any
weekday that is empty or short. Fill whatever it flags — that may not be the week the user
named, and the user may be wrong about which week is missing. Show them the per-day output
before or instead of arguing.

### Then post

`POST /rest/api/2/issue/<KEY>/worklog` with `Authorization: Bearer $JIRA_DC_TOKEN`:

```json
{ "started": "2026-09-08T16:00:00.000+0000", "timeSpentSeconds": 10800, "comment": "Development" }
```

- `started` **must** be `YYYY-MM-DDTHH:MM:SS.000+0000`. A bare ISO string is rejected.
- Prefer `timeSpentSeconds` over `timeSpent` — no `"1h 45m"` string parsing to get wrong.
- `comment` is a bare category, matching 271 existing entries on WS-375: `Development` or
  `Code review`. Not a description of the work.
- Stagger `started` by an hour per entry within a day so same-day rows do not collide.
- **Be idempotent.** `GET` the issue's worklogs first and skip any `(issue, date)` that already
  has an entry authored by `jay.quach`. Re-running must never double-log.
- Run the poster with a dry-run flag first, print every payload, then re-run with `--apply`.

### Mapping timesheet rows to tickets

Every row needs a ticket; a PR number cannot be logged against. For review work with no ticket
of its own, use **WS-375 ("code review")** — that is what it exists for and where the history
lives. Per-repo Dependabot review tickets (WS-6454 – WS-6458) take their own repo's review
hours.

### While you are here: check the epic links

The report already enumerates the week's tickets, so this is nearly free and catches a failure
that otherwise surfaces weeks later. **Every WS ticket must carry an Epic Link
(`customfield_10206`); the current default is `WS-5345`** ("[26.Q3] Platform related Tasks for
web-storefront-engine"). Jira does *not* enforce it on create, only on the resolve transition —
so a ticket sits with no epic until the day you try to close it and get
`400 {"customfield_10206":"Epic Link is required for all issues"}`.

```bash
curl -s -H "Authorization: Bearer $JIRA_DC_TOKEN" \
  "https://jira.corp.clover.com/rest/api/2/issue/<KEY>?fields=customfield_10206"

# backfill -> 204, empty body
curl -s -X PUT -H "Authorization: Bearer $JIRA_DC_TOKEN" -H 'Content-Type: application/json' \
  -d '{"fields":{"customfield_10206":"WS-5345"}}' \
  "https://jira.corp.clover.com/rest/api/2/issue/<KEY>"
```

Backfill only tickets with `epic=NONE`. Leave tickets already pointing at an older epic
(e.g. `WS-5801`) exactly where they are — do not retro-fit them onto the current one.

## Step 7 — write it out


Save to `reports/<ISO-week>.md` (e.g. `reports/2026-W37.md`) and also print the full report in
chat. `reports/` is gitignored — this is a personal artifact, not something to commit.

```bash
mkdir -p reports
```
