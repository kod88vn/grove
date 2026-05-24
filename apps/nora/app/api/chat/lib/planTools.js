// Tool planning loop. Given the system+user messages, runs Ollama planning
// passes, executes any tool calls the model emits, and (when needed) forces
// fact-verification searches before the final answer is streamed.

import { MAX_TOOL_PLANNING_PASSES } from './constants'
import { callOllama } from './ollama'
import { extractToolCalls, normalizeQuery, normalizeUrl } from './toolCalls'
import { TOOL_DEFINITIONS } from './tools'
import { log } from './logger'
import { dedupeSourceUrls, readWebpage, webSearch } from './web'
import { isLowConfidenceSource } from './sources'
import { classifyIntent } from './intent'
import { assessVerificationNeed } from './llmCalls'
import { buildVerificationQueries, buildVerificationReport } from './verification'
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

async function runVerificationSearches(userMessage, semanticHints, followupMessages, sourceUrls, emit) {
  emit({ status: 'Verifying facts with current sources…' })
  const verificationQueries = [...buildVerificationQueries(userMessage), ...semanticHints]
  const dedupedQueries = [...new Set(verificationQueries)]

  // Run all verification searches in parallel to avoid serial round-trips.
  const searchTasks = dedupedQueries.map(async (rawQuery) => {
    const query = buildDatedQuery(rawQuery)
    emit({ searching: true, query: rawQuery })
    const results = await webSearch(query)
    emit({ searching: false, query: rawQuery, resultCount: results.length })
    return { rawQuery, query, results }
  })

  const settled = await Promise.allSettled(searchTasks)
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue
    const { rawQuery, query, results } = outcome.value
    for (const result of results) {
      if (result?.url) sourceUrls.push(result.url)
    }
    followupMessages.push({
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          type: 'function',
          function: { name: 'web_search', arguments: { query: rawQuery } },
        },
      ],
    })
    followupMessages.push({
      role: 'tool',
      tool_name: 'web_search',
      content: JSON.stringify({ query, results, forcedVerification: true }),
    })
  }
}

async function readSinglePrimarySource(url, followupMessages, emit, statusLabel) {
  emit({ status: `Reading ${hostnameOf(url)} ${statusLabel}…` })
  const page = await readWebpage(url)
  followupMessages.push({
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        type: 'function',
        function: { name: 'read_webpage', arguments: { url } },
      },
    ],
  })
  followupMessages.push({
    role: 'tool',
    tool_name: 'read_webpage',
    content: JSON.stringify({ ...page, forcedVerification: true }),
  })
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
  let intentResult = null
  if (noToolCalls) {
    intentResult = await classifyIntent(model, userMessage)
  }

  // Live data check: LLM classifier determines if we need live search.
  // Replaces the old requiresLiveData() keyword-based check (weather/stock/sports patterns).
  const shouldForceLiveSearch = noToolCalls && intentResult?.requiresSearch === true

  if (shouldForceLiveSearch) {
    await runLiveDataSearch(userMessage, followupMessages, sourceUrls, emit)
    return { followupMessages, sourceUrls: dedupeSourceUrls(sourceUrls), toolCalls: [], planningResult }
  }

  // Skip the LLM-based verification need assessment when orchestrator already
  // forced verification (saves one slow Ollama call).
  const semanticVerification = noToolCalls && !forceVerificationFromPlanner
    ? await assessVerificationNeed(model, userMessage)
    : { required: false, confidence: 'low', reason: forceVerificationFromPlanner ? 'orchestrator_forced' : 'tool_call_present', queryHints: [] }

  // Verification requirement: ONLY use orchestrator force flag or LLM classifier result.
  // The old requiresFactVerification() keyword-based check has been removed — it was
  // redundant with classifyIntent and caused false positives on conversational queries.
  const shouldForceVerification = noToolCalls && (
    forceVerificationFromPlanner
    || semanticVerification.required
  )

  if (shouldForceVerification) {
    await runVerificationSearches(userMessage, semanticVerification.queryHints, followupMessages, sourceUrls, emit)

    // Pass forceRequired from the LLM classifier (or test-mode keyword fallback).
    const verificationReport = buildVerificationReport(userMessage, sourceUrls, { forceRequired: true })
    const dedupedSourceUrls = dedupeSourceUrls(sourceUrls)
    if (verificationReport.status === 'low_confidence' && dedupedSourceUrls.length === 1) {
      await readSinglePrimarySource(dedupedSourceUrls[0], followupMessages, emit, 'for primary evidence')
    }

    // Skip the extra planning LLM call when searches already produced a
    // verified result — the evidence is already in followupMessages and the
    // final streaming answer can use it directly.
    if (verificationReport.status !== 'verified') {
      const verificationPlan = await callOllama({
        model,
        messages: followupMessages,
        stream: false,
        tools: TOOL_DEFINITIONS,
        options: { num_predict: 512, think: false },
      })

      if (!verificationPlan.ok) {
        const text = await verificationPlan.text()
        throw new Error(text || 'Verification planning request failed')
      }

      planningResult = await verificationPlan.json()
      log.planningResponse(1, planningResult.message)
      toolCalls = extractToolCalls(planningResult.message)
      log.toolCallsExtracted(1, toolCalls)
    } else {
      // For precise-value questions (version numbers, prices, etc.) the search
      // result only supplies a URL — the model needs the actual page content.
      // Read the top reliable source before streaming the final answer.
      // Note: intentResult.searchHints from LLM classifier guide search queries instead of
      // the old requiresPreciseValue() keyword pattern matching.
      if (intentResult?.searchHints && intentResult.searchHints.length > 0) {
        const freshDedupe = dedupeSourceUrls(sourceUrls)
        const topUrl = freshDedupe.find((u) => !isLowConfidenceSource(u)) ?? freshDedupe[0]
        if (topUrl) {
          await readSinglePrimarySource(topUrl, followupMessages, emit, 'for exact value')
        }
      }
      toolCalls = []
    }
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
