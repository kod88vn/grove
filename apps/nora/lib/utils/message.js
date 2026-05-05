/** Blank assistant message placeholder added while waiting for a stream. */
export function createAssistantPlaceholder(timestamp, overrides = {}) {
  return {
    role: 'assistant',
    content: '',
    thinking: '',
    thinkingVisible: true,
    searching: false,
    searchQuery: '',
    researching: false,
    researchTopic: '',
    status: 'Thinking\u2026',
    sources: [],
    verification: null,
    timestamp,
    ...overrides,
  }
}

/**
 * Pure reducer: applies a single SSE event object to the messages array.
 * Returns a new array; never mutates the input.
 *
 * @param {object[]} messages
 * @param {object} event
 * @returns {object[]}
 */
export function applyStreamEvent(messages, event) {
  const last = messages[messages.length - 1]
  if (!last) return messages

  if (event.word) {
    const stamp = last.content === '' ? { timestamp: new Date().toISOString() } : {}
    return [...messages.slice(0, -1), { ...last, ...stamp, content: last.content + event.word }]
  }
  if (event.thinking) {
    return [...messages.slice(0, -1), { ...last, thinking: last.thinking + event.thinking }]
  }
  if ('status' in event) {
    return [...messages.slice(0, -1), { ...last, status: event.status ?? '' }]
  }
  if (typeof event.searching === 'boolean') {
    return [...messages.slice(0, -1), {
      ...last,
      searching: event.searching,
      searchQuery: event.searching ? (event.query ?? last.searchQuery) : last.searchQuery,
    }]
  }
  if (typeof event.researching === 'boolean') {
    return [...messages.slice(0, -1), {
      ...last,
      researching: event.researching,
      researchTopic: event.researching ? (event.topic ?? last.researchTopic) : last.researchTopic,
    }]
  }
  if (Array.isArray(event.sources)) {
    return [...messages.slice(0, -1), { ...last, sources: event.sources }]
  }
  if (event.verification && typeof event.verification === 'object') {
    return [...messages.slice(0, -1), { ...last, verification: event.verification }]
  }
  if (event.thinkingDone) {
    return [...messages.slice(0, -1), { ...last, thinkingVisible: false }]
  }
  if (event.retract) {
    return [...messages.slice(0, -1), { ...last, content: '', thinking: '', thinkingVisible: true }]
  }
  return messages
}

/** Format an ISO timestamp as a human-readable HH:MM string. */
export function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Extract URLs from message text. */
export function extractSources(text) {
  if (!text) return []
  const matches = text.match(/https?:\/\/[^\s)\]]+/g) || []
  const seen = new Set()
  const unique = []
  for (const match of matches) {
    const cleaned = match.replace(/[.,;!?]+$/, '')
    if (!seen.has(cleaned)) {
      seen.add(cleaned)
      unique.push(cleaned)
    }
  }
  return unique
}

/** Remove duplicate URLs from a list. */
export function dedupeSources(urls) {
  const seen = new Set()
  const out = []
  for (const url of urls) {
    const value = String(url || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/** Convert a verification object into a display label string. */
export function formatVerificationLabel(verification) {
  if (!verification || typeof verification !== 'object') return ''
  const { status, sourceCount: count } = verification
  if (status === 'verified') return `Verification: verified (${count} source${count === 1 ? '' : 's'})`
  if (status === 'weak') return `Verification: limited (${count} source)`
  if (status === 'unverified') return 'Verification: unverified'
  return ''
}
