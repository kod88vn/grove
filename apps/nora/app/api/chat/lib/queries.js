// Query builders. Pure helpers that turn a user message into search queries
// or runtime payloads used by tool calls.

import { normalizeQuery } from './toolCalls'
import { isMarketRecommendationQuestion, isSensitivePersonStatusClaim } from './intent'

export function buildCurrentTimePayload() {
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

export function buildDatedQuery(query) {
  const today = new Date()
  const dateTag = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return `${query} ${dateTag}`
}

export function buildTrustedOutletQueries(userMessage) {
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
