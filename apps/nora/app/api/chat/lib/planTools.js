// Tool planning loop. Given the system+user messages, runs Ollama planning
// passes, executes any tool calls the model emits, and (when needed) forces
// fact-verification searches before the final answer is streamed.

import { MAX_TOOL_PLANNING_PASSES } from './constants'
import { callAI } from './callAI'
import { extractToolCalls, normalizeQuery, normalizeUrl } from './toolCalls'
import { TOOL_DEFINITIONS } from './tools'
import { log } from './logger'
import { dedupeSourceUrls, readWebpage, webSearch } from './web'
import { isLowConfidenceSource } from './sources'
import { classifyIntent } from './intent'

import { buildDatedQuery } from './queries'
import { executeToolCall } from './toolExecution'

function hostnameOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function announceFirstTool(toolCalls, emit) {
  const firstTool = toolCalls[0]?.function?.name
  if (firstTool === 'web_search') {
    const rawQuery = normalizeQuery(toolCalls[0]?.function?.arguments)
    emit({ status: rawQuery ? `Searching for "${rawQuery}"…` : 'Searching the web…' })
  } else if (firstTool === 'read_webpage') {
    const url = normalizeUrl(toolCalls[0]?.function?.arguments)
    emit({ status: `Reading ${url ? hostnameOf(url) : 'page'}…` })
  } else if (firstTool === 'deep_research') {
    emit({ status: 'Researching in depth…' })
  } else {
    emit({ status: 'Working on it…' })
  }
}

async function runFirstPlanningPass(model, messagesWithSystem, forceVerificationFromPlanner) {
  if (forceVerificationFromPlanner) {
    log.planningResponse(0, { role: 'assistant', content: '[skipped: forced verification]' })
    log.toolCallsExtracted(0, [])
    return { planningResult: null, toolCalls: [] }
  }

  const firstPass = await callAI({
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

  const planningResult = await firstPass.json()
  log.planningResponse(0, planningResult.message)
  const toolCalls = extractToolCalls(planningResult.message)
  log.toolCallsExtracted(0, toolCalls)
  return { planningResult, toolCalls }
}

async function runLiveDataSearch(userMessage, followupMessages, sourceUrls, emit) {
  const rawQuery = normalizeQuery(userMessage) || userMessage
  emit({ status: `Searching for "${rawQuery}"…` })
  emit({ searching: true, query: rawQuery })
  const results = await webSearch(rawQuery)
  emit({ searching: false, query: rawQuery, resultCount: results.length })
  for (const result of results) {
    if (result?.url) sourceUrls.push(result.url)
  }
  followupMessages.push({
    role: 'assistant',
    content: '',
    tool_calls: [{ type: 'function', function: { name: 'web_search', arguments: { query: rawQuery } } }],
  })
  followupMessages.push({
    role: 'tool',
    tool_name: 'web_search',
    content: JSON.stringify({ query: rawQuery, results }),
  })

  // For live data the search snippet isn't enough — read the top reliable URL
  // so the final-answer pass has actual page content.
  const liveUrls = dedupeSourceUrls(sourceUrls)
  const topLiveUrl = liveUrls.find((u) => !isLowConfidenceSource(u)) ?? liveUrls[0]
  if (topLiveUrl) {
    emit({ status: `Reading ${hostnameOf(topLiveUrl)}…` })
    const page = await readWebpage(topLiveUrl)
    followupMessages.push({
      role: 'assistant',
      content: '',
      tool_calls: [{ type: 'function', function: { name: 'read_webpage', arguments: { url: topLiveUrl } } }],
    })
    followupMessages.push({
      role: 'tool',
      tool_name: 'read_webpage',
      content: JSON.stringify(page),
    })
  }
}


export async function planTools(model, messagesWithSystem, emit, options = {}) {
  const forceVerificationFromPlanner = Boolean(options.forceVerification)

  // When orchestrator already required verification, skip the wasteful first
  // planning model call (which often returns nothing useful and adds 10–30s
  // latency). The shouldForceVerification block below runs the actual searches.
  let { planningResult, toolCalls } = await runFirstPlanningPass(
    model,
    messagesWithSystem,
    forceVerificationFromPlanner,
  )

  const followupMessages = [...messagesWithSystem]
  const sourceUrls = []

  const userMessage = messagesWithSystem.findLast((m) => m.role === 'user')?.content ?? ''

  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    announceFirstTool(toolCalls, emit)
  }

  const noToolCalls = !Array.isArray(toolCalls) || toolCalls.length === 0

  // LLM-based semantic intent classification via classifyIntent().
  // NO keyword matching — all decisions are made by calling Ollama with semantic understanding.
  // 
  // classifyIntent() never throws — on failure it returns { requiresSearch: true, reason: 'llm_unavailable', ... }
  // as a fail-safe default so factual queries get web search verification.
  let intentResult = null
  if (noToolCalls) {
    intentResult = await classifyIntent(model, userMessage)
  }

  // classifyIntent() is the primary authority. Orchestrator's requireVerification acts as a secondary trigger
  // to ensure factual queries get searched even if the classifier misclassifies them.
  // All search-requiring queries go through runLiveDataSearch (single search + page read).
  const shouldForceLiveSearch = noToolCalls && (intentResult?.requiresSearch === true || forceVerificationFromPlanner)

  if (shouldForceLiveSearch) {
    await runLiveDataSearch(userMessage, followupMessages, sourceUrls, emit)
    return { followupMessages, sourceUrls: dedupeSourceUrls(sourceUrls), toolCalls: [], planningResult }
  }

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

    const nextPlan = await callAI({
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

