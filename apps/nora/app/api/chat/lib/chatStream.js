import { MAX_TOOL_PLANNING_PASSES, SSE_HEADERS, DEFAULT_MODEL } from './constants'
import { compressHistory, callOllama } from './ollama'
import { withSystemMessage } from './prompt'
import { extractToolCalls, parseXmlToolCalls, normalizeQuery, normalizeUrl } from './toolCalls'
import { TOOL_DEFINITIONS } from './tools'
import { log } from './logger'
import { deepResearch } from './research'
import { getExecutionPlan } from './orchestratorClient'
import {
  buildFallbackWebQuery,
  dedupeSourceUrls,
  readWebpage,
  webSearch,
} from './web'

const PAGE_SUMMARIZE_THRESHOLD = 2000 // chars — below this, pass content as-is
const MIN_VERIFICATION_SOURCES = 2

const CURRENT_TITLE_KEYWORDS = [
  'president',
  'prime minister',
  'premier',
  'chancellor',
  'ceo',
  'chair',
  'chairperson',
  'governor',
  'mayor',
  'pope',
  'king',
  'queen',
  'leader',
  'secretary',
  'minister',
]

const LOW_CONFIDENCE_HOSTS = [
  'wikipedia.org',
  'facebook.com',
  'instagram.com',
  'reddit.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'youtube.com',
]

const TRUSTED_NEWS_HOSTS = [
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'npr.org',
  'nytimes.com',
  'washingtonpost.com',
  'wsj.com',
  'bloomberg.com',
  'cnn.com',
  'cbsnews.com',
  'nbcnews.com',
  'abcnews.go.com',
  'theguardian.com',
  'usatoday.com',
]

