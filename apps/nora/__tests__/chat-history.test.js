/**
 * Tests for the DB message layer: fresh count, summarization trigger boundary,
 * and the replaceFreshWithSummary transaction.
 *
 * Uses an in-memory SQLite database via the createDatabase factory so the
 * production data file is never touched.
 */
import { describe, it, expect, beforeEach } from '@jest/globals'

// better-sqlite3 is a native CJS module; Jest runs in Node so this works.
import Database from 'better-sqlite3'
import { createDatabase } from '../lib/db/db.js'
import { createChat } from '../lib/db/chats.js'
import {
  saveMessage,
  getMessages,
  getFreshMessagesForContext,
  countFreshMessages,
  getOldestFreshMessages,
  replaceFreshWithSummary,
} from '../lib/db/messages.js'

let db

beforeEach(() => {
  db = createDatabase(':memory:')
})

function addMsg(chatId, role, content) {
  return saveMessage(chatId, { role, content, timestamp: new Date().toISOString() }, db)
}

describe('chat CRUD', () => {
  it('creates a chat with a generated id', () => {
    const chat = createChat('user@example.com', 'Test chat', db)
    expect(chat.id).toBeTruthy()
    expect(chat.title).toBe('Test chat')
  })

  it('truncates long titles to 80 chars', () => {
    const longTitle = 'A'.repeat(100)
    const chat = createChat('user@example.com', longTitle, db)
    expect(chat.title.length).toBe(80)
  })
})

describe('countFreshMessages', () => {
  it('returns 0 for a chat with no messages', () => {
    const chat = createChat('u', 'empty', db)
    expect(countFreshMessages(chat.id, db)).toBe(0)
  })

  it('counts all non-summary messages when there is no summary', () => {
    const chat = createChat('u', 'c', db)
    addMsg(chat.id, 'user', 'hello')
    addMsg(chat.id, 'assistant', 'hi')
    expect(countFreshMessages(chat.id, db)).toBe(2)
  })

  it('counts all non-summary messages regardless of summary position', () => {
    const chat = createChat('u', 'c', db)
    addMsg(chat.id, 'user', 'q1')
    addMsg(chat.id, 'assistant', 'a1')
    saveMessage(chat.id, { role: 'summary', content: 'summary', timestamp: new Date().toISOString(), is_summary: true }, db)
    addMsg(chat.id, 'user', 'q2')
    addMsg(chat.id, 'assistant', 'a2')
    // 4 non-summary messages total; the summary is excluded from the count
    expect(countFreshMessages(chat.id, db)).toBe(4)
  })
})

describe('getOldestFreshMessages', () => {
  it('returns the N oldest fresh messages', () => {
    const chat = createChat('u', 'c', db)
    for (let i = 0; i < 7; i++) {
      addMsg(chat.id, i % 2 === 0 ? 'user' : 'assistant', `msg${i}`)
    }
    const oldest = getOldestFreshMessages(chat.id, 5, db)
    expect(oldest.length).toBe(5)
    expect(oldest[0].content).toBe('msg0')
    expect(oldest[4].content).toBe('msg4')
  })

  it('returns oldest non-summary messages globally', () => {
    const chat = createChat('u', 'c', db)
    addMsg(chat.id, 'user', 'first')
    saveMessage(chat.id, { role: 'summary', content: 'earlier', timestamp: new Date().toISOString(), is_summary: true }, db)
    addMsg(chat.id, 'user', 'second')
    addMsg(chat.id, 'user', 'third')
    const oldest = getOldestFreshMessages(chat.id, 5, db)
    // Returns ALL 3 non-summary messages (including the one before the summary)
    expect(oldest.length).toBe(3)
    expect(oldest[0].content).toBe('first')
  })
})

describe('replaceFreshWithSummary', () => {
  it('deletes the specified messages and inserts a summary', () => {
    const chat = createChat('u', 'c', db)
    const id1 = addMsg(chat.id, 'user', 'q')
    const id2 = addMsg(chat.id, 'assistant', 'a')
    addMsg(chat.id, 'user', 'kept')

    replaceFreshWithSummary(chat.id, [id1, id2], 'Summary of first exchange', db)

    const all = getMessages(chat.id, db)
    const summaries = all.filter((m) => m.is_summary)
    const fresh = all.filter((m) => !m.is_summary)

    expect(summaries.length).toBe(1)
    expect(summaries[0].content).toBe('Summary of first exchange')
    expect(fresh.length).toBe(1)
    expect(fresh[0].content).toBe('kept')
  })

  it('fresh count drops after summarization', () => {
    const chat = createChat('u', 'c', db)
    const ids = []
    for (let i = 0; i < 5; i++) ids.push(addMsg(chat.id, 'user', `q${i}`))
    for (let i = 0; i < 5; i++) addMsg(chat.id, 'assistant', `a${i}`)

    expect(countFreshMessages(chat.id, db)).toBe(10)

    replaceFreshWithSummary(chat.id, ids, 'compressed', db)
    expect(countFreshMessages(chat.id, db)).toBe(5) // 5 assistants remain as fresh
  })
})

describe('getFreshMessagesForContext', () => {
  it('excludes summary messages', () => {
    const chat = createChat('u', 'c', db)
    saveMessage(chat.id, { role: 'summary', content: 'old stuff', timestamp: new Date().toISOString(), is_summary: true }, db)
    addMsg(chat.id, 'user', 'real question')

    const ctx = getFreshMessagesForContext(chat.id, db)
    expect(ctx.every((m) => !m.is_summary)).toBe(true)
    expect(ctx.length).toBe(1)
    expect(ctx[0].content).toBe('real question')
  })
})
