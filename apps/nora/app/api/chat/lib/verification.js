// Verification report + system message builder. Decides whether evidence is
// sufficient and translates the verdict into model-facing instructions.

import { normalizeQuery } from './toolCalls'
import { dedupeSourceUrls } from './web'
// NOTE: isCurrentTitleQuestion, isMarketRecommendationQuestion,
// isSensitivePersonStatusClaim, requiresFactVerification, requiresPreciseValue
// are keyword-based classification functions. They were removed from this file.
// Verification decisions now use LLM-based classifyIntent() in planTools.js.
// In NODE_ENV=test, the LLM classifier is disabled — these keyword functions are
// used ONLY for query expansion and guidance text (NOT for classification).
import { requiresFactVerification } from './intent'
import {
  countHighConfidenceSources,
  countReliableSources,
  countTrustedSources,
  countTrustedTechSources,
  parseSourceUrl,
} from './sources'

const MIN_VERIFICATION_SOURCES = 2

export function buildVerificationQueries(userMessage) {
  const base = normalizeQuery(userMessage)
  if (!base) return []

  // Keyword-based query expansion helpers (NOT classification decisions).
  // These build better search queries but do NOT determine whether to search.
  const isCurrentTitleCue = /\b(who is the (current|new))\s+(president|prime minister|premier|chancellor)\b/i.test(base)

  const variants = []

  if (isCurrentTitleCue || /\bpresident\b/i.test(base)) {
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
  // Keyword-based title question detection (query expansion only, not classification).
  const isCurrentTitleCue = /\b(who is the (current|new))\s+(president|prime minister|premier)\b/i.test(userMessage)
  if (!isCurrentTitleCue) return urls
  return urls.filter((url) => {
    const parsed = parseSourceUrl(url)
    if (!parsed) return true
    const host = parsed.hostname.replace(/^www\./, '')
    return host !== 'wikipedia.org' && !host.endsWith('.wikipedia.org')
  })
}

export function buildVerificationReport(userMessage, sourceUrls, options = {}) {
  // Verification requirement is now determined by LLM classifier in planTools.js.
  // The orchestrator's forceRequired flag is the ONLY source of truth for requiring verification.
  const required = Boolean(options.forceRequired)
  const rawUrls = dedupeSourceUrls(Array.isArray(sourceUrls) ? sourceUrls.filter(Boolean) : [])
  const dedupedUrls = suppressWikipediaForCurrentTitle(userMessage, rawUrls)
  const sourceCount = dedupedUrls.length
  const reliableSourceCount = countReliableSources(dedupedUrls)
  const highConfidenceSourceCount = countHighConfidenceSources(dedupedUrls)
  const trustedSourceCount = countTrustedSources(dedupedUrls)
  const trustedTechSourceCount = countTrustedTechSources(dedupedUrls)
  const currentTitleQuestion = /\b(who is the (current|new))\s+(president|prime minister|premier)\b/i.test(userMessage)

  // NOTE: property order matters — tests assert JSON substrings starting with
  // `{"required":...,"status":...`. Keep `required` and `status` first.
  const verdict = (status, guidance, requiredFlag = true) => ({
    required: requiredFlag,
    status,
    sourceCount,
    reliableSourceCount,
    highConfidenceSourceCount,
    trustedSourceCount,
    trustedTechSourceCount,
    guidance,
  })

  if (!required) {
    return verdict('not_required', 'No strict verification required for this prompt type.', false)
  }

  // Evidence evaluation: keyword-based category checks kept for guidance text only.
  const marketRecommendation = /\b(best|bang\s+for\s+the\s+buck|best\s+value)\b.*\b(gpu|graphics\s+card|cpu|llm|ai\s+model)\b/i.test(userMessage)
  const sensitivePersonStatus = /\b(what happened to|dead|died|death|killed|murdered)\b/i.test(userMessage)

  if (marketRecommendation && trustedTechSourceCount >= 1 && reliableSourceCount >= 2) {
    return verdict(
      'verified',
      'Recommendation is corroborated by multiple reliable sources. Answer with citations and trade-offs.',
    )
  }

  if (marketRecommendation) {
    return verdict(
      sourceCount >= 1 ? 'weak' : 'unverified',
      'Recommendation evidence is insufficient. Require trusted sources before giving a definitive pick.',
    )
  }

  if (currentTitleQuestion && (highConfidenceSourceCount >= 1 || reliableSourceCount >= 1)) {
    return verdict(
      'verified',
      'Current office/title claim is supported by a reliable source. Answer directly with citations.',
    )
  }

  if (sensitivePersonStatus && trustedSourceCount < 1) {
    return verdict(
      sourceCount >= 1 ? 'weak' : 'unverified',
      'Sensitive person-status claims require at least one trusted outlet source before answering definitively.',
    )
  }

  if (sourceCount >= MIN_VERIFICATION_SOURCES && reliableSourceCount >= 1) {
    return verdict(
      'verified',
      'Evidence is sufficient. Answer with citations and avoid unsupported extras.',
    )
  }

  // ≥2 distinct sources = verified. This is the hard gate: when web search runs and finds
  // at least 2 unique URLs, Nora treats the evidence as sufficient and answers with citations.
  if (sourceCount >= 2) {
    return verdict(
      'verified',
      'Evidence corroborated by multiple sources. Answer confidently with citations.',
    )
  }

  if (currentTitleQuestion && sourceCount >= 1) {
    return verdict(
      'low_confidence',
      'Only low-confidence sources were found. Use cited evidence carefully and avoid unsupported extra details.',
    )
  }

  if (sourceCount >= 1) {
    return verdict(
      'weak',
      'Evidence is weak (single source). Use cautious language and cite the source.',
    )
  }

  return verdict('unverified', 'No supporting sources found. Do not make definitive factual claims.')
}

export function buildVerificationSystemMessage(report, userMessage = '', sourceUrls = []) {
  if (!report?.required) return ''

  const sourceList = sourceUrls && sourceUrls.length > 0
    ? `\n\nAVAILABLE SOURCES:\n${sourceUrls.slice(0, 5).map((url, i) => `${i + 1}. ${url}`).join('\n')}`
    : ''

  if (report.status === 'verified') {
    // precise-value detection kept for guidance text only — not used for classification.
    const isPreciseValue = /\b(exact|latest|current|newest)\s+(version|release|build|price|cost|number|count)\b/i.test(userMessage)
    if (isPreciseValue) {
      return 'Verification phase: a source page has been read and its content is in the tool results above. ' +
        'You MUST report the exact version, price, or number stated in that page content. ' +
        'Do NOT use your training data for this value — it is outdated. ' +
        'If the page content does not contain the value, say so explicitly instead of guessing.'
    }
    return 'CRITICAL: You MUST cite sources for every factual claim.\n' +
      '- Format citations as [Source: Name] or (per Source Name)\n' +
      '- Include at least 2 independent sources explicitly named\n' +
      '- Example: "Charlie Kirk was reported alive [Source: Reuters]. Multiple outlets confirmed [Source: BBC]."\n' +
      '- Extract source names from URLs if needed: reuters.com → Reuters, bbc.com → BBC\n' +
      '- Do NOT provide any factual claims without citing specific sources by name.' +
      sourceList
  }

  if (report.status === 'weak') {
    return 'SINGLE SOURCE AVAILABLE - CITE IT BUT ANSWER:\n' +
      '- You have one source. Report what it says and add your own knowledge.\n' +
      '- Format: "The source says... Additionally, ..."\n' +
      '- Do NOT refuse to answer — provide the best response you can.' +
      sourceList
  }

  if (report.status === 'low_confidence') {
    return 'LOW CONFIDENCE SOURCES - CITE CAREFULLY BUT ANSWER:\n' +
      '- Sources exist but are not highly reliable. Cite them and add your own knowledge.\n' +
      '- Format: "...claim [Source Name]. Additionally, ..."\n' +
      '- Do NOT refuse to answer — provide the best response you can.' +
      sourceList
  }

  // "unverified" — search ran but found no results. Tell Nora to answer from general knowledge with a caveat, NOT refuse and ask the user for confirmation.
  return 'NO WEB SOURCES FOUND - ANSWER FROM KNOWLEDGE:\n' +
    '- Web search returned no results but your training data may still have relevant information.\n' +
    '- Provide the best answer you can from your knowledge. Disclose uncertainty: "Based on available information..."\n' +
    '- Do NOT refuse to answer or ask the user if they want deeper research.\n' +
    '- Do NOT stall for confirmation — just answer.' +
    sourceList
}

export function hasSufficientCitations(responseText, minimumCitations = 2) {
  if (!responseText || typeof responseText !== 'string') return false

  // Match explicit, strict citation formats only
  // [Source: Name], (per Name), per [Name]
  const citationPatterns = [
    /\[Source:\s*[\w\s&\-\.]{2,}\]/gi,  // [Source: Reuters], [Source: BBC News]
    /\(per\s+[\w\s&\-\.]{2,}\)/gi,       // (per Reuters), (per BBC News)
  ]

  const citations = new Set()
  citationPatterns.forEach((pattern) => {
    const matches = responseText.match(pattern)
    if (matches) {
      matches.forEach((m) => citations.add(m.toLowerCase()))
    }
  })

  return citations.size >= minimumCitations
}
