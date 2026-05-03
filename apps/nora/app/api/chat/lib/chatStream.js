import { MAX_TOOL_PLANNING_PASSES, SSE_HEADERS } from './constants'
import { compressHistory, callOllama } from './ollama'
import { withSystemMessage } from './prompt'
import { extractToolCalls, normalizeQuery, normalizeUrl } from './toolCalls'
import { TOOL_DEFINITIONS } from './tools'
import {
  buildFallbackWebQuery,
  dedupeSourceUrls,
  readWebpage,
  webSearch,
} from './web'

function buildCurrentTimePayload() {
  const now = new Date()
  return {
    iso: now.toISOString(),
    date: now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    time: now.toLocaleTimeString('en-US'),
  }
}

function buildDatedQuery(query) {
  const today = new Date()
  const dateTag = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return `${query} ${dateTag}`
}

async function executeToolCall(call, followupMessages, sourceUrls, emit) {
  const fn = call?.function

  if (fn?.name === 'get_current_time') {
    followupMessages.push({
      role: 'tool',
      tool_name: 'get_current_time',
      content: JSON.stringify(buildCurrentTimePayload()),
    })
    return
  }

  if (fn?.name === 'read_webpage') {
    const url = normalizeUrl(fn.arguments)
    const result = await readWebpage(url)
    if (result?.url) sourceUrls.push(result.url)

    if (result?.error) {
      const fallbackQuery = buildFallbackWebQuery(url)
      if (fallbackQuery) {
        emit({ searching: true, query: fallbackQuery })
        const fallbackResults = await webSearch(fallbackQuery)
        emit({
          searching: false,
          query: fallbackQuery,
          resultCount: fallbackResults.length,
        })

        for (const item of fallbackResults) {
          if (item?.url) sourceUrls.push(item.url)
        }

        result.fallbackQuery = fallbackQuery
        result.fallbackResults = fallbackResults
      }
    }

    followupMessages.push({
      role: 'tool',
      tool_name: 'read_webpage',
      content: JSON.stringify(result),
    })
    return
  }

  if (fn?.name !== 'web_search') return

  const rawQuery = normalizeQuery(fn.arguments)
  const query = buildDatedQuery(rawQuery)
  emit({ searching: true, query: rawQuery })
  const results = await webSearch(query)
  emit({ searching: false, query: rawQuery, resultCount: results.length })
  for (const result of results) {
    if (result?.url) sourceUrls.push(result.url)
  }

  followupMessages.push({
    role: 'tool',
    tool_name: 'web_search',
    content: JSON.stringify({ query, results }),
  })
}

async function planTools(model, messagesWithSystem, emit) {
  const firstPass = await callOllama({
    model,
    messages: messagesWithSystem,
    stream: false,
    tools: TOOL_DEFINITIONS,
    options: { num_predict: 1024 },
  })

  if (!firstPass.ok) {
    const text = await firstPass.text()
    throw new Error(text || 'Tool planning request failed')
  }

  const firstResult = await firstPass.json()
  const followupMessages = [...messagesWithSystem]
  const sourceUrls = []
  let toolCalls = extractToolCalls(firstResult.message)
  let planningResult = firstResult

  for (let pass = 0; pass < MAX_TOOL_PLANNING_PASSES; pass++) {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      break
    }

    followupMessages.push({
      role: 'assistant',
      content: '',
      tool_calls: toolCalls,
    })

    for (const call of toolCalls) {
      await executeToolCall(call, followupMessages, sourceUrls, emit)
    }

    const nextPlan = await callOllama({
      model,
      messages: followupMessages,
      stream: false,
      tools: TOOL_DEFINITIONS,
      options: { num_predict: 1024 },
    })

    if (!nextPlan.ok) {
      const text = await nextPlan.text()
      throw new Error(text || 'Tool follow-up planning request failed')
    }

    planningResult = await nextPlan.json()
    toolCalls = extractToolCalls(planningResult.message)
  }

  return {
    followupMessages,
    sourceUrls: dedupeSourceUrls(sourceUrls),
    toolCalls,
    planningResult,
  }
}

async function streamFinalAnswer(model, followupMessages, emit, controller, enc) {
  const upstream = await callOllama({
    model,
    messages: followupMessages,
    stream: true,
  })

  if (!upstream.ok) {
    const text = await upstream.text()
    throw new Error(text || 'Final response request failed')
  }

  const decoder = new TextDecoder()
  const seen = new Set()
  let buffer = ''
  let contentStarted = false

  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const json = JSON.parse(line)
        const key = json.created_at
        if (key) {
          if (seen.has(key)) continue
          seen.add(key)
        }

        const thinking = json.message?.thinking ?? ''
        const content = json.message?.content ?? ''

        if (thinking && !contentStarted) {
          emit({ thinking })
        }

        if (content) {
          if (!contentStarted) {
            contentStarted = true
            emit({ thinkingDone: true })
          }
          emit({ word: content })
        }

        if (json.done) {
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  controller.enqueue(enc.encode('data: [DONE]\n\n'))
  controller.close()
}

export function streamResponse(model, messages) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const emit = (obj) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        const compressed = await compressHistory(model, messages)
        const messagesWithSystem = withSystemMessage(compressed)

        const { followupMessages, sourceUrls, toolCalls, planningResult } =
          await planTools(model, messagesWithSystem, emit)

        if (sourceUrls.length > 0) {
          emit({ sources: sourceUrls })
        }

        const hasRemainingToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0
        const plannedAnswer = planningResult.message?.content ?? ''

        if (!hasRemainingToolCalls && plannedAnswer) {
          emit({ thinkingDone: true })
          emit({ word: plannedAnswer })
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        await streamFinalAnswer(model, followupMessages, emit, controller, enc)
      } catch (error) {
        emit({ searching: false })
        emit({ thinkingDone: true })
        emit({ word: `Error: ${error.message || 'Request failed'}` })
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: SSE_HEADERS,
  })
}
