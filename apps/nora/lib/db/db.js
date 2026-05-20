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

  CREATE TABLE IF NOT EXISTS skills_library (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    skill_category TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    skill_label TEXT NOT NULL,
    problem_text TEXT NOT NULL,
    problem_json TEXT NOT NULL,
    answer_json TEXT NOT NULL,
    score REAL NOT NULL,
    max_score REAL NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_skills_library_student ON skills_library(student_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_skills_library_skill ON skills_library(student_id, skill_category, skill_name);
`

export function createDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    mkdirSync(path.dirname(dbPath), { recursive: true })
  }

  const db = new Database(dbPath)
  // Set busy timeout: retry for up to 5 seconds instead of failing immediately
  // Helps with concurrent access during build/restart scenarios
  db.pragma('busy_timeout = 5000')
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
    : (() => {
        // Use project-local data directory when writable, fall back to /tmp for containers (read-only filesystem)
        const localPath = path.join(process.cwd(), 'data', 'nora.db')
        try {
          mkdirSync(path.join(process.cwd(), 'data'), { recursive: true })
          return localPath
        } catch {
          // Write to /tmp when cwd is read-only (e.g., Docker containers)
          return '/tmp/nora.db'
        }
      })())

// Lazy singleton: only initialize database on first use, not at module load
// This prevents "database is locked" errors during Next.js build
let dbInstance = null

function getDatabase() {
  if (!dbInstance) {
    try {
      console.error(`[nora/db] Initializing SQLite at ${DB_PATH}`)
      console.error(`[nora/db] NODE_ENV=${process.env.NODE_ENV}, cwd=${process.cwd()}`)
      console.error(`[nora/db] NORA_DB_PATH env=${process.env.NORA_DB_PATH ?? '(not set)'}`)
      dbInstance = createDatabase(DB_PATH)
      console.error(`[nora/db] SQLite database initialized successfully at ${DB_PATH}`)
    } catch (err) {
      console.error(`[nora/db] FATAL: Failed to initialize SQLite database at ${DB_PATH}`)
      console.error(`[nora/db] Error:`, err.message)
      console.error(`[nora/db] Stack:`, err.stack)
      throw new Error(`Nora DB initialization failed at ${DB_PATH}: ${err.message}`)
    }
  }
  return dbInstance
}

// Return a Proxy that forwards all operations to the lazy database
export default new Proxy(
  {},
  {
    get(target, prop) {
      return getDatabase()[prop]
    },
  }
)
