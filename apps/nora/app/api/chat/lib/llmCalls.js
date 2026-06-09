// Small LLM-backed helpers used by the planner. Wraps Ollama calls that aren't
// part of the main streaming response.

import { callAI } from './callAI'
import { log } from './logger'

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function parseFirstJsonObject(value) {
  if (!value) return null
  const text = String(value).trim()
  const direct = safeJsonParse(text)
  if (direct && typeof direct === 'object') return direct

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  const parsed = safeJsonParse(match[0])
  return parsed && typeof parsed === 'object' ? parsed : null
}

export { safeJsonParse }

/**
 * Assess whether the user's prompt requires fact verification.
 * In production, this is decided by an LLM (Ollama) classifier.
 * In test mode (NODE_ENV=test), the LLM is disabled, so we fall back to
 * keyword-based detection ONLY for test coverage.
 */
export async function assessVerificationNeed(model, userMessage) {
  if (!userMessage) {
    return { required: false, confidence: 'low', reason: 'empty_input', queryHints: [] }
  }

  if (process.env.NODE_ENV === 'test') {
    // LLM classifier disabled in test — fall back to keyword heuristics for tests.
    const { requiresFactVerification, requiresPreciseValue } = await import('./intent')
    return {
      required: true,
      forceRequired: requiresFactVerification(userMessage) || requiresPreciseValue(userMessage),
      confidence: 'low',
      reason: 'disabled_in_test',
      queryHints: [],
    }
  }

  try {
    const res = await callAI({
      model,
      stream: false,
      options: { num_predict: 160, think: false },
      messages: [
        {
          role: 'system',
          content:
            'Classify whether a user query requires external factual verification before answering. ' +
            'Use semantic intent, not keywords. ' +
            'Return ONLY JSON with this shape: ' +
            '{"required":boolean,"confidence":"low|medium|high","reason":string,"queryHints":string[]}. ' +
            'Mark required=true for claims likely to change over time, numerical/price/performance claims, market recommendations, rankings, current events, or health/safety/legal sensitive claims.',
        },
        { role: 'user', content: userMessage },
      ],
    })

    if (!res.ok) {
      return { required: false, confidence: 'low', reason: 'classifier_request_failed', queryHints: [] }
    }

    const json = await res.json()
    const parsed = parseFirstJsonObject(json.message?.content)

    if (!parsed) {
      return { required: false, confidence: 'low', reason: 'classifier_parse_failed', queryHints: [] }
    }

    return {
      required: Boolean(parsed.required),
      confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
      reason: typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : 'semantic_classifier',
      queryHints: Array.isArray(parsed.queryHints)
        ? parsed.queryHints.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 4)
        : [],
    }
  } catch {
    return { required: false, confidence: 'low', reason: 'classifier_exception', queryHints: [] }
  }
}

export async function summarizePage(model, url, title, content) {
  try {
    const res = await callAI({
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
