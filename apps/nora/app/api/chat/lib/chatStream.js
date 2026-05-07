// Top-level orchestration for the chat streaming endpoint.
//
// Pipeline (read top-to-bottom — each step is a separate module):
//   1. orchestratorClient.getExecutionPlan        → routing decision
//   2. ollama.compressHistory + prompt.withSystemMessage → message prep
//   3. planTools                                  → tool/verification planning
//   4. verification.buildVerificationReport       → judge evidence
//   5. trusted-outlet escalation (rounds 2 + 3)   → in this file
//   6. streamAnswer.streamFinalAnswer             → SSE the answer
//
// All public symbols imported by tests are re-exported from the bottom of
// this file so the public surface stays stable.

import { SSE_HEADERS } from './constants'
import { compressHistory } from './ollama'
import { withSystemMessage } from './prompt'
import { normalizeQuery } from './toolCalls'
import { log } from './logger'
import { deepResearch } from './research'
import { getExecutionPlan } from './orchestratorClient'
import { dedupeSourceUrls, readWebpage, webSearch } from './web'
import { isLowConfidenceSource, isTrustedNewsSource } from './sources'
import { requiresPreciseValue } from './intent'
import { buildDatedQuery, buildTrustedOutletQueries } from './queries'
import { safeJsonParse } from './llmCalls'
import {
  buildVerificationReport,
  buildVerificationSystemMessage,
} from './verification'
import { planTools } from './planTools'
import { streamFinalAnswer } from './streamAnswer'

const isUnverifiedStatus = (status) =>
  status === 'unverified' || status === 'weak' || status === 'low_confidence'

function hostnameOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// Round 2: hit the trusted-outlet shortlist and read the first match.
async function escalateTrustedOutlets(userMessage, followupMessages, sourceUrls, emit) {
  emit({ status: 'Still verifying — searching trusted outlets…' })

  const trustedQueries = buildTrustedOutletQueries(userMessage)
  for (const rawQuery of trustedQueries) {
    const query = buildDatedQuery(rawQuery)
    emit({ searching: true, query: rawQuery })
    const results = await webSearch(query)
    emit({ searching: false, query: rawQuery, resultCount: results.length })

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
      content: JSON.stringify({ query, results, forcedVerification: true, escalation: 'trusted_outlet_search' }),
    })
  }

  const dedupedNow = dedupeSourceUrls(sourceUrls)
  const trustedUrl = dedupedNow.find((url) => isTrustedNewsSource(url))
  const alreadyReadTrusted = followupMessages.some((m) => {
    const parsed = m.tool_name === 'read_webpage' ? safeJsonParse(m.content || '{}') : null
    const hasTrustedToolResult = m.tool_name === 'read_webpage' && isTrustedNewsSource(parsed?.url)
    const hasTrustedToolCall = m.tool_calls?.some(
      (c) => c.function?.name === 'read_webpage' && isTrustedNewsSource(c.function?.arguments?.url),
    )
    return Boolean(hasTrustedToolResult || hasTrustedToolCall)
  })

  if (trustedUrl && !alreadyReadTrusted) {
    emit({ status: `Reading ${hostnameOf(trustedUrl)} for confirmation…` })
    const page = await readWebpage(trustedUrl)
    followupMessages.push({
      role: 'assistant',
      content: '',
      tool_calls: [{ type: 'function', function: { name: 'read_webpage', arguments: { url: trustedUrl } } }],
    })
    followupMessages.push({
      role: 'tool',
      tool_name: 'read_webpage',
      content: JSON.stringify({ ...page, forcedVerification: true, escalation: 'trusted_outlet_read' }),
    })
    if (page?.url) sourceUrls.push(page.url)
  }
}

