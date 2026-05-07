// Source URL classification + counting. Pure URL-level checks.

import { dedupeSourceUrls } from './web'

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

export function parseSourceUrl(url) {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function isLowConfidenceSource(url) {
  const parsed = parseSourceUrl(url)
  if (!parsed) return false

  const host = parsed.hostname.replace(/^www\./, '')
  const path = parsed.pathname.toLowerCase()

  if (LOW_CONFIDENCE_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) {
    return true
  }

  return path.startsWith('/category/') || path.includes('/category/')
}

export function isHighConfidenceSource(url) {
  const parsed = parseSourceUrl(url)
  if (!parsed) return false

  const host = parsed.hostname.replace(/^www\./, '')
  return host.endsWith('.gov') || host.endsWith('.edu')
}

export function isTrustedNewsSource(url) {
  const parsed = parseSourceUrl(url)
  if (!parsed) return false
  const host = parsed.hostname.replace(/^www\./, '')
  return TRUSTED_NEWS_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))
}

export function isTrustedTechSource(url) {
  const parsed = parseSourceUrl(url)
  if (!parsed) return false
  const host = parsed.hostname.replace(/^www\./, '')
  return TRUSTED_TECH_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))
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
