-- 0005 — when a check last ran.
--
-- The rollup can list one name many times, once per workflow run; five runs of
-- `backmerge_check` were observed on a single PR. Only the most recent run describes the
-- current state, so the connector collapses a name to its latest entry and records when that
-- entry started. Without the timestamp there is no way to tell a passing re-run from the older
-- failure it replaced.

ALTER TABLE pr_checks ADD COLUMN started_at TEXT NOT NULL DEFAULT '';
