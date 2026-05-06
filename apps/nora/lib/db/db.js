import Database from 'better-sqlite3'
import path from 'path'
import { mkdirSync } from 'fs'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    pinned INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    thinking TEXT NOT NULL DEFAULT '',
    sources TEXT NOT NULL DEFAULT '[]',
    verification TEXT,
    timestamp TEXT NOT NULL,
    is_summary INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_chats_user_updated ON chats(user_id, updated_at DESC);
`

export function createDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    mkdirSync(path.dirname(dbPath), { recursive: true })
  }

  const db = new Database(dbPath)
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL')
  }
  // Incremental auto-vacuum reclaims pages from deleted rows over time
  db.pragma('auto_vacuum = INCREMENTAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  // Purge unpinned chats older than 30 days on every server start
  db.prepare(
    `DELETE FROM chats WHERE pinned = 0 AND updated_at < (unixepoch() - 30 * 86400)`
  ).run()

  // Reclaim freed pages (incremental vacuum of up to 200 pages per startup)
  db.pragma('incremental_vacuum(200)')

  return db
}

const DB_PATH =
  process.env.NORA_DB_PATH ||
  (process.env.NODE_ENV === 'test'
    ? ':memory:'
    : path.join(process.cwd(), 'data', 'nora.db'))

export default createDatabase(DB_PATH)
