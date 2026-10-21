// OpenAI-compatible AI backend client (LM Studio, TensorFold, or any /v1 server).
// The backend exposes an OpenAI-compatible API (LM Studio at http://<host>:1234/v1,
// TensorFold at http://<host>:8080/v1). Responses are normalized to match
// Ollama's format so existing callers work unchanged.

import { log } from './logger'

const LMSTUDIO_LOG_PREFIX = '[LMSTUDIO]'

function lmstudioLog(...args) {
  console.log(LMSTUDIO_LOG_PREFIX, ...args)
}

function lmstudioError(...args) {
  console.error(LMSTUDIO_LOG_PREFIX, ...args)
}

/**
 * Resolve the OpenAI-compatible AI backend base URL (no trailing slash).
 * AI_BASE_URL wins (e.g. TensorFold); LMSTUDIO_BASE_URL is the legacy fallback
 * so existing host configs keep working unchanged. Empty string when unset.
 */
export function getAIBaseUrl() {
  const raw = String(process.env.AI_BASE_URL || process.env.LMSTUDIO_BASE_URL || '').trim()
  return raw.replace(/\/+$/, '')
}

/**
 * Build the LMStudio-compatible request payload.
 */
function buildLmstudioPayload(payload) {
  const messages = (payload.messages || []).map((m) => {
    // Convert "system" to OpenAI/LMStudio "system" role (compatible)
    const role = m.role === 'system' ? 'system' : m.role
    return { role, content: m.content }
  })

  const lmstudioPayload = {
    model: payload.model,
    messages,
    stream: payload.stream !== false, // default to streaming
  }

  // Map options to OpenAI/LMStudio params
  const options = payload.options || {}
  if (options.num_predict) {
    lmstudioPayload.max_tokens = options.num_predict
  }
  if (typeof options.temperature === 'number') {
    lmstudioPayload.temperature = options.temperature
  } else if (!options.hasOwnProperty('temperature')) {
    // Default temperature to ~0.7 for reasonable quality only when caller didn't specify one
    lmstudioPayload.temperature = 0.7
  }

  // Forward thinking control to LM Studio (Qwen3 and other thinking models support enable_thinking)
  if (options.think === false) {
    lmstudioPayload.enable_thinking = false
  }

  // Forward response_format for deterministic JSON output (e.g., classification)
  if (options.response_format) {
    lmstudioPayload.response_format = options.response_format
  }

  if (Array.isArray(payload.tools) && payload.tools.length > 0) {
    lmstudioPayload.tools = payload.tools
  }

  return lmstudioPayload
}

// Export for testing
export { buildLmstudioPayload }

/**
 * Parse an LMStudio SSE stream and yield normalized events.
 * Converts: { choices: [{ delta: { content: "..." } }] } → normalized events
 */
