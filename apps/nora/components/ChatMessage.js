'use client'

export function ChatMessage({ role, content, thinking, thinkingVisible, isStreaming }) {
  const isUser = role === 'user'
  const sources = !isUser ? extractSources(content) : []

  return (
    <div className="space-y-2">
      {/* Thinking bubble - only show while thinking and before content */}
      {thinkingVisible && thinking && (
        <div className="flex justify-start">
          <div className="max-w-xl px-4 py-3 rounded-3xl bg-purple-100 text-purple-900 rounded-bl-none">
            <p className="text-sm leading-relaxed whitespace-pre-wrap opacity-70">
              <span className="italic">Thinking:</span> {thinking}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 ml-1 bg-purple-600 animate-pulse align-text-bottom" />
              )}
            </p>
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
            {!isStreaming && sources.length > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sources</p>
                <div className="mt-1 space-y-1">
                  {sources.map((url, idx) => (
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
