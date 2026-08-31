-- 0003 — full-text search.
--
-- External-content FTS5 tables: the index stores no copy of the text, it points back at the
-- base row. That keeps the database small and makes it impossible for the index to disagree
-- with the row about what the text says.
--
-- Triggers keep them in step. Without the `delete` command in the update trigger, FTS5 leaves
-- the old terms behind and a renamed ticket stays findable under its old title forever.

CREATE VIRTUAL TABLE issues_fts USING fts5 (
  key,
  summary,
  status,
  content = 'issues',
  content_rowid = 'rowid'
);

CREATE TRIGGER issues_fts_insert AFTER INSERT ON issues BEGIN
  INSERT INTO issues_fts (rowid, key, summary, status)
  VALUES (new.rowid, new.key, new.summary, new.status);
END;

CREATE TRIGGER issues_fts_delete AFTER DELETE ON issues BEGIN
  INSERT INTO issues_fts (issues_fts, rowid, key, summary, status)
  VALUES ('delete', old.rowid, old.key, old.summary, old.status);
END;

CREATE TRIGGER issues_fts_update AFTER UPDATE ON issues BEGIN
  INSERT INTO issues_fts (issues_fts, rowid, key, summary, status)
  VALUES ('delete', old.rowid, old.key, old.summary, old.status);
  INSERT INTO issues_fts (rowid, key, summary, status)
  VALUES (new.rowid, new.key, new.summary, new.status);
END;

-- `pull_requests` is WITHOUT ROWID, so it has no rowid to point at. This index therefore
-- stores its own copy of the text and is rebuilt wholesale rather than kept in step.
CREATE VIRTUAL TABLE pull_requests_fts USING fts5 (
  repo,
  number UNINDEXED,
  title,
  body
);
