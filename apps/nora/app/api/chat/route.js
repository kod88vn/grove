import { DEFAULT_MODEL, SSE_HEADERS } from './lib/constants'
import { streamResponse } from './lib/chatStream'
import { callOllama } from './lib/ollama'
import {
  saveMessage,
  getFreshMessagesForContext,
  countFreshMessages,
  getOldestFreshMessages,
  replaceFreshWithSummary,
} from '@/lib/db/messages'
import { touchChat, updateTitle } from '@/lib/db/chats'

/**
 * Server-side greeting cache.
 * Keyed by normalised first name; populated once per unique name per process lifetime.
 * With only a handful of family members this stays tiny and avoids repeated LLM calls.
 */
export const greetingCache = new Map()

function streamGreetingResponse(model, greetingName) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const emit = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        const safeName = typeof greetingName === 'string' && greetingName.trim()
          ? greetingName.trim()
          : 'there'

        // Cache hit — replay the stored greeting immediately without calling Ollama
        const cached = greetingCache.get(safeName)
        if (cached) {
          emit({ word: cached })
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const upstream = await callOllama({
          model,
          stream: true,
          options: { think: false, num_predict: 60 },
          messages: [
            {
              role: 'system',
              content:
                'You are Nora, an AI assistant. Introduce yourself by name and greet the user in one short friendly sentence. No reasoning. No markdown. No bullet points. Keep it under 20 words.',
            },
            {
              role: 'user',
              content: `Introduce yourself to ${safeName} and offer help for today.`,
            },
          ],
        })

        if (!upstream.ok || !upstream.body) {
          emit({ word: `Hi ${safeName}, how can I help today?` })
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let rawBuffer = ''
        let hasEmittedWord = false
        let accumulated = ''

        for await (const chunk of upstream.body) {
          rawBuffer += decoder.decode(chunk, { stream: true })
          const lines = rawBuffer.split('\n')
          rawBuffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const json = JSON.parse(line)
              const content = json.message?.content ?? ''
              if (content) {
                emit({ word: content })
                accumulated += content
                hasEmittedWord = true
              }
              if (json.done) {
                if (!hasEmittedWord) {
                  const fallback = `Hi ${safeName}, how can I help today?`
                  emit({ word: fallback })
                  accumulated = fallback
                }
                if (accumulated) greetingCache.set(safeName, accumulated)
                controller.enqueue(enc.encode('data: [DONE]\n\n'))
                controller.close()
                return
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        if (!hasEmittedWord) {
          const fallback = `Hi ${safeName}, how can I help today?`
          emit({ word: fallback })
          accumulated = fallback
        }
        if (accumulated) greetingCache.set(safeName, accumulated)
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      } catch {
        emit({ word: 'Hi there, how can I help today?' })
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}

/**
 * Generate a short 5-8 word title from the first few messages and persist it.
 * Runs fire-and-forget — best-effort, non-blocking.
 */
async function maybeUpdateTitle(model, chatId, userId) {
  const context = getFreshMessagesForContext(chatId).slice(0, 6)
  if (context.length < 2) return

  const transcript = context
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 300)}`)
    .join('\n')

  if (!transcript.trim()) return

  try {
    const res = await callOllama({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Generate a short 5-8 word title for this conversation. Output only the title text — no quotes, no punctuation at the end, no explanations.',
        },
        { role: 'user', content: transcript },
      ],
      stream: false,
      options: { think: false, num_predict: 20 },
    })
    if (!res.ok) return
    const json = await res.json()
    const title = json.message?.content?.trim()
    if (title) updateTitle(chatId, userId, title)
  } catch { /* best-effort */ }
}

/**
 * Summarize the oldest 5 fresh messages once the fresh count reaches 10.
 * Runs fire-and-forget after the stream closes — best-effort, non-blocking.
 */
async function maybeSummarize(model, chatId, userId) {
  const fresh = countFreshMessages(chatId)
  if (fresh < 10) return

  const oldest = getOldestFreshMessages(chatId, 5)
  if (oldest.length < 5) return

  const transcript = oldest
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  if (!transcript.trim()) return

  try {
    const res = await callOllama({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Summarize this conversation segment in 3-5 concise sentences. Preserve all key facts, topics, decisions, and answers so the conversation can continue seamlessly. Output only the summary text, no preamble.',
        },
        { role: 'user', content: transcript },
      ],
      stream: false,
      options: { think: false },
    })
    if (!res.ok) return
    const json = await res.json()
    const summary = json.message?.content?.trim()
    if (!summary) return
    replaceFreshWithSummary(chatId, oldest.map((m) => m.id), summary)
    // Title update after summarisation — reflects the full conversation topic.
    maybeUpdateTitle(model, chatId, userId).catch(() => {})
  } catch {
    // summarization is best-effort; failures are silent
  }
}

/**
 * Stream a response for a DB-backed chat (chatId provided).
 * Loads non-summary context from DB, wraps the SSE stream to persist
 * the assistant response and fire summarization when fresh count hits 10.
 */
function streamResponseWithPersistence(model, chatId, newMessageContent, userId) {
  const now = new Date().toISOString()

  // Build Ollama context from DB non-summary messages + the new user message
  const contextMessages = getFreshMessagesForContext(chatId)
  const messagesForOllama = [
    ...contextMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: newMessageContent },
  ]

  // Save user message to DB immediately (before streaming)
  saveMessage(chatId, { role: 'user', content: newMessageContent, timestamp: now })
  touchChat(chatId)

  const innerResponse = streamResponse(model, messagesForOllama)

  // Wrap with a TransformStream that accumulates the assistant response for persistence
  const accumulated = { content: '', thinking: '', sources: [], verification: null }
  let parseBuffer = ''
  const dec = new TextDecoder()

  const transform = new TransformStream({
    transform(chunk, controller) {
      parseBuffer += dec.decode(chunk, { stream: true })
      const blocks = parseBuffer.split('\n\n')
      parseBuffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const data = block.replace(/^data: /, '').trim()
        if (!data || data === '[DONE]') continue
        try {
          const event = JSON.parse(data)
          if (event.word) accumulated.content += event.word
          if (event.thinking) accumulated.thinking += event.thinking
          if (Array.isArray(event.sources)) accumulated.sources = event.sources
          if (event.verification) accumulated.verification = event.verification
        } catch { /* ignore */ }
      }
      controller.enqueue(chunk)
    },
    flush() {
      // Save assistant response synchronously (better-sqlite3 is sync)
      if (accumulated.content) {
        saveMessage(chatId, {
          role: 'assistant',
          content: accumulated.content,
          thinking: accumulated.thinking,
          sources: accumulated.sources,
          verification: accumulated.verification,
          timestamp: new Date().toISOString(),
        })
        touchChat(chatId)
      }
      // Title update every 4 messages so the sidebar title reflects current topics.
      const freshCount = countFreshMessages(chatId)
      if (accumulated.content && freshCount % 4 === 0) {
        maybeUpdateTitle(model, chatId, userId).catch(() => {})
      }
      // Summarization is async (Ollama call) — fire-and-forget, does not block the response
      if (accumulated.content) {
        maybeSummarize(model, chatId, userId).catch(() => {})
      }
    },
  })

  innerResponse.body.pipeTo(transform.writable).catch(() => {})
  return new Response(transform.readable, { headers: SSE_HEADERS })
}

export async function POST(request) {
  const { model = DEFAULT_MODEL, messages, mode, greetingName, chatId, message } =
    await request.json()

  if (mode === 'greeting') {
    return streamGreetingResponse(model, greetingName)
  }

  const userId =
    request.headers.get('tailscale-user-login') ||
    request.headers.get('x-forwarded-for') ||
    'anonymous'

  // DB-backed path: server manages history
  if (chatId && message) {
    return streamResponseWithPersistence(model, chatId, message, userId)
  }

  // Backward-compat: client sends full messages array (used by tests + old clients)
  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: 'Invalid messages' }, { status: 400 })
  }

  return streamResponse(model, messages)
}
