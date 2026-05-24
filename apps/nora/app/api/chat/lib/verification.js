// Verification report + system message builder. Decides whether evidence is
// sufficient and translates the verdict into model-facing instructions.
// Uses LLM-based classification (classifyIntent) instead of keyword matching.

import { normalizeQuery } from './toolCalls'
import { dedupeSourceUrls } from './web'
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

  // Build verification queries without keyword-based routing — the LLM classifier
  // determines if search is needed upstream. Here we just generate good queries.
  const variants = [
    base,
    `${base} latest news`,
    `${base} official source`,
    `${base} Reuters`,
    `${base} AP News`,
  ]

  return [...new Set(variants)]
}

function suppressWikipedia(urls) {
  // Don't suppress Wikipedia by default anymore — the LLM classifier handles
  // intent upstream. Return URLs as-is.
  return urls
}

export function buildVerificationReport(userMessage, sourceUrls, options = {}) {
  const required = Boolean(options.forceRequired)

  // If the LLM classifier (classifyIntent) already determined this needs search,
  // then verification is required. The forceRequired option overrides for tests.
  const rawUrls = dedupeSourceUrls(Array.isArray(sourceUrls) ? sourceUrls.filter(Boolean) : [])
  const dedupedUrls = suppressWikipedia(rawUrls)
  const sourceCount = dedupedUrls.length
  const reliableSourceCount = countReliableSources(dedupedUrls)
  const highConfidenceSourceCount = countHighConfidenceSources(dedupedUrls)
  const trustedSourceCount = countTrustedSources(dedupedUrls)
  const trustedTechSourceCount = countTrustedTechSources(dedupedUrls)

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

  // A single reliable source is enough for precise-value questions (version
  // numbers, prices, etc.) — we will read the page to get the actual value.
  if (reliableSourceCount >= 1) {
    return verdict(
      'verified',
      'A reliable source was found. Read the page to get the exact value and cite it.',
    )
  }

  if (sourceCount >= MIN_VERIFICATION_SOURCES && reliableSourceCount >= 1) {
    return verdict(
      'verified',
      'Evidence is sufficient. Answer with citations and avoid unsupported extras.',
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
    return 'CRITICAL: You MUST cite sources for every factual claim.\n' +
      '- Format citations as [Source: Name] or (per Source Name)\n' +
      '- Include at least 2 independent sources explicitly named\n' +
      '- Example: "Charlie Kirk was reported alive [Source: Reuters]. Multiple outlets confirmed [Source: BBC]."\n' +
      '- Extract source names from URLs if needed: reuters.com → Reuters, bbc.com → BBC\n' +
      '- Do NOT provide any factual claims without citing specific sources by name.' +
      sourceList
  }

  if (report.status === 'weak') {
    return 'WEAK EVIDENCE - YOU MUST CITE SOURCES:\n' +
      '- Evidence is limited. Cite every source explicitly by name.\n' +
      '- Format: "According to [Source Name], ..."\n' +
      '- Use at least 2 sources provided below.\n' +
      '- State: "Evidence is limited and may not be fully reliable."' +
      sourceList
  }

  if (report.status === 'low_confidence') {
    return 'LOW CONFIDENCE EVIDENCE - STRICT CITATION REQUIRED:\n' +
      '- Only weak sources available. Cite every claim with source name.\n' +
      '- Format: "...claim [Source Name]"\n' +
      '- Do NOT add unsupported claims.' +
      sourceList
  }

  return 'NO RELIABLE SOURCES FOUND:\n' +
    '- Do not provide definitive factual claims.\n' +
    '- State explicitly: "I could not find verified sources for this claim."\n' +
    '- Offer to run deeper research if needed.'
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