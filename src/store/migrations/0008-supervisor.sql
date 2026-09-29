-- 0008 — the loop supervisor.
--
-- The supervisor (agent-docs/superpowers/specs/2026-09-28-loop-supervisor-design.md)
-- orchestrates loop tasks across their full lifecycle (spec writing, runs, bounces, teardown).
-- These tables track items, events, dispatches, heartbeats, and owned resources for teardown.

CREATE TABLE supervisor_items (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  key                   TEXT NOT NULL UNIQUE,
  source                TEXT NOT NULL CHECK (source IN ('manual', 'plan-file', 'jira')),
  repo                  TEXT NOT NULL,
  state                 TEXT NOT NULL CHECK (
                          state IN (
                            'queued', 'spec_red', 'working', 'judge', 'green',
                            'stalled', 'pr_open', 'awaiting_approval', 'needs_human',
                            'paused', 'cancelled', 'done'
                          )
                        ),
  desired               TEXT NOT NULL DEFAULT 'run' CHECK (desired IN ('run', 'paused', 'cancelled')),
  bounce_count          INTEGER NOT NULL DEFAULT 0 CHECK (bounce_count >= 0 AND bounce_count <= 3),
  close_on              TEXT NOT NULL CHECK (close_on IN ('merged', 'ready')),
  loop_run_id           INTEGER REFERENCES loop_runs (id) ON DELETE SET NULL,
  brief                 TEXT NOT NULL DEFAULT '',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE INDEX idx_supervisor_items_state ON supervisor_items (state, desired);
CREATE INDEX idx_supervisor_items_repo ON supervisor_items (repo, state);

CREATE TABLE supervisor_events (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key              TEXT NOT NULL REFERENCES supervisor_items (key) ON DELETE CASCADE,
  at                    TEXT NOT NULL,
  event_type            TEXT NOT NULL,
  from_state            TEXT,
  to_state              TEXT,
  evidence              TEXT NOT NULL DEFAULT '',
  details_json          TEXT
);

CREATE INDEX idx_supervisor_events_item ON supervisor_events (item_key, at);

CREATE TABLE supervisor_dispatches (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key              TEXT NOT NULL REFERENCES supervisor_items (key) ON DELETE CASCADE,
  dispatched_at         TEXT NOT NULL,
  session_path          TEXT,
  tier                  TEXT NOT NULL,
  model                 TEXT NOT NULL,
  agent_variant         TEXT NOT NULL,
  attempt               INTEGER NOT NULL DEFAULT 1,
  nonce                 TEXT NOT NULL
);

CREATE INDEX idx_supervisor_dispatches_item ON supervisor_dispatches (item_key, dispatched_at);

CREATE TABLE supervisor_heartbeat (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  last_tick_at          TEXT NOT NULL,
  pid                   INTEGER NOT NULL
);

-- Owned-resource ledger for mandatory teardown (D7 / §5).
-- Tracks every temporary process, directory, file, or session created by the supervisor
-- so nothing is left behind upon item exit, cancellation, failure, or supervisor shutdown.
CREATE TABLE supervisor_resources (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key              TEXT NOT NULL REFERENCES supervisor_items (key) ON DELETE CASCADE,
  resource_type         TEXT NOT NULL CHECK (
                          resource_type IN (
                            'child_pid', 'watcher_pid', 'portable_dir', 'user_data_dir',
                            'scratch_dir', 'spec_file', 'session_file', 'log_file', 'other'
                          )
                        ),
  identifier            TEXT NOT NULL,
  created_at            TEXT NOT NULL,
  cleaned_at            TEXT,
  cleanup_status        TEXT NOT NULL DEFAULT 'pending' CHECK (cleanup_status IN ('pending', 'cleaned', 'failed'))
);

CREATE INDEX idx_supervisor_resources_item ON supervisor_resources (item_key, cleanup_status);
