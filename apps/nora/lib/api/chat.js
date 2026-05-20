import { parseSseStream } from '@/lib/utils/sseStream'
import { apiPath } from './path.js'

/**
 * Async generator that streams a DB-backed chat response.
 * The server loads conversation history from the database using chatId.
 *
 * @param {string} model
 * @param {string} chatId  - persisted chat id
 * @param {string} content - the new user message text
 * @yields {object}
 */
export async function* streamChat(model, chatId, content) {
  const res = await fetch(apiPath('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, chatId, message: content }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Request failed')
  }

  yield* parseSseStream(res)
}

/**
 * Async generator that streams the fast first-load greeting.
 * Yields parsed SSE event objects from /api/chat in greeting mode.
 *
 * @param {string} model
 * @param {string|null} greetingName
 * @yields {object}
 */
export async function* streamGreeting(model, greetingName) {
  const res = await fetch(apiPath('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, mode: 'greeting', greetingName: greetingName || null }),
  })

  if (!res.ok) return

  yield* parseSseStream(res)
}
