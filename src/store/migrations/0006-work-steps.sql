-- 0006 — the step ledger, and the stamps that are the only way a step can finish.
--
-- A step is a unit of work small enough that "is it finished?" has a yes or no answer. A stamp
-- is evidence that it was finished: the exit code of a verification command that actually ran,
-- bound to the exact source tree it ran against.
--
-- The binding is the entire mechanism. A stamp records `tree_digest`. Change any source file
-- and the working tree's digest changes, so the stamp stops matching and the step is unstamped
-- again. There is no path where a step is stamped and then edited: the evidence expires the
-- moment the thing it was evidence about changes.
--
-- Note what is NOT here: any column an agent can set to claim completion. `state = 'done'`
-- is unreachable without `sealed_commit`, and `sealed_commit` is written only by the
-- post-commit hook, from the SHA git just produced. Completion is a fact about the repository,
-- not an assertion made in a sentence.

CREATE TABLE work_steps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket        TEXT,
  title         TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'todo' CHECK (state IN ('todo', 'doing', 'done', 'abandoned')),
  created_at    TEXT NOT NULL,
  started_at    TEXT,
  finished_at   TEXT,
  sealed_commit TEXT,

  -- A step cannot be in progress without a start time.
  CHECK (state <> 'doing' OR started_at IS NOT NULL),

  -- The gate, expressed where it cannot be argued with. `done` requires a commit SHA. An
  -- UPDATE that sets state = 'done' without one fails at the storage engine, so no amount of
  -- confident prose in a chat session can produce a finished step.
  CHECK (state <> 'done' OR (sealed_commit IS NOT NULL AND finished_at IS NOT NULL))
);

CREATE INDEX idx_work_steps_state ON work_steps (state, id);
CREATE INDEX idx_work_steps_ticket ON work_steps (ticket, id);

-- One step in progress at a time. A partial unique index makes "I was working on four things
-- and finished none of them" impossible rather than discouraged.
CREATE UNIQUE INDEX idx_work_steps_single_doing ON work_steps (state) WHERE state = 'doing';

-- Verification evidence. One row per successful run of the gate command.
--
-- `CHECK (exit_code = 0)` means a failing verification cannot be recorded as a stamp at all.
-- There is deliberately no `passed` boolean to set incorrectly, and no severity to downgrade:
-- the row's existence is the claim, and the constraint is what makes the claim true.
CREATE TABLE step_stamps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       INTEGER NOT NULL REFERENCES work_steps (id) ON DELETE CASCADE,
  at            TEXT NOT NULL,
  command       TEXT NOT NULL,
  exit_code     INTEGER NOT NULL CHECK (exit_code = 0),
  tree_digest   TEXT NOT NULL,
  output_digest TEXT NOT NULL,
  output_tail   TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_step_stamps_step ON step_stamps (step_id, at DESC);
CREATE INDEX idx_step_stamps_tree ON step_stamps (tree_digest);
