// Tool execution: dispatches a single tool call and pushes the result onto
// followupMessages. The planner runs this in a loop.

import { log } from './logger'
import { normalizeQuery, normalizeUrl } from './toolCalls'
import { buildFallbackWebQuery, readWebpage, webSearch } from './web'
import { deepResearch } from './research'
import { summarizePage } from './llmCalls'
import { buildCurrentTimePayload, buildDatedQuery } from './queries'

const PAGE_SUMMARIZE_THRESHOLD = 2000 // chars — below this, pass content as-is

function hostnameOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export async function executeToolCall(call, followupMessages, sourceUrls, emit, model) {
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
    emit({ status: `Reading ${hostnameOf(url)}…` })
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
      emit({ status: `Summarizing ${hostnameOf(url)}…` })
      result.content = await summarizePage(model, result.url, result.title, result.content)
      result.summarized = true
    }

    log.toolResult('read_webpage', {
      url: result?.url,
      error: result?.error,
      summarized: result?.summarized ?? false,
      contentLength: result?.content?.length ?? 0,
      fallbackCount: result?.fallbackResults?.length ?? 0,
    })
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
