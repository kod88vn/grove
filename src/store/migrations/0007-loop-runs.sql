-- 0007 — the loop ledger.
--
-- A loop (LOOP.md) hands an agent a task and judges the result with the target repo's own
-- verifier, from a driver running outside the chat session. These two tables are what that
-- driver writes, and what `/loops` reads. They exist so a loop is watchable and auditable
-- afterwards instead of being a terminal someone had to keep in view.
--
-- These are NOT `actions`. An action is a mutation this system performs under policy, and the
-- capability list is deliberately tiny (DESIGN.md §19). A loop run is the opposite: an
-- observation of work a human started, recorded after the fact. Nothing here is executable,
-- and the executor never reads it.
--
-- The shape follows `work_steps`: there is no column an agent can set to claim success.
-- `outcome = 'passed'` is reachable only through an UPDATE that proves a green iteration
-- exists with the spec digest still matching the one locked at start.

CREATE TABLE loop_runs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket                TEXT,
  repo                  TEXT NOT NULL,

  -- The command whose exit code decides done. Recorded so a run can be re-read later and the
  -- claim "this was judged by the repo's own suite" checked rather than trusted.
  verifier              TEXT NOT NULL,

  -- The executable spec, and its sha-256 at the moment the loop started. Every iteration
  -- re-reports the digest; a mismatch is `tampered` and ends the run.
  spec_path             TEXT NOT NULL,
  spec_digest           TEXT NOT NULL,

  -- Set when the loop is unblocking a guard, so raising the limits instead of fixing the code
  -- is detectable. Null for a loop that has no guard config to protect.
  config_path           TEXT,
  config_digest         TEXT,

  baseline_tests        INTEGER NOT NULL,
  baseline_suppressions INTEGER NOT NULL,
  budget                INTEGER NOT NULL CHECK (budget > 0),

  started_at            TEXT NOT NULL,
  finished_at           TEXT,
  outcome               TEXT CHECK (outcome IN ('passed', 'failed')),
  stop_reason           TEXT,

  -- A finished run has both, or neither. A run with an outcome and no end time is a row that
  -- would render as "still going" forever.
  CHECK ((outcome IS NULL) = (finished_at IS NULL))
);

CREATE INDEX idx_loop_runs_started ON loop_runs (started_at DESC);
CREATE INDEX idx_loop_runs_ticket ON loop_runs (ticket, id);

-- One row per verifier observation. Iteration 0 is the negative control: the run may only
-- start if it is red, so the spec is proven to fail before any agent touches it.
CREATE TABLE loop_iterations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       INTEGER NOT NULL REFERENCES loop_runs (id) ON DELETE CASCADE,
  ordinal      INTEGER NOT NULL CHECK (ordinal >= 0),
  at           TEXT NOT NULL,

  state        TEXT NOT NULL CHECK (
                 state IN ('red', 'green', 'tampered', 'shrunk', 'cfg-tampered', 'suppressed')
               ),

  exit_code    INTEGER NOT NULL,

  -- Re-reported every iteration rather than assumed unchanged. This is the column the pass
  -- guard below compares against `loop_runs.spec_digest`.
  spec_digest  TEXT NOT NULL,
  tests        INTEGER,
  output_tail  TEXT NOT NULL DEFAULT '',

  -- Green means the verifier exited zero. There is no way to file a failing run as green.
  CHECK (state <> 'green' OR exit_code = 0),

  UNIQUE (run_id, ordinal)
);

CREATE INDEX idx_loop_iterations_run ON loop_iterations (run_id, ordinal);
