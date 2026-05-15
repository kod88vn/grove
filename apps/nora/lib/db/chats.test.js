import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'

import { createDatabase } from './db.js'
import { createChat } from './chats.js'

let db

beforeEach(() => {
  db = createDatabase(':memory:')
})

afterEach(() => {
  if (db && !db.closed) {
    db.close()
  }
})

describe('createChat', () => {
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