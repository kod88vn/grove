import { randomUUID } from 'crypto'
import defaultDb from './db.js'

export function createChat(userId, title, db = defaultDb) {
  const id = randomUUID()
  const safeTitle = (title || 'New Chat').trim().slice(0, 80)
  db.prepare(
    `INSERT INTO chats (id, user_id, title) VALUES (?, ?, ?)`
  ).run(id, userId, safeTitle)
  return { id, title: safeTitle }
}

export function listChats(userId, db = defaultDb) {
  return db.prepare(`
    SELECT id, title, created_at, updated_at, pinned
    FROM chats
    WHERE user_id = ?
    ORDER BY pinned DESC, updated_at DESC
    LIMIT 50
  `).all(userId)
}

export function getChat(id, userId, db = defaultDb) {
  return db.prepare(
    `SELECT * FROM chats WHERE id = ? AND user_id = ?`
  ).get(id, userId)
}

export function setPinned(id, userId, pinned, db = defaultDb) {
  db.prepare(
    `UPDATE chats SET pinned = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?`
  ).run(pinned ? 1 : 0, id, userId)
}

export function updateTitle(id, userId, title, db = defaultDb) {
  db.prepare(
    `UPDATE chats SET title = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?`
  ).run(title.trim().slice(0, 80), id, userId)
}

export function touchChat(id, db = defaultDb) {
  db.prepare(`UPDATE chats SET updated_at = unixepoch() WHERE id = ?`).run(id)
}

export function deleteChat(id, userId, db = defaultDb) {
  db.prepare(`DELETE FROM chats WHERE id = ? AND user_id = ?`).run(id, userId)
}
