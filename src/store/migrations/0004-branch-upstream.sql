-- 0004 — upstream tracking on branches.
--
-- `pr-merged-branch-exists` needs to tell three states apart that 0001 collapsed into one:
-- a branch that was never pushed, a branch whose remote is still there, and a branch whose
-- remote was deleted. Only the third means "the PR merged and the local branch is now litter".
-- Ahead/behind counts cannot distinguish them: all three can read zero.

ALTER TABLE branches ADD COLUMN upstream TEXT;
ALTER TABLE branches ADD COLUMN upstream_gone INTEGER NOT NULL DEFAULT 0;