async function* parseLMStudioStream(responseBody, model) {
  const decoder = new TextDecoder()
  let buffer = ''
  let chunkIndex = 0

  for await (const chunk of responseBody) {
    buffer += decoder.decode(chunk, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue

      const data = trimmed.slice(6).trim()
      if (data === '[DONE]') {
        // Final done event
        yield {
          message: {},
          done: true,
          total_duration: 0,
          load_duration: 0,
          prompt_eval_count: 0,
          eval_count: 0,
        }
        return
      }

      try {
        const json = JSON.parse(data)

        // Handle both chat.completion.chunk and completions chunk formats
        const choice = json.choices?.[0]
        if (!choice) continue

        // Extract content from delta (streaming) or message (non-streaming)
        const delta = choice.delta || {}
        const content = delta.content ?? ''
        const reasoningContent = delta.reasoning_content ?? choice.message?.reasoning_content ?? ''

        // Map reasoning_content to thinking
        // Only emit thinking if it contains actual content (not just leading whitespace + period)
        let normalizedThinking = null
        if (reasoningContent && reasoningContent.trim().length > 1) {
          // Skip pure "system hint" markers like ". This is the beginning of..." 
          const trimmedReasoning = reasoningContent.trim()
          // If it starts with a period followed by space and looks like a reasoner prefix, skip
          if (!trimmedReasoning.startsWith('. ') || trimmedReasoning.split(/\.\s+/).length > 2) {
            normalizedThinking = reasoningContent
          }
        }

        const event = {
          message: {},
        }

        if (content) {
          event.message.content = content
        }

        if (normalizedThinking) {
          event.message.thinking = normalizedThinking
        }

        // Use a unique per-chunk key so streamAnswer.js deduplication never fires.
        // LMStudio's json.created is Unix-seconds — identical across all chunks in a response.
        event.created_at = `${json.id}-${chunkIndex++}`

        yield event
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}

/**
 * Call an LMStudio-compatible API (e.g., at http://m5:1234/v1).
 * Returns a Response object with normalized SSE format.
 */
export async function callLMStudio(payload) {
  const baseUrl = getAIBaseUrl()
  const model = payload?.model || '(unnamed)'
  const messageCount = Array.isArray(payload?.messages) ? payload.messages.length : 0

  // Truncate system prompt from logging
  const firstMsgSummary = payload?.messages?.[0]
    ? `${payload.messages[0].role}: ${String(payload.messages[0].content || '').slice(0, 100)}`
    : '(no messages)'

  lmstudioLog('--- CALL START ---')
  lmstudioLog('Base URL:', baseUrl)
  lmstudioLog('Model:', model)
  lmstudioLog('Messages:', messageCount, '| First msg:', firstMsgSummary)
  if (payload?.options) lmstudioLog('Options:', JSON.stringify(payload.options))

  const url = `${baseUrl}/chat/completions`
  lmstudioLog('Fetching:', url)

  const lmstudioPayload = buildLmstudioPayload(payload)
  lmstudioLog('Request body model:', lmstudioPayload.model, 'max_tokens:', lmstudioPayload.max_tokens, 'temperature:', lmstudioPayload.temperature)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization header if LMSTUDIO_API_KEY is set (for services that require it)
        ...(process.env.LMSTUDIO_API_KEY ? { Authorization: `Bearer ${process.env.LMSTUDIO_API_KEY}` } : {}),
      },
      body: JSON.stringify(lmstudioPayload),
    })
  } catch (fetchErr) {
    lmstudioError('Fetch failed:', fetchErr.message)
    const fakeError = {
      ok: false,
      status: 0,
      statusText: 'network_error',
      async json() { return {} },
      async text() { return fetchErr.message },
    }
    return fakeError
  }

  lmstudioLog('Response status:', res.status, res.statusText)

  // If not streaming or a non-streaming request, wrap the response in normalized format
  if (!payload?.stream) {
    const clonedRes = res.clone()
    let json
    try {
      json = await clonedRes.json()
    } catch {
      return res // Return raw if we can't parse (let caller handle it)
    }

    const messageObj = json.choices?.[0]?.message || {}
    let content = messageObj.content ?? ''
    const reasoningContent = messageObj.reasoning_content ?? ''
    const toolCalls = messageObj.tool_calls || []

    // For thinking models: if content is empty but reasoning exists, try to extract JSON from reasoning
    // Some thinking models put final answer in reasoning_content instead of content
    if (!content.trim() && reasoningContent.trim()) {
      // Try to find JSON in reasoning text
      const jsonMatch = reasoningContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        content = jsonMatch[0]
      } else {
        // No JSON in reasoning — this is a thinking model that only thinks, no actual output
        lmstudioError('Response content is empty with reasoning only. Full response:', JSON.stringify(json).slice(0, 500))
      }
    } else if (content === undefined || content === null) {
      lmstudioError('Response missing choices[0].message.content. Full response:', JSON.stringify(json).slice(0, 500))
    } else if (typeof content === 'string' && !content.trim()) {
      lmstudioError('Response choices[0].message.content is empty. Full response:', JSON.stringify(json).slice(0, 500))
    } else {
      lmstudioLog('Response content[0:80]:', String(content).slice(0, 80))
    }

    // Wrap in normalized format: { message: { content: "...", thinking?: "..." }, done: true, model: "..." }
    const normalizedResponse = {
      message: {},
      done: true,
      model: json.model || lmstudioPayload?.model || (payload?.model || '(unnamed)'),
      total_duration: 0,
      load_duration: 0,
      prompt_eval_count: json.usage?.prompt_tokens ?? 0,
      eval_count: json.usage?.completion_tokens ?? 0,
    }
    if (content) normalizedResponse.message.content = content
    if (reasoningContent.trim()) normalizedResponse.message.thinking = reasoningContent
    if (toolCalls.length > 0) normalizedResponse.message.tool_calls = toolCalls

    return new Response(JSON.stringify(normalizedResponse), {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  // For streaming: wrap the LMStudio SSE stream into normalized SSE format
  if (!res.body) {
    lmstudioError('No response body for streaming request')
    return res
  }

  // Create a ReadableStream that translates LMStudio SSE to normalized format
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      
      for await (const event of parseLMStudioStream(res.body, model)) {
        // Skip empty events for non-final chunks (like Ollama's leading newlines)
        if (!event.message?.content && !event.message?.thinking && !event.done) {
          continue
        }

        // Build normalized SSE data line
        const normalizedEvent = {
          model: model,
          created_at: event.created_at,
          message: {},
        }

        if (event.message.content) {
          normalizedEvent.message.content = event.message.content
        }

        if (event.message.thinking) {
          normalizedEvent.message.thinking = event.message.thinking
        }

        if (event.done) {
          normalizedEvent.done = true
        }

        controller.enqueue(enc.encode(`data: ${JSON.stringify(normalizedEvent)}\n\n`))
      }

      controller.enqueue(enc.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  // Return a Response with the transformed stream, preserving SSE headers
  return new Response(stream, {
    status: res.status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

export { parseLMStudioStream }