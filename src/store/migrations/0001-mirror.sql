-- 0001 — the mirror.
--
-- Every table here is a local copy of state that Jira or GitHub owns. Nothing in this file is
-- a source of truth: a full delete and re-sync must produce the same rows. The two exceptions
-- are `seen` and `actions`, which are ours alone and are added in 0002.
--
-- `raw` columns keep the untouched API response. When a connector's parsing turns out to be
-- wrong, the fix is a re-parse from `raw`, not a re-fetch of history that may have changed.

CREATE TABLE issues (
  key             TEXT PRIMARY KEY,
  summary         TEXT NOT NULL,
  status          TEXT NOT NULL,
  resolution      TEXT,
  issue_type      TEXT NOT NULL,
  priority        TEXT,
  assignee_name   TEXT,
  assignee_display TEXT,
  reporter_name   TEXT,
  reporter_display TEXT,
  created         TEXT NOT NULL,
  updated         TEXT NOT NULL,
  resolved_at     TEXT,
  epic_key        TEXT,
  sprint_id       INTEGER,
  sprint_name     TEXT,
  labels          TEXT NOT NULL DEFAULT '[]',
  fix_versions    TEXT NOT NULL DEFAULT '[]',
  -- True when this issue is assigned to me. Denormalised because almost every query filters
  -- on it and the alternative is threading my account name through every call site.
  is_mine         INTEGER NOT NULL DEFAULT 0,
  raw             TEXT NOT NULL,
  mirrored_at     TEXT NOT NULL
);

CREATE INDEX idx_issues_updated ON issues (updated DESC);
CREATE INDEX idx_issues_status ON issues (status);
CREATE INDEX idx_issues_mine ON issues (is_mine, resolution);
CREATE INDEX idx_issues_sprint ON issues (sprint_id);

CREATE TABLE boards (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  columns     TEXT NOT NULL DEFAULT '[]',
  mirrored_at TEXT NOT NULL
);

CREATE TABLE sprints (
  id            INTEGER PRIMARY KEY,
  board_id      INTEGER NOT NULL,
  name          TEXT NOT NULL,
  state         TEXT NOT NULL,
  start_date    TEXT,
  end_date      TEXT,
  complete_date TEXT,
  mirrored_at   TEXT NOT NULL
);

CREATE INDEX idx_sprints_board_state ON sprints (board_id, state);

CREATE TABLE sprint_issues (
  sprint_id INTEGER NOT NULL,
  issue_key TEXT NOT NULL,
  PRIMARY KEY (sprint_id, issue_key)
) WITHOUT ROWID;

CREATE TABLE repos (
  full_name   TEXT PRIMARY KEY,
  local_path  TEXT,
  mirrored_at TEXT NOT NULL
);

CREATE TABLE pull_requests (
  repo               TEXT NOT NULL,
  number             INTEGER NOT NULL,
  title              TEXT NOT NULL,
  body               TEXT NOT NULL DEFAULT '',
  url                TEXT NOT NULL,
  state              TEXT NOT NULL,
  is_draft           INTEGER NOT NULL DEFAULT 0,
  author             TEXT NOT NULL,
  head_ref           TEXT NOT NULL,
  base_ref           TEXT NOT NULL,
  head_oid           TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  merged_at          TEXT,
  -- 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'. UNKNOWN means GitHub has not computed it yet,
  -- never that the branch conflicts. No stall may be raised from it.
  mergeable          TEXT NOT NULL DEFAULT 'UNKNOWN',
  merge_state_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  review_decision    TEXT,
  auto_merge_enabled INTEGER NOT NULL DEFAULT 0,
  -- My relationship to this PR: authored, review requested of me, or already reviewed by me.
  is_mine            INTEGER NOT NULL DEFAULT 0,
  my_review_state    TEXT NOT NULL DEFAULT 'not_requested',
  raw                TEXT NOT NULL,
  mirrored_at        TEXT NOT NULL,
  PRIMARY KEY (repo, number)
) WITHOUT ROWID;

CREATE INDEX idx_pr_state ON pull_requests (state, updated_at DESC);
CREATE INDEX idx_pr_mine ON pull_requests (is_mine, state);
CREATE INDEX idx_pr_review_state ON pull_requests (my_review_state);

CREATE TABLE pr_reviews (
  repo         TEXT NOT NULL,
  number       INTEGER NOT NULL,
  author       TEXT NOT NULL,
  state        TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (repo, number, author)
) WITHOUT ROWID;

CREATE TABLE pr_review_requests (
  repo       TEXT NOT NULL,
  number     INTEGER NOT NULL,
  -- 'user' | 'team'. GitHub returns both in one list, keyed by __typename.
  kind       TEXT NOT NULL,
  identifier TEXT NOT NULL,
  PRIMARY KEY (repo, number, kind, identifier)
) WITHOUT ROWID;

CREATE TABLE pr_checks (
  repo       TEXT NOT NULL,
  number     INTEGER NOT NULL,
  name       TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  PRIMARY KEY (repo, number, name)
) WITHOUT ROWID;

-- The only bridge between Jira and GitHub. There is no server-side link on this instance:
-- `closingIssuesReferences` is always empty, so every row here came from parsing text.
CREATE TABLE issue_pr_links (
  issue_key TEXT NOT NULL,
  repo      TEXT NOT NULL,
  number    INTEGER NOT NULL,
  -- 'branch' | 'title' | 'body' — which text yielded the key. Branch is the strongest.
  source    TEXT NOT NULL,
  PRIMARY KEY (issue_key, repo, number)
) WITHOUT ROWID;

CREATE INDEX idx_links_pr ON issue_pr_links (repo, number);

CREATE TABLE branches (
  repo           TEXT NOT NULL,
  name           TEXT NOT NULL,
  ahead          INTEGER NOT NULL DEFAULT 0,
  behind         INTEGER NOT NULL DEFAULT 0,
  last_commit_at TEXT,
  mirrored_at    TEXT NOT NULL,
  PRIMARY KEY (repo, name)
) WITHOUT ROWID;
