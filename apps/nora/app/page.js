'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/components/ChatMessage'
import { ChatInput } from '@/components/ChatInput'

const ENV_DEFAULT = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'qwen3.5:9b'
const IS_DEV_MODE = process.env.NODE_ENV !== 'production'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [modelList, setModelList] = useState([ENV_DEFAULT])
  const [selectedModel, setSelectedModel] = useState(ENV_DEFAULT)
  const [user, setUser] = useState(null)
  const bottomRef = useRef(null)
  const greetedRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => setUser(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (greetedRef.current) return
    if (!IS_DEV_MODE && !user) return
    greetedRef.current = true

    const firstName = IS_DEV_MODE
      ? 'Master'
      : (user?.name ? user.name.split(' ')[0] : (user?.login ? user.login.split('@')[0] : null))
    const greetMsg = firstName
      ? `Say hi to ${firstName} and offer to help with anything today. Keep it short and friendly.`
      : 'Say hi and offer to help with anything today. Keep it short and friendly.'

    const history = [{ role: 'user', content: greetMsg }]
    const now = new Date().toISOString()
    setMessages([{ role: 'assistant', content: '', thinking: '', thinkingVisible: true, searching: false, searchQuery: '', researching: false, researchTopic: '', status: 'Thinking\u2026', sources: [], verification: null, timestamp: now }])
    setIsStreaming(true)

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, messages: history }),
    }).then(async (res) => {
      if (!res.ok) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (value) buffer += decoder.decode(value, { stream: !done })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const data = line.replace(/^data: /, '').trim()
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.word) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                const stamp = last.content === '' ? { timestamp: new Date().toISOString() } : {}
                return [...prev.slice(0, -1), { ...last, ...stamp, content: last.content + parsed.word }]
              })
            } else if ('status' in parsed) {
              setMessages((prev) => { const last = prev[prev.length - 1]; return [...prev.slice(0, -1), { ...last, status: parsed.status ?? '' }] })
            } else if (parsed.thinkingDone) {
              setMessages((prev) => { const last = prev[prev.length - 1]; return [...prev.slice(0, -1), { ...last, thinkingVisible: false }] })
            }
          } catch { /* skip */ }
        }
        if (done) break
      }
    }).catch(() => {}).finally(() => setIsStreaming(false))
  }, [user])

  useEffect(() => {
    if (!IS_DEV_MODE) return

    let cancelled = false

    const loadModels = async () => {
      try {
        const res = await fetch('/api/models', { cache: 'no-store' })
        if (!res.ok) return

        const data = await res.json()
        if (!Array.isArray(data?.models) || data.models.length === 0) return

        if (!cancelled) {
          setModelList(data.models)
          setSelectedModel((current) => (data.models.includes(current) ? current : data.models[0]))
        }
      } catch {
        // Keep default model when dynamic list cannot be loaded.
      }
    }

    loadModels()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return

    const now = new Date().toISOString()
    const userMsg = { role: 'user', content: input, timestamp: now }
    const history = [...messages, userMsg]

    setMessages([...history, { role: 'assistant', content: '', thinking: '', thinkingVisible: true, searching: false, searchQuery: '', researching: false, researchTopic: '', status: 'Thinking…', sources: [], verification: null, timestamp: now }])
    setInput('')
    setIsStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, messages: history }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Request failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (value) {
          buffer += decoder.decode(value, { stream: !done })
        }

        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const data = line.replace(/^data: /, '').trim()
          if (!data || data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)

            if (parsed.thinking) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [...prev.slice(0, -1), { ...last, thinking: last.thinking + parsed.thinking }]
              })
            } else if ('status' in parsed) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [...prev.slice(0, -1), { ...last, status: parsed.status ?? '' }]
              })
            } else if (typeof parsed.searching === 'boolean') {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [...prev.slice(0, -1), { ...last, searching: parsed.searching, searchQuery: parsed.searching ? (parsed.query ?? last.searchQuery) : last.searchQuery }]
              })
            } else if (typeof parsed.researching === 'boolean') {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [...prev.slice(0, -1), { ...last, researching: parsed.researching, researchTopic: parsed.researching ? (parsed.topic ?? last.researchTopic) : last.researchTopic }]
              })
            } else if (Array.isArray(parsed.sources)) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [...prev.slice(0, -1), { ...last, sources: parsed.sources }]
              })
            } else if (parsed.verification && typeof parsed.verification === 'object') {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [...prev.slice(0, -1), { ...last, verification: parsed.verification }]
              })
            } else if (parsed.thinkingDone) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [...prev.slice(0, -1), { ...last, thinkingVisible: false }]
              })
            } else if (parsed.retract) {
              // XML tool call was intercepted mid-stream — clear the partial content
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [...prev.slice(0, -1), { ...last, content: '', thinking: '', thinkingVisible: true }]
              })
            } else if (parsed.word) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                // Stamp the reply time on the first word so the timestamp reflects
                // when the answer arrived, not when the user sent their message.
                const stamp = last.content === '' ? { timestamp: new Date().toISOString() } : {}
                return [...prev.slice(0, -1), { ...last, ...stamp, content: last.content + parsed.word }]
              })
            }
          } catch {
            // Skip invalid JSON
          }
        }

        if (done) break
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev]
        const existing = next[next.length - 1]
        next[next.length - 1] = {
          role: 'assistant',
          content: `Error: ${err.message}`,
          thinking: '',
          thinkingVisible: false,
          searching: false,
          timestamp: existing?.timestamp || new Date().toISOString(),
        }
        return next
      })
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Nora</h1>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-gray-600 font-medium">
                {user.name || user.login || 'Unknown'}
              </span>
            )}
            <span className="text-xs text-gray-400 select-all" title="Deployed commit hash">{process.env.NEXT_PUBLIC_COMMIT_HASH}</span>
            {IS_DEV_MODE && (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isStreaming}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              >
                {modelList.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      {messages.length === 0 ? (
        /* Empty state: input vertically centered */
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <p className="text-gray-400 text-lg">What do you want to learn today?</p>
          <div className="w-full max-w-2xl">
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSend}
              isLoading={isStreaming}
            />
          </div>
        </div>
      ) : (
        /* Active chat: messages scroll above, input pinned at bottom */
        <>
          <main className="flex-1 overflow-y-auto py-6">
            <div className="w-full max-w-2xl mx-auto px-4 space-y-4">
              {messages.map((msg, i) => {
                const isLast = i === messages.length - 1
                const hasThinking = msg.thinking && msg.thinkingVisible
                const hasContent = msg.content
                const isAssistantLast = isLast && msg.role === 'assistant'
                const statusLabel = msg.status || ''
                const showThinkingBubble = isAssistantLast && isStreaming && !hasContent

                return (
                  <div key={i}>
                    {(showThinkingBubble || hasThinking) && (
                      <ChatMessage
                        role={msg.role}
                        content={msg.content}
                        sources={msg.sources}
                        verification={msg.verification}
                        timestamp={msg.timestamp}
                        thinking={msg.thinking}
                        thinkingVisible={showThinkingBubble ? true : msg.thinkingVisible}
                        isStreaming={isStreaming && isLast}
                        status={isStreaming && isLast ? statusLabel : ''}
                      />
                    )}
                    {!showThinkingBubble && !hasThinking && hasContent && (
                      <ChatMessage
                        role={msg.role}
                        content={msg.content}
                        sources={msg.sources}
                        verification={msg.verification}
                        timestamp={msg.timestamp}
                        thinking={msg.thinking}
                        thinkingVisible={msg.thinkingVisible}
                        isStreaming={isStreaming && isLast}
                      />
                    )}
                    {!showThinkingBubble && !hasThinking && !hasContent && !isAssistantLast && (
                      <ChatMessage
                        role={msg.role}
                        content={msg.content}
                        sources={msg.sources}
                        verification={msg.verification}
                        timestamp={msg.timestamp}
                        thinking={msg.thinking}
                        thinkingVisible={msg.thinkingVisible}
                        isStreaming={false}
                      />
                    )}
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          </main>

          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4">
            <div className="w-full max-w-2xl mx-auto">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                isLoading={isStreaming}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
