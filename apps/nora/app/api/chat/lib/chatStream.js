import { MAX_TOOL_PLANNING_PASSES, SSE_HEADERS, DEFAULT_MODEL } from './constants'
import { compressHistory, callOllama } from './ollama'
import { withSystemMessage } from './prompt'
import { extractToolCalls, normalizeQuery, normalizeUrl } from './toolCalls'
import { TOOL_DEFINITIONS } from './tools'
import { log } from './logger'
import { deepResearch } from './research'
import {
  buildFallbackWebQuery,
  dedupeSourceUrls,
  readWebpage,
  webSearch,
} from './web'

const PAGE_SUMMARIZE_THRESHOLD = 2000 // chars — below this, pass content as-is

async function summarizePage(model, url, title, content) {
  try {
    const res = await callOllama({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise summarizer. Given a webpage, extract and return only the key facts, data points, and answers relevant to a user query. Be concise — 3 to 6 sentences max. Preserve specific names, numbers, dates, and URLs.',
        },
        {
          role: 'user',
          content: `URL: ${url}\nTitle: ${title}\n\nContent:\n${content}`,
        },
      ],
      stream: false,
      options: { num_predict: 256, think: false },
    })
    if (!res.ok) return content.slice(0, 2000)
    const json = await res.json()
    const summary = json.message?.content?.trim()
    log.toolResult('summarize_page', { url, originalLength: content.length, summaryLength: summary?.length ?? 0 })
    return summary || content.slice(0, 2000)
  } catch {
    return content.slice(0, 2000)
  }
}

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

async function executeToolCall(call, followupMessages, sourceUrls, emit, model) {
  const fn = call?.function

  if (fn?.name === 'get_current_time') {
    log.toolExecute('get_current_time', {})
    const payload = buildCurrentTimePayload()
    log.toolResult('get_current_time', payload)
    followupMessages.push({
      role: 'tool',
      tool_name: 'get_current_time',
      content: JSON.stringify(payload),
    })
    return
  }

  if (fn?.name === 'read_webpage') {
    const url = normalizeUrl(fn.arguments)
    log.toolExecute('read_webpage', { url })
    const hostname = url ? (() => { try { return new URL(url).hostname } catch { return url } })() : url
    emit({ status: `Reading ${hostname}…` })
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

    if (!result.error && result.content && result.content.length > PAGE_SUMMARIZE_THRESHOLD) {
      const hostname = url ? (() => { try { return new URL(url).hostname } catch { return url } })() : url
      emit({ status: `Summarizing ${hostname}…` })
      result.content = await summarizePage(model, result.url, result.title, result.content)
      result.summarized = true
    }

    log.toolResult('read_webpage', { url: result?.url, error: result?.error, summarized: result?.summarized ?? false, contentLength: result?.content?.length ?? 0, fallbackCount: result?.fallbackResults?.length ?? 0 })
    followupMessages.push({
      role: 'tool',
      tool_name: 'read_webpage',
      content: JSON.stringify(result),
    })
    return
  }

  if (fn?.name === 'deep_research') {
    const topic = fn.arguments?.topic ?? normalizeQuery(fn.arguments)
    emit({ researching: true, topic })
    const result = await deepResearch(model, topic, (progress) => {
      if (progress.status) emit({ status: progress.status })
      emit({ researchProgress: progress })
    })
    emit({ researching: false, topic })
    for (const url of result.sourceUrls) {
      if (url) sourceUrls.push(url)
    }
    followupMessages.push({
      role: 'tool',
      tool_name: 'deep_research',
      content: JSON.stringify(result),
    })
    return
  }

  if (fn?.name !== 'web_search') {
    log.toolExecute('unknown_tool', { name: fn?.name })
    return
  }

  const rawQuery = normalizeQuery(fn.arguments)
  const query = buildDatedQuery(rawQuery)
  log.toolExecute('web_search', { rawQuery, query })
  emit({ searching: true, query: rawQuery })
  const results = await webSearch(query)
  log.toolResult('web_search', { resultCount: results.length, urls: results.map((r) => r?.url).filter(Boolean) })
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
    options: { num_predict: 512, think: false },
  })

  if (!firstPass.ok) {
    const text = await firstPass.text()
    throw new Error(text || 'Tool planning request failed')
  }

  const firstResult = await firstPass.json()
  log.planningResponse(0, firstResult.message)
  const followupMessages = [...messagesWithSystem]
  const sourceUrls = []
  let toolCalls = extractToolCalls(firstResult.message)
  log.toolCallsExtracted(0, toolCalls)
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
      await executeToolCall(call, followupMessages, sourceUrls, emit, model)
    }

    const nextPlan = await callOllama({
      model,
      messages: followupMessages,
      stream: false,
      tools: TOOL_DEFINITIONS,
      options: { num_predict: 512, think: false },
    })

    if (!nextPlan.ok) {
      const text = await nextPlan.text()
      throw new Error(text || 'Tool follow-up planning request failed')
    }

    planningResult = await nextPlan.json()
    log.planningResponse(pass + 1, planningResult.message)
    toolCalls = extractToolCalls(planningResult.message)
    log.toolCallsExtracted(pass + 1, toolCalls)
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
        const userMessage = messages.findLast((m) => m.role === 'user')?.content ?? ''
        log.request(model, userMessage)
        emit({ status: 'Thinking…' })
        const compressed = await compressHistory(model, messages)
        const messagesWithSystem = withSystemMessage(compressed)

        const { followupMessages, sourceUrls } =
          await planTools(model, messagesWithSystem, emit)

        if (sourceUrls.length > 0) {
          emit({ sources: sourceUrls })
        }

        emit({ status: null })
        log.streamingPass()
        await streamFinalAnswer(model, followupMessages, emit, controller, enc)
      } catch (error) {
        log.error(error)
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