// Round 3: read top unread sources + try recommendation/comparison queries.
async function escalateRound3(userMessage, followupMessages, sourceUrls, emit) {
  emit({ status: 'Running third research pass…' })

  const alreadyReadUrls = new Set(
    followupMessages
      .filter((m) => m.tool_name === 'read_webpage')
      .map((m) => { try { return JSON.parse(m.content || '{}').url } catch { return null } })
      .filter(Boolean),
  )

  const unreadUrls = dedupeSourceUrls(sourceUrls).filter((u) => !alreadyReadUrls.has(u))
  for (const url of unreadUrls.slice(0, 2)) {
    try {
      emit({ status: `Reading ${hostnameOf(url)}…` })
      const page = await readWebpage(url)
      followupMessages.push({
        role: 'assistant',
        content: '',
        tool_calls: [{ type: 'function', function: { name: 'read_webpage', arguments: { url } } }],
      })
      followupMessages.push({
        role: 'tool',
        tool_name: 'read_webpage',
        content: JSON.stringify({ ...page, forcedVerification: true, escalation: 'round3_read' }),
      })
      if (page?.url) sourceUrls.push(page.url)
    } catch {
      // skip unreadable pages
    }
  }

  const base = normalizeQuery(userMessage)
  const round3Queries = [
    buildDatedQuery(`${base} recommendation review`),
    buildDatedQuery(`${base} comparison benchmark`),
  ]
  for (const query of round3Queries) {
    emit({ searching: true, query })
    const results = await webSearch(query)
    emit({ searching: false, query, resultCount: results.length })
    for (const result of results) {
      if (result?.url) sourceUrls.push(result.url)
    }
    followupMessages.push({
      role: 'assistant',
      content: '',
      tool_calls: [{ type: 'function', function: { name: 'web_search', arguments: { query } } }],
    })
    followupMessages.push({
      role: 'tool',
      tool_name: 'web_search',
      content: JSON.stringify({ query, results, forcedVerification: true, escalation: 'round3_search' }),
    })
  }
}

