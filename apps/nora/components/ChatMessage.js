'use client'

import { useEffect, useRef, useState } from 'react'

export function ChatMessage({ role, content, sources = [], verification = null, timestamp, thinking, thinkingVisible, isStreaming, status }) {
  const isUser = role === 'user'
  const thinkingScrollRef = useRef(null)
  const [shouldAutoFollowThinking, setShouldAutoFollowThinking] = useState(true)
  const showThinkingBubble = Boolean(
    thinkingVisible &&
    (thinking || (isStreaming && role === 'assistant' && !content))
  )
  const thinkingText = thinking || '...'
  const sourceList = !isUser
    ? (Array.isArray(sources) && sources.length > 0 ? dedupeSources(sources) : extractSources(content))
    : []
  const timeLabel = formatTimestamp(timestamp)
  const verificationLabel = formatVerificationLabel(verification)

  useEffect(() => {
    if (showThinkingBubble) {
      setShouldAutoFollowThinking(true)
    }
  }, [showThinkingBubble])

  useEffect(() => {
    if (!showThinkingBubble || !shouldAutoFollowThinking) return
    const el = thinkingScrollRef.current
    if (!el) return
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      el.scrollTop = el.scrollHeight
    }
  }, [thinkingText, showThinkingBubble, shouldAutoFollowThinking])

  const handleThinkingScroll = () => {
    const el = thinkingScrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = distanceFromBottom < 12
    setShouldAutoFollowThinking(nearBottom)
  }

  return (
    <div className="space-y-2">
      {/* Thinking bubble - only show while thinking and before content */}
      {showThinkingBubble && (
        <div className="flex justify-start">
          <div className="max-w-xl px-4 py-3 rounded-3xl bg-purple-100 text-purple-900 rounded-bl-none">
            <div
              ref={thinkingScrollRef}
              onScroll={handleThinkingScroll}
              data-testid="thinking-scroll"
              className="max-h-[4.5rem] overflow-y-auto scroll-smooth pr-1"
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap opacity-70">
                {thinkingText}
              </p>
            </div>
            {status && (
              <p className="text-xs mt-1 text-purple-600 opacity-80">{status}</p>
            )}
            {timeLabel && (
              <p className="text-xs mt-2 text-purple-600 opacity-70">{timeLabel}</p>
            )}
          </div>
        </div>
      )}

      {/* Content bubble */}
      {content && (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-xl px-4 py-3 rounded-3xl break-words ${
              isUser
                ? 'bg-blue-500 text-white rounded-br-none'
                : 'bg-gray-100 text-gray-900 rounded-bl-none'
            }`}
          >
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {content}
              {isStreaming && role === 'assistant' && (
                <span className="inline-block w-0.5 h-5 ml-1 bg-gray-400 animate-pulse align-text-bottom" />
              )}
            </p>
            {timeLabel && (
              <p className={`text-xs mt-2 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>{timeLabel}</p>
            )}
            {!isStreaming && verificationLabel && (
              <p className="text-xs mt-2 text-gray-600">{verificationLabel}</p>
            )}
            {!isStreaming && sourceList.length > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sources</p>
                <div className="mt-1 space-y-1">
                  {sourceList.map((url, idx) => (
                    <a
                      key={`${url}-${idx}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-700 hover:text-blue-900 underline break-all"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function extractSources(text) {
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

function dedupeSources(urls) {
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

function formatVerificationLabel(verification) {
  if (!verification || typeof verification !== 'object') return ''
  const status = verification.status
  const count = verification.sourceCount

  if (status === 'verified') return `Verification: verified (${count} source${count === 1 ? '' : 's'})`
  if (status === 'weak') return `Verification: limited (${count} source)`
  if (status === 'unverified') return 'Verification: unverified'
  return ''
}
