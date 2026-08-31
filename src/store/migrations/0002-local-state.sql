-- 0002 — state that is ours, not mirrored.
--
-- These tables survive a full re-sync because nothing upstream knows about them. Dropping
-- them loses real information: what I have already looked at, and what this system has done.

-- What changed between two syncs. Derived by diffing the previous mirror row against the new
-- one, which is the only way to notice an action performed outside this system — a PR merged
-- in the GitHub UI, a ticket transitioned by someone else.
CREATE TABLE events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  at           TEXT NOT NULL,
  kind         TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id   TEXT NOT NULL,
  detail       TEXT NOT NULL DEFAULT '{}',
  sync_run_id  INTEGER
);

CREATE INDEX idx_events_at ON events (at DESC);
CREATE INDEX idx_events_subject ON events (subject_kind, subject_id, at DESC);

-- Read receipts. Absence of a row means unseen, so a new subject is unseen by construction.
CREATE TABLE seen (
  subject_kind TEXT NOT NULL,
  subject_id   TEXT NOT NULL,
  seen_at      TEXT NOT NULL,
  PRIMARY KEY (subject_kind, subject_id)
) WITHOUT ROWID;

CREATE TABLE sync_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scope       TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  ok          INTEGER,
  error       TEXT,
  counts      TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_sync_runs_started ON sync_runs (started_at DESC);

-- A single-row lease. Two processes want to sync: the dashboard's interval and a terminal
-- command. `BEGIN IMMEDIATE` on this row decides who wins; the loser reports "in progress"
-- rather than queueing, because a duplicate sync has no value.
CREATE TABLE sync_lock (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  holder      TEXT,
  acquired_at TEXT,
  lease_until TEXT
);

INSERT INTO sync_lock (id, holder, acquired_at, lease_until) VALUES (1, NULL, NULL, NULL);

-- The audit trail. One row per mutation this system was asked to perform, whether or not it
-- succeeded. `authorized_by` must always name the human decision that permitted it; an action
-- that cannot name its authorization must never have run.
CREATE TABLE actions (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  capability    TEXT NOT NULL,
  payload       TEXT NOT NULL,
  reason        TEXT NOT NULL,
  -- Which stall rule proposed it, e.g. 'pr-approved-unmerged'.
  stall_id      TEXT,
  -- 'proposed' | 'refused' | 'applied' | 'failed'
  status        TEXT NOT NULL DEFAULT 'proposed',
  authorized_by TEXT,
  executed_at   TEXT,
  outcome       TEXT
) WITHOUT ROWID;

CREATE INDEX idx_actions_status ON actions (status, created_at DESC);

-- Config that must outlive a process, such as the resolved account identity. Not a substitute
-- for the config file; this is only for values discovered at runtime.
CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