const TRUSTED_TECH_HOSTS = [
  'tomshardware.com',
  'techpowerup.com',
  'anandtech.com',
  'notebookcheck.net',
  'servethehome.com',
]

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesVerificationKeyword(text) {
  return VERIFICATION_KEYWORDS.some((keyword) => {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`)
    return pattern.test(text)
  })
}

function isCurrentTitleQuestion(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  const hasCurrentCue = /\b(current|currently|right now|as of now|holds? office|in office)\b/.test(normalized)
  const hasPersonQuestionCue = /\b(who|which)\b/.test(normalized)
  const hasTitleCue = CURRENT_TITLE_KEYWORDS.some((keyword) => normalized.includes(keyword))
  return hasCurrentCue && hasPersonQuestionCue && hasTitleCue
}

// Returns true for questions that need a specific value read from a page,
// not just URL-level confirmation that a source exists.
export function requiresPreciseValue(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  return (
    /\bexact\b/.test(normalized) ||
    /\b(latest|current|newest|stable)\s+(version|release|build)\b/.test(normalized) ||
    /\bversion\s+number\b/.test(normalized) ||
    /\bwhat\s+(version|release)\b/.test(normalized) ||
    /\bcurrent\s+price\b/.test(normalized) ||
    /\bexact\s+(price|cost|number|count|figure|stat|statistic)\b/.test(normalized)
  )
}

function isMarketRecommendationQuestion(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  const hasRecommendationCue = /\b(best|bang\s+for\s+the\s+buck|best\s+value|value\s+for\s+money|worth\s+it|recommend|go-?to|buy)\b/.test(normalized)
  const hasCategoryCue = /\b(gpu|graphics\s+card|video\s+card|cpu|llm|ai\s+model|local\s+model|inference)\b/.test(normalized)
  return hasRecommendationCue && hasCategoryCue
}

function parseSourceUrl(url) {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function isLowConfidenceSource(url) {
  const parsed = parseSourceUrl(url)
  if (!parsed) return false

  const host = parsed.hostname.replace(/^www\./, '')
  const path = parsed.pathname.toLowerCase()

  if (LOW_CONFIDENCE_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) {
    return true
  }

  return path.startsWith('/category/') || path.includes('/category/')
}

function isHighConfidenceSource(url) {
  const parsed = parseSourceUrl(url)
  if (!parsed) return false

  const host = parsed.hostname.replace(/^www\./, '')
  return host.endsWith('.gov') || host.endsWith('.edu')
}

function isTrustedNewsSource(url) {
  const parsed = parseSourceUrl(url)
  if (!parsed) return false
  const host = parsed.hostname.replace(/^www\./, '')
  return TRUSTED_NEWS_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))
}

function isTrustedTechSource(url) {
  const parsed = parseSourceUrl(url)
  if (!parsed) return false
  const host = parsed.hostname.replace(/^www\./, '')
  return TRUSTED_TECH_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))
}

function buildTrustedOutletQueries(userMessage) {
  const base = normalizeQuery(userMessage)
  if (!base) return []

  const queries = [
    `${base} site:reuters.com`,
    `${base} site:apnews.com`,
    `${base} Reuters`,
    `${base} AP News`,
  ]

  if (isMarketRecommendationQuestion(base)) {
    queries.push(`${base} site:tomshardware.com`)
    queries.push(`${base} site:techpowerup.com`)
    queries.push(`${base} site:anandtech.com`)
    queries.push(`${base} benchmark`)
    queries.push(`${base} msrp price`)
  }

  if (isSensitivePersonStatusClaim(base)) {
    queries.push(`${base} confirmed report`)
  }

  return [...new Set(queries)]
}

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

async function assessVerificationNeed(model, userMessage) {
  if (!userMessage) {
    return { required: false, confidence: 'low', reason: 'empty_input', queryHints: [] }
  }

  if (process.env.NODE_ENV === 'test') {
    return { required: false, confidence: 'low', reason: 'disabled_in_test', queryHints: [] }
  }

  try {
    const res = await callOllama({
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

function isSensitivePersonStatusClaim(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  return (
    /\bwhat happened to\b/.test(normalized) ||
    /\b(dead|died|death|killed|murdered|assassinated|alive|passed away|cause of death)\b/.test(normalized)
  )
}

export function countReliableSources(urls) {
  return dedupeSourceUrls(Array.isArray(urls) ? urls : []).filter((url) => !isLowConfidenceSource(url)).length
}

export function countHighConfidenceSources(urls) {
  return dedupeSourceUrls(Array.isArray(urls) ? urls : []).filter((url) => isHighConfidenceSource(url)).length
}

export function countTrustedSources(urls) {
  return dedupeSourceUrls(Array.isArray(urls) ? urls : []).filter((url) => isTrustedNewsSource(url)).length
}

export function countTrustedTechSources(urls) {
  return dedupeSourceUrls(Array.isArray(urls) ? urls : []).filter((url) => isTrustedTechSource(url)).length
}

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

const VERIFICATION_KEYWORDS = [
  'event',
  'incident',
  'accident',
  'attack',
  'election',
  'vote',
  'protest',
  'war',
  'ceasefire',
  'earthquake',
  'flood',
  'hurricane',
  'wildfire',
  'outbreak',
  'pandemic',
  'statistic',
  'statistics',
  'total',
  'number of',
  'how many',
  'how much',
  'percent',
  'percentage',
  'rate',
  'price',
  'cost',
  'revenue',
  'profit',
  'market cap',
  'ranking',
  'ranked',
  'poll',
  'survey',
  'dead',
  'died',
  'death',
  'killed',
  'murdered',
  'assassinated',
  'alive',
  'passed away',
  'cause of death',
  'obituary',
  'arrested',
  'charged',
  'convicted',
  'sentenced',
]

export function requiresLiveData(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  return /\b(weather|forecast|temperature|rain|snow|humidity|wind|storm|sunny|cloudy|hot|cold|today|tomorrow|tonight|this week|stock price|stock market|share price|sports score|game score|live score|breaking news|right now|currently|as of today)\b/.test(normalized)
}

export function requiresFactVerification(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()

  if (/\[[^\]]+\]/.test(normalized)) {
    return false
  }

  if (isCurrentTitleQuestion(normalized)) {
    return true
  }

  if (requiresPreciseValue(normalized)) {
    return true
  }

  if (/\bwhat happened to\b/.test(normalized)) {
    return true
  }

  if (matchesVerificationKeyword(normalized)) {
    return true
  }

  if (isMarketRecommendationQuestion(normalized)) {
    return true
  }

  // Also verify when user asks factual/date/number-like questions.
  const hasFactualQuestionCue = /\b(who|what|when|where|which|did|is|are|was|were|how many|how much)\b/.test(normalized)
  const hasNumericCue = /\b(19|20)\d{2}\b|\b\d+(?:[.,]\d+)?\s*(?:%|percent|million|billion|trillion|k|m|bn)?\b/.test(normalized)

  return hasFactualQuestionCue && hasNumericCue
}

export function buildVerificationQueries(userMessage) {
  const base = normalizeQuery(userMessage)
  if (!base) return []

  const variants = []

  if (isCurrentTitleQuestion(base)) {
    variants.push(`${base} official source`)
    if (/\bpresident\b/i.test(base)) {
      variants.push(`${base} site:whitehouse.gov`)
    }
    variants.push(base)
  } else {
    variants.push(base)
    variants.push(`${base} latest news`)
    variants.push(`${base} official source`)
  }

  variants.push(`${base} Reuters`)
  variants.push(`${base} AP News`)

  return [...new Set(variants)]
}

function suppressWikipediaForCurrentTitle(userMessage, urls) {
  if (!isCurrentTitleQuestion(userMessage)) return urls
  return urls.filter((url) => {
    const parsed = parseSourceUrl(url)
    if (!parsed) return true
    const host = parsed.hostname.replace(/^www\./, '')
    return host !== 'wikipedia.org' && !host.endsWith('.wikipedia.org')
  })
}

export function buildVerificationReport(userMessage, sourceUrls) {
  const required = requiresFactVerification(userMessage)
  const rawUrls = dedupeSourceUrls(Array.isArray(sourceUrls) ? sourceUrls.filter(Boolean) : [])
  const dedupedUrls = suppressWikipediaForCurrentTitle(userMessage, rawUrls)
  const sourceCount = dedupedUrls.length
  const reliableSourceCount = countReliableSources(dedupedUrls)
  const highConfidenceSourceCount = countHighConfidenceSources(dedupedUrls)
  const trustedSourceCount = countTrustedSources(dedupedUrls)
  const trustedTechSourceCount = countTrustedTechSources(dedupedUrls)
  const currentTitleQuestion = isCurrentTitleQuestion(userMessage)
  const sensitivePersonStatusClaim = isSensitivePersonStatusClaim(userMessage)
  const marketRecommendation = isMarketRecommendationQuestion(userMessage)

  if (!required) {
    return {
      required: false,
      status: 'not_required',
      sourceCount,
      reliableSourceCount,
      highConfidenceSourceCount,
      trustedSourceCount,
      trustedTechSourceCount,
      guidance: 'No strict verification required for this prompt type.',
    }
  }

  if (marketRecommendation && trustedTechSourceCount >= 1 && reliableSourceCount >= 2) {
    return {
      required: true,
      status: 'verified',
      sourceCount,
      reliableSourceCount,
      highConfidenceSourceCount,
      trustedSourceCount,
      trustedTechSourceCount,
      guidance: 'Recommendation is corroborated by multiple reliable sources including a trusted hardware-review outlet. Answer with citations and trade-offs.',
    }
  }

  if (marketRecommendation) {
    return {
      required: true,
      status: sourceCount >= 1 ? 'weak' : 'unverified',
      sourceCount,
      reliableSourceCount,
      highConfidenceSourceCount,
      trustedSourceCount,
      trustedTechSourceCount,
      guidance: 'Recommendation evidence is insufficient. Require at least one trusted hardware-review source plus corroboration before giving a definitive best-value pick.',
    }
  }

  if (currentTitleQuestion && (highConfidenceSourceCount >= 1 || reliableSourceCount >= 1)) {
    return {
      required: true,
      status: 'verified',
      sourceCount,
      reliableSourceCount,
      highConfidenceSourceCount,
      trustedSourceCount,
      trustedTechSourceCount,
      guidance: 'Current office/title claim is supported by a reliable source. Answer directly with citations.',
    }
  }

  // A single reliable source is enough for precise-value questions (version
  // numbers, prices, etc.) — we will read the page to get the actual value.
  if (requiresPreciseValue(userMessage) && reliableSourceCount >= 1) {
    return {
      required: true,
      status: 'verified',
      sourceCount,
      reliableSourceCount,
      highConfidenceSourceCount,
      trustedSourceCount,
      trustedTechSourceCount,
      guidance: 'A reliable source was found. Read the page to get the exact value and cite it.',
    }
  }

  if (sensitivePersonStatusClaim && trustedSourceCount < 1) {
    return {
      required: true,
      status: sourceCount >= 1 ? 'weak' : 'unverified',
      sourceCount,
      reliableSourceCount,
      highConfidenceSourceCount,
      trustedSourceCount,
      trustedTechSourceCount,
      guidance: 'Sensitive person-status claims require at least one trusted outlet source before answering definitively.',
    }
  }

  if (sourceCount >= MIN_VERIFICATION_SOURCES && reliableSourceCount >= 1) {
    return {
      required: true,
      status: 'verified',
      sourceCount,
      reliableSourceCount,
      highConfidenceSourceCount,
      trustedSourceCount,
      trustedTechSourceCount,
      guidance: 'Evidence is sufficient. Answer with citations and avoid unsupported extras.',
    }
  }

  if (currentTitleQuestion && sourceCount >= 1) {
    return {
      required: true,
      status: 'low_confidence',
      sourceCount,
      reliableSourceCount,
      highConfidenceSourceCount,
      trustedSourceCount,
      trustedTechSourceCount,
      guidance: 'Only low-confidence sources were found. Use cited evidence carefully and avoid unsupported extra details.',
    }
  }

  if (sourceCount >= 1) {
    return {
      required: true,
      status: 'weak',
      sourceCount,
      reliableSourceCount,
      highConfidenceSourceCount,
      trustedSourceCount,
      trustedTechSourceCount,
      guidance: 'Evidence is weak (single source). Use cautious language and cite the source.',
    }
  }

  return {
    required: true,
    status: 'unverified',
    sourceCount,
    reliableSourceCount,
    highConfidenceSourceCount,
    trustedSourceCount,
    trustedTechSourceCount,
    guidance: 'No supporting sources found. Do not make definitive factual claims.',
  }
}

function buildVerificationSystemMessage(report, userMessage = '') {
  if (!report?.required) return ''

  if (report.status === 'verified') {
    if (requiresPreciseValue(userMessage)) {
      return 'Verification phase: a source page has been read and its content is in the tool results above. ' +
        'You MUST report the exact version, price, or number stated in that page content. ' +
        'Do NOT use your training data for this value — it is outdated. ' +
        'If the page content does not contain the value, say so explicitly instead of guessing.'
    }
    return 'Verification phase: evidence is sufficient. Provide the answer grounded in tool results only, and cite sources.'
  }

  if (report.status === 'weak') {
    if (isMarketRecommendationQuestion(userMessage)) {
      return 'Verification phase: recommendation evidence is weak. Do NOT claim a single product is the best bang for buck yet. State uncertainty, summarize trade-offs, and ask whether to run deeper verification.'
    }
    return 'Verification phase: corroboration is insufficient. Do not make definitive claims. Say that evidence is limited and that you cannot confidently verify the claim yet.'
  }

  if (report.status === 'low_confidence') {
    return 'Verification phase: only low-confidence evidence was found. Use only the cited source, avoid unsupported extras, and do not rely on training data.'
  }

  return 'Verification phase: no reliable evidence was found. Do not provide definitive factual claims. State that you could not verify from current sources and ask whether to run deeper research.'
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

  const userMessage = messagesWithSystem.findLast((m) => m.role === 'user')?.content ?? ''

  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    const firstTool = toolCalls[0]?.function?.name
    if (firstTool === 'web_search') {
      const rawQuery = normalizeQuery(toolCalls[0]?.function?.arguments)
      emit({ status: rawQuery ? `Searching for "${rawQuery}"\u2026` : 'Searching the web\u2026' })
    } else if (firstTool === 'read_webpage') {
      const url = normalizeUrl(toolCalls[0]?.function?.arguments)
      const hostname = url ? (() => { try { return new URL(url).hostname } catch { return url } })() : 'page'
      emit({ status: `Reading ${hostname}\u2026` })
    } else if (firstTool === 'deep_research') {
      emit({ status: 'Researching in depth\u2026' })
    } else {
      emit({ status: 'Working on it\u2026' })
    }
  }

  const noToolCalls = !Array.isArray(toolCalls) || toolCalls.length === 0

  const shouldForceLiveSearch = noToolCalls && requiresLiveData(userMessage)

  if (shouldForceLiveSearch) {
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

    // For live data (weather, scores, etc.) the search results only have URL
    // snippets — the model needs actual page content to answer. Read the top
    // non-low-confidence URL so the final answer pass has real data.
    const liveUrls = dedupeSourceUrls(sourceUrls)
    const topLiveUrl = liveUrls.find((u) => !isLowConfidenceSource(u)) ?? liveUrls[0]
    if (topLiveUrl) {
      const hostname = (() => { try { return new URL(topLiveUrl).hostname } catch { return topLiveUrl } })()
      emit({ status: `Reading ${hostname}…` })
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

    return { followupMessages, sourceUrls: dedupeSourceUrls(sourceUrls), toolCalls: [], planningResult }
  }

  const semanticVerification = noToolCalls
    ? await assessVerificationNeed(model, userMessage)
    : { required: false, confidence: 'low', reason: 'tool_call_present', queryHints: [] }

  const shouldForceVerification = noToolCalls && (semanticVerification.required || requiresFactVerification(userMessage))

  if (shouldForceVerification) {
    emit({ status: 'Verifying facts with current sources…' })
    const verificationQueries = [
      ...buildVerificationQueries(userMessage),
      ...semanticVerification.queryHints,
    ]
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

    const verificationReport = buildVerificationReport(userMessage, sourceUrls)
    const dedupedSourceUrls = dedupeSourceUrls(sourceUrls)
    if (verificationReport.status === 'low_confidence' && dedupedSourceUrls.length === 1) {
      const url = dedupedSourceUrls[0]
      const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()
      emit({ status: `Reading ${hostname} for primary evidence…` })
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
      if (requiresPreciseValue(userMessage)) {
        const freshDedupe = dedupeSourceUrls(sourceUrls)
        const topUrl = freshDedupe.find((u) => !isLowConfidenceSource(u)) ?? freshDedupe[0]
        if (topUrl) {
          const hostname = (() => { try { return new URL(topUrl).hostname } catch { return topUrl } })()
          emit({ status: `Reading ${hostname} for exact value…` })
          const page = await readWebpage(topUrl)
          followupMessages.push({
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                type: 'function',
                function: { name: 'read_webpage', arguments: { url: topUrl } },
              },
            ],
          })
          followupMessages.push({
            role: 'tool',
            tool_name: 'read_webpage',
            content: JSON.stringify({ ...page, forcedVerification: true }),
          })
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

async function streamFinalAnswer(model, followupMessages, sourceUrls, emit, controller, enc, _pass = 0) {
  const MAX_XML_INTERCEPT_PASSES = 2
  const upstream = await callOllama({
    model,
    messages: followupMessages,
    stream: true,
    options: { think: false },
  })

  if (!upstream.ok) {
    const text = await upstream.text()
    throw new Error(text || 'Final response request failed')
  }

  const decoder = new TextDecoder()
  const seen = new Set()
  let rawBuffer = ''
  let fullContent = ''
  let contentStarted = false

  for await (const chunk of upstream.body) {
    rawBuffer += decoder.decode(chunk, { stream: true })

    const lines = rawBuffer.split('\n')
    rawBuffer = lines.pop() ?? ''

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
          fullContent += content
          if (!contentStarted) {
            contentStarted = true
            emit({ thinkingDone: true })
          }
          emit({ word: content })
        }

        if (json.done) {
          // Detect XML tool calls the model leaked into content instead of using structured calls.
          const xmlCalls = parseXmlToolCalls(fullContent)
          if (xmlCalls.length > 0 && _pass < MAX_XML_INTERCEPT_PASSES) {
            // Content was already streamed — tell the client to clear it.
            emit({ retract: true })
            const preamble = fullContent.slice(0, fullContent.indexOf('<')).trim()
            if (preamble) emit({ status: preamble.slice(0, 120) })

            followupMessages.push({ role: 'assistant', content: fullContent, tool_calls: [] })
            for (const call of xmlCalls) {
              await executeToolCall(call, followupMessages, sourceUrls, emit, model)
            }

            const freshSourceUrls = dedupeSourceUrls(sourceUrls)
            if (freshSourceUrls.length > 0) emit({ sources: freshSourceUrls })
            emit({ status: null })
            await streamFinalAnswer(model, followupMessages, sourceUrls, emit, controller, enc, _pass + 1)
            return
          }

          // Detect planning narration: model expressed intent to search instead of answering.
          // Retract, run the search it described, then re-stream a real answer.
          const MAX_NARRATION_PASSES = 2
          const isNarration = _pass < MAX_NARRATION_PASSES &&
            /\b(i should|i will|i'll|i need to|let me)\b.{0,80}\b(search|look up|find|check|try|use the \w+_\w+ tool)\b/i.test(fullContent)
          if (isNarration) {
            emit({ retract: true })
            const userMessage = followupMessages.findLast((m) => m.role === 'user')?.content ?? ''
            // Extract the search intent from the model's own narration text — it often
            // describes a more specific query than the original user message.
            const intentPatterns = [
              /\b(?:search|look\s+up|find|check)\s+(?:for\s+)?(?:the\s+)?(.{10,150}?)(?:\.|,|\n|$)/i,
              /\btry\s+(?:a\s+)?(?:different|another|new|more\s+specific)?\s*(?:search|query)\s+(?:for\s+|to\s+find\s+)?(.{10,150}?)(?:\.|,|\n|$)/i,
            ]
            let queryFromNarration = ''
            for (const re of intentPatterns) {
              const m = fullContent.match(re)
              if (m?.[1]) { queryFromNarration = m[1].trim().slice(0, 200); break }
            }
            const rawQuery = queryFromNarration || buildFallbackWebQuery(userMessage) || userMessage
            emit({ status: `Searching for "${rawQuery}"\u2026` })
            emit({ searching: true, query: rawQuery })
            const results = await webSearch(rawQuery)
            emit({ searching: false, query: rawQuery, resultCount: results.length })
            for (const r of results) { if (r?.url) sourceUrls.push(r.url) }
            followupMessages.push({ role: 'assistant', content: fullContent, tool_calls: [] })
            followupMessages.push({
              role: 'tool',
              tool_name: 'web_search',
              content: JSON.stringify({ query: rawQuery, results }),
            })
            const freshSourceUrls = dedupeSourceUrls(sourceUrls)
            if (freshSourceUrls.length > 0) emit({ sources: freshSourceUrls })
            emit({ status: null })
            await streamFinalAnswer(model, followupMessages, sourceUrls, emit, controller, enc, _pass + 1)
            return
          }

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
        emit({ status: 'Planning…' })

        const orchestration = await getExecutionPlan(userMessage)
        const executionPlan = orchestration?.plan || {
          route: 'factual_tool',
          promptProfile: 'factual',
          skipToolPlanning: false,
          requireVerification: true,
        }

        emit({ orchestration: { route: executionPlan.route, reason: executionPlan.reason, confidence: executionPlan.confidence } })

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
          emit({ status: null })
          log.streamingPass()
          await streamFinalAnswer(model, messagesWithSystem, [], emit, controller, enc)
          return
        }

        emit({ status: 'Thinking…' })
        const { followupMessages, sourceUrls: plannedSourceUrls } =
          await planTools(model, messagesWithSystem, emit)
        let sourceUrls = [...plannedSourceUrls]
        let verification = buildVerificationReport(userMessage, sourceUrls)

        if (verification.required && (verification.status === 'unverified' || verification.status === 'weak' || verification.status === 'low_confidence')) {
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
          verification = buildVerificationReport(userMessage, sourceUrls)
        }

        if (verification.required && (verification.status === 'unverified' || verification.status === 'weak' || verification.status === 'low_confidence')) {
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

          sourceUrls = dedupeSourceUrls(sourceUrls)

          const trustedUrl = sourceUrls.find((url) => isTrustedNewsSource(url))
          const alreadyReadTrusted = followupMessages.some((m) => {
            const parsed = m.tool_name === 'read_webpage' ? safeJsonParse(m.content || '{}') : null
            const hasTrustedToolResult = m.tool_name === 'read_webpage' && isTrustedNewsSource(parsed?.url)
            const hasTrustedToolCall = m.tool_calls?.some(
              (c) => c.function?.name === 'read_webpage' && isTrustedNewsSource(c.function?.arguments?.url),
            )
            return Boolean(hasTrustedToolResult || hasTrustedToolCall)
          })

          if (trustedUrl && !alreadyReadTrusted) {
            const hostname = (() => { try { return new URL(trustedUrl).hostname } catch { return trustedUrl } })()
            emit({ status: `Reading ${hostname} for confirmation…` })
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

          sourceUrls = dedupeSourceUrls(sourceUrls)
          verification = buildVerificationReport(userMessage, sourceUrls)
        }

                // Round 3: read top unread sources + additional search variants
        if (verification.required && (verification.status === 'unverified' || verification.status === 'weak' || verification.status === 'low_confidence')) {
          emit({ status: 'Running third research pass…' })

          const alreadyReadUrls = new Set(
            followupMessages
              .filter((m) => m.tool_name === 'read_webpage')
              .map((m) => { try { return JSON.parse(m.content || '{}').url } catch { return null } })
              .filter(Boolean),
          )

          const unreadUrls = sourceUrls.filter((u) => !alreadyReadUrls.has(u))
          for (const url of unreadUrls.slice(0, 2)) {
            try {
              const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()
              emit({ status: `Reading ${hostname}…` })
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

          sourceUrls = dedupeSourceUrls(sourceUrls)
          verification = buildVerificationReport(userMessage, sourceUrls)
        }

        if (sourceUrls.length > 0) {
          emit({ sources: sourceUrls })
        }

        emit({ status: 'Verifying evidence…' })
        emit({ verification })

        // After 3 rounds, only refuse if we found zero sources.
        // With some sources, proceed and let the model answer with caveats.
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

        const verificationMessage = buildVerificationSystemMessage(verification, userMessage)
        if (verificationMessage) {
          followupMessages.push({
            role: 'system',
            content: verificationMessage,
          })
        }

        // For precise-value questions (version numbers, prices, etc.) ensure the
        // top reliable source has actually been read before streaming the final
        // answer — regardless of which path found the sources. Skip if the model
        // already issued a read_webpage call during planning.
        if (requiresPreciseValue(userMessage)) {
          const alreadyRead = followupMessages.some(
            (m) => m.tool_name === 'read_webpage' || m.tool_calls?.some((c) => c.function?.name === 'read_webpage'),
          )
          if (!alreadyRead) {
            const dedupedForRead = dedupeSourceUrls(sourceUrls)
            const topUrl = dedupedForRead.find((u) => !isLowConfidenceSource(u)) ?? dedupedForRead[0]
            if (topUrl) {
              const hostname = (() => { try { return new URL(topUrl).hostname } catch { return topUrl } })()
              emit({ status: `Reading ${hostname} for exact value…` })
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
              // Anchor message: explicitly surface the page content so the model
              // cannot fall back to training data for the specific value.
              const pageSnippet = page?.content?.slice(0, 800) ?? ''
              if (pageSnippet) {
                followupMessages.push({
                  role: 'system',
                  content: `Page content from ${topUrl}:\n${pageSnippet}\n\nUse ONLY the version/value shown above. Do not use training data.`,
                })
              }
            }
          }
        }

        emit({ status: null })
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
