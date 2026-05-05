import { DEFAULT_MODEL, SSE_HEADERS } from './lib/constants'
import { streamResponse } from './lib/chatStream'
import { callOllama } from './lib/ollama'

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

export async function POST(request) {
  const { model = DEFAULT_MODEL, messages, mode, greetingName } = await request.json()

  if (mode === 'greeting') {
    return streamGreetingResponse(model, greetingName)
  }

  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: 'Invalid messages' }, { status: 400 })
  }

  return streamResponse(model, messages)
}
