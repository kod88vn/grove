import { randomUUID } from 'crypto'
import defaultDb from './db.js'

function parseRow(row) {
  return {
    ...row,
    sources: row.sources ? JSON.parse(row.sources) : [],
    verification: row.verification ? JSON.parse(row.verification) : null,
    is_summary: row.is_summary === 1,
  }
}

/** Save a message; returns the generated id. */
export function saveMessage(chatId, msg, db = defaultDb) {
  const id = randomUUID()
  db.prepare(`
    INSERT INTO messages
      (id, chat_id, role, content, thinking, sources, verification, timestamp, is_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    chatId,
    msg.role,
    msg.content ?? '',
    msg.thinking ?? '',
    JSON.stringify(msg.sources ?? []),
    msg.verification ? JSON.stringify(msg.verification) : null,
    msg.timestamp || new Date().toISOString(),
    msg.is_summary ? 1 : 0,
  )
  return id
}

/** All messages for a chat (for display, includes summaries), ordered oldest first. */
export function getMessages(chatId, db = defaultDb) {
  return db.prepare(
    `SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC`
  ).all(chatId).map(parseRow)
}

/** Non-summary messages only — what gets sent to the AI for context. */
export function getFreshMessagesForContext(chatId, db = defaultDb) {
  return db.prepare(
    `SELECT * FROM messages WHERE chat_id = ? AND is_summary = 0 ORDER BY rowid ASC`
  ).all(chatId).map(parseRow)
}

/**
 * Count all non-summary messages.
 * When this reaches 10 the oldest 5 are compressed into a summary,
 * keeping a rolling window of 5 fresh messages.
 */
export function countFreshMessages(chatId, db = defaultDb) {
  return db.prepare(
    `SELECT COUNT(*) as count FROM messages WHERE chat_id = ? AND is_summary = 0`
  ).get(chatId).count
}

/**
 * Get the N oldest non-summary messages (globally).
 * These are compressed into a summary when fresh count hits 10.
 */
export function getOldestFreshMessages(chatId, n, db = defaultDb) {
  return db.prepare(`
    SELECT * FROM messages WHERE chat_id = ? AND is_summary = 0
    ORDER BY rowid ASC LIMIT ?
  `).all(chatId, n).map(parseRow)
}

/**
 * Atomically replace a set of messages with a single summary entry.
 * Runs in a transaction — either all deletes + the insert succeed or none do.
 */
export function replaceFreshWithSummary(chatId, messageIds, summaryContent, db = defaultDb) {
  db.transaction(() => {
    for (const id of messageIds) {
      db.prepare(`DELETE FROM messages WHERE id = ?`).run(id)
    }
    saveMessage(chatId, {
      role: 'summary',
      content: summaryContent,
      timestamp: new Date().toISOString(),
      is_summary: true,
    }, db)
  })()
}
