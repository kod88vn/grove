import { describe, expect, it } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import { parseSseStream } from './sseStream'

if (!global.TextDecoder) {
  global.TextDecoder = NodeTextDecoder
}

function makeResponse(chunks) {
  const encoder = new NodeTextEncoder()
  return {
    body: new NodeReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    }),
  }
}

describe('parseSseStream', () => {
  it('parses newline-delimited SSE JSON events', async () => {
    const response = makeResponse(['data: {"word":"Hello"}\n\n', 'data: {"word":" world"}\n\n'])
    const events = []

    for await (const event of parseSseStream(response)) {
      events.push(event)
    }

    expect(events).toEqual([{ word: 'Hello' }, { word: ' world' }])
  })

  it('skips malformed JSON and [DONE] markers', async () => {
    const response = makeResponse([
      'data: {incomplete\n\n',
      'data: {"word":"Hello"}\n\n',
      'data: [DONE]\n\n',
    ])

    const events = []
    for await (const event of parseSseStream(response)) {
      events.push(event)
    }

    expect(events).toEqual([{ word: 'Hello' }])
  })

  it('returns nothing when response has no body', async () => {
    const events = []
    for await (const event of parseSseStream({ body: null })) {
      events.push(event)
    }
    expect(events).toEqual([])
  })
})