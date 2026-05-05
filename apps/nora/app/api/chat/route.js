import { DEFAULT_MODEL, SSE_HEADERS } from './lib/constants'
import { streamResponse } from './lib/chatStream'
import { callOllama } from './lib/ollama'

function streamGreetingResponse(model, greetingName) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const emit = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        const safeName = typeof greetingName === 'string' && greetingName.trim()
          ? greetingName.trim()
          : 'there'

        const upstream = await callOllama({
          model,
          stream: true,
          options: { think: false, num_predict: 60 },
          messages: [
            {
              role: 'system',
              content:
                'You are Nora. Reply with exactly one short friendly greeting sentence. No reasoning. No markdown. No bullet points. Keep it under 18 words.',
            },
            {
              role: 'user',
              content: `Greet ${safeName} and offer help for today.`,
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

        for await (const chunk of upstream.body) {
          rawBuffer += decoder.decode(chunk, { stream: true })
          const lines = rawBuffer.split('\n')
          rawBuffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const json = JSON.parse(line)
              const content = json.message?.content ?? ''
              if (content) emit({ word: content })
              if (json.done) {
                controller.enqueue(enc.encode('data: [DONE]\n\n'))
                controller.close()
                return
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

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