// If we have evidence for a precise-value question but the planner skipped
// read_webpage, fetch the top reliable URL and pin its content as a system
// message so the model can't fall back to training data.
async function ensurePreciseValuePageRead(userMessage, followupMessages, sourceUrls, emit) {
  if (!requiresPreciseValue(userMessage)) return

  const alreadyRead = followupMessages.some(
    (m) => m.tool_name === 'read_webpage' || m.tool_calls?.some((c) => c.function?.name === 'read_webpage'),
  )
  if (alreadyRead) return

  const dedupedForRead = dedupeSourceUrls(sourceUrls)
  const topUrl = dedupedForRead.find((u) => !isLowConfidenceSource(u)) ?? dedupedForRead[0]
  if (!topUrl) return

  emit({ status: `Reading ${hostnameOf(topUrl)} for exact value…` })
  const page = await readWebpage(topUrl)
  followupMessages.push({
    role: 'assistant',
    content: '',
    tool_calls: [{ type: 'function', function: { name: 'read_webpage', arguments: { url: topUrl } } }],
  })
  followupMessages.push({
    role: 'tool',
    tool_name: 'read_webpage',
    content: JSON.stringify({ ...page, forcedVerification: true }),
  })
  // Anchor message: surface the page content so the model cannot fall back
  // to training data for the specific value.
  const pageSnippet = page?.content?.slice(0, 800) ?? ''
  if (pageSnippet) {
    followupMessages.push({
      role: 'system',
      content: `Page content from ${topUrl}:\n${pageSnippet}\n\nUse ONLY the version/value shown above. Do not use training data.`,
    })
  }
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
        emit({ status: 'Planning…' })

        const orchestration = await getExecutionPlan(userMessage)
        const executionPlan = orchestration?.plan || {
          route: 'factual_tool',
          promptProfile: 'factual',
          skipToolPlanning: false,
          requireVerification: true,
        }

        emit({
          orchestration: {
            route: executionPlan.route,
            reason: executionPlan.reason,
            confidence: executionPlan.confidence,
          },
        })

        if (executionPlan.route === 'local_tool' && orchestration?.execution?.ok) {
          const localTime = orchestration.execution.payload?.localTime || orchestration.execution.payload?.iso
          emit({ status: null })
          emit({ thinkingDone: true })
          emit({ word: `Current local time: ${localTime}` })
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const compressed = await compressHistory(model, messages)
        const promptProfile = executionPlan.promptProfile === 'fast' ? 'fast' : 'factual'
        const messagesWithSystem = withSystemMessage(compressed, promptProfile, {
          skillPromptPack: orchestration?.skillPromptPack || '',
        })

        if (executionPlan.route === 'fast_chat' && executionPlan.skipToolPlanning) {
          emit({ status: 'Thinking…' })
          log.streamingPass()
          await streamFinalAnswer(model, messagesWithSystem, [], emit, controller, enc)
          return
        }

        emit({ status: 'Thinking…' })
        const { followupMessages, sourceUrls: plannedSourceUrls } =
          await planTools(model, messagesWithSystem, emit, {
            forceVerification: Boolean(executionPlan.requireVerification),
          })
        let sourceUrls = [...plannedSourceUrls]
        const verifyOptions = { forceRequired: Boolean(executionPlan.requireVerification) }
        let verification = buildVerificationReport(userMessage, sourceUrls, verifyOptions)

        // Round 1: deep research escalation
        if (verification.required && isUnverifiedStatus(verification.status)) {
          emit({ status: 'Evidence is thin — running deeper verification…' })
          emit({ researching: true, topic: userMessage })
          const result = await deepResearch(model, userMessage, (progress) => {
            if (progress.status) emit({ status: progress.status })
          })
          emit({ researching: false, topic: userMessage })

          for (const url of result.sourceUrls || []) {
            if (url) sourceUrls.push(url)
          }

          followupMessages.push({
            role: 'tool',
            tool_name: 'deep_research',
            content: JSON.stringify({ ...result, forcedVerification: true }),
          })

          sourceUrls = dedupeSourceUrls(sourceUrls)
          verification = buildVerificationReport(userMessage, sourceUrls, verifyOptions)
        }

        // Round 2: trusted-outlet escalation
        if (verification.required && isUnverifiedStatus(verification.status)) {
          await escalateTrustedOutlets(userMessage, followupMessages, sourceUrls, emit)
          sourceUrls = dedupeSourceUrls(sourceUrls)
          verification = buildVerificationReport(userMessage, sourceUrls, verifyOptions)
        }

        // Round 3: read unread sources + comparison queries
        if (verification.required && isUnverifiedStatus(verification.status)) {
          await escalateRound3(userMessage, followupMessages, sourceUrls, emit)
          sourceUrls = dedupeSourceUrls(sourceUrls)
          verification = buildVerificationReport(userMessage, sourceUrls, verifyOptions)
        }

        if (sourceUrls.length > 0) {
          emit({ sources: sourceUrls })
        }

        emit({ status: 'Verifying evidence…' })
        emit({ verification })

        // After 3 rounds, only refuse if we found zero sources.
        if (verification.required && verification.status === 'unverified') {
          emit({ status: null })
          emit({ thinkingDone: true })
          emit({
            word: `I ran three rounds of research and couldn't find any sources to answer this. I don't want to guess.`,
          })
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const verifiedSourceUrls = dedupeSourceUrls(sourceUrls)
        if (verification.required && verification.status !== 'verified' && verifiedSourceUrls.length < 2) {
          emit({ status: null })
          emit({ thinkingDone: true })
          emit({
            word: 'I could not verify this with at least 2 independent sources, so I will not provide an uncited factual answer.',
          })
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const verificationMessage = buildVerificationSystemMessage(verification, userMessage, sourceUrls)
        if (verificationMessage) {
          followupMessages.push({
            role: 'system',
            content: verificationMessage,
          })
        }

        await ensurePreciseValuePageRead(userMessage, followupMessages, sourceUrls, emit)

        emit({ status: 'Reasoning over sources…' })
        log.streamingPass()
        await streamFinalAnswer(model, followupMessages, sourceUrls, emit, controller, enc)
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

// ---- Public re-exports (consumed by tests + route.js) -----------------------
export { requiresFactVerification, requiresLiveData, requiresPreciseValue } from './intent'
export {
  countHighConfidenceSources,
  countReliableSources,
  countTrustedSources,
  countTrustedTechSources,
} from './sources'
export {
  buildVerificationQueries,
  buildVerificationReport,
  buildVerificationSystemMessage,
  hasSufficientCitations,
} from './verification'
