'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { streamChat, streamGreeting } from '@/lib/api/chat'
import { applyStreamEvent, createAssistantPlaceholder } from '@/lib/utils/message'

/**
 * Manages all chat message state and streaming.
 *
 * Uses React 19 `useTransition` so SSE stream updates are low-priority —
 * the UI stays responsive to user input while tokens are arriving.
 *
 * @param {{ model: string }} options
 */
export function useChatMessages({ model }) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [, startTransition] = useTransition()
  const greetedRef = useRef(false)

  const applyEvent = useCallback((event) => {
    startTransition(() => {
      setMessages((prev) => applyStreamEvent(prev, event))
    })
  }, [startTransition])

  const runStream = useCallback(async (source, { onError } = {}) => {
    setIsStreaming(true)
    try {
      for await (const event of source) {
        applyEvent(event)
      }
    } catch (err) {
      if (onError) onError(err)
    } finally {
      setIsStreaming(false)
    }
  }, [applyEvent])

  const sendMessage = useCallback(async (content, currentMessages) => {
    if (!content.trim() || isStreaming) return

    const now = new Date().toISOString()
    const userMsg = { role: 'user', content, timestamp: now }
    // Capture history snapshot before any state updates
    const history = [...currentMessages, userMsg]

    setMessages([...history, createAssistantPlaceholder(now)])

    await runStream(
      streamChat(model, history),
      {
        onError: (err) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            return [...prev.slice(0, -1), {
              role: 'assistant',
              content: `Error: ${err.message}`,
              thinking: '',
              thinkingVisible: false,
              searching: false,
              timestamp: last?.timestamp || new Date().toISOString(),
            }]
          })
        },
      },
    )
  }, [isStreaming, model, runStream])

  const triggerGreeting = useCallback(async (firstName) => {
    if (greetedRef.current) return
    greetedRef.current = true

    const now = new Date().toISOString()
    setMessages([createAssistantPlaceholder(now, { isGreeting: true })])

    // Check sessionStorage cache — avoids an LLM call on every page load
    const cacheKey = `greeting:${firstName ?? ''}`
    const cached = (() => { try { return sessionStorage.getItem(cacheKey) } catch { return null } })()

    if (cached) {
      applyEvent({ word: cached })
      return
    }

    // Stream from API and collect the full text to cache for next time
    let accumulated = ''
    const collectingStream = (async function* () {
      for await (const event of streamGreeting(model, firstName)) {
        if (event.word) accumulated += event.word
        yield event
      }
    })()

    await runStream(collectingStream)

    if (accumulated) {
      try { sessionStorage.setItem(cacheKey, accumulated) } catch { /* storage full / SSR */ }
    }
  }, [model, applyEvent, runStream])

  return { messages, isStreaming, sendMessage, triggerGreeting }
}
