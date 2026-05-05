'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { streamChat, streamGreeting } from '@/lib/api/chat'
import { createChat } from '@/lib/api/chats'
import { applyStreamEvent, createAssistantPlaceholder } from '@/lib/utils/message'

/**
 * Manages all chat message state and streaming.
 *
 * Uses React 19 `useTransition` so SSE stream updates are low-priority —
 * the UI stays responsive to user input while tokens are arriving.
 *
 * @param {{ model: string, initialMessages?: object[], initialChatId?: string|null }} options
 */
export function useChatMessages({ model, initialMessages = [], initialChatId = null }) {
  const [messages, setMessages] = useState(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [, startTransition] = useTransition()
  const greetedRef = useRef(false)
  const chatIdRef = useRef(initialChatId)

  // Reset state when switching to a different chat
  useEffect(() => {
    chatIdRef.current = initialChatId
    greetedRef.current = false
    setMessages(initialMessages)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChatId])

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

  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || isStreaming) return

    const now = new Date().toISOString()
    const userMsg = { role: 'user', content, timestamp: now }
    setMessages((prev) => {
      // Strip the greeting (if present) when user sends their first real message
      const filtered = prev.filter((m) => !m.isGreeting)
      return [...filtered, userMsg, createAssistantPlaceholder(now)]
    })

    // Create a new chat in DB on first real message
    if (!chatIdRef.current) {
      try {
        const chat = await createChat(content.trim().slice(0, 60))
        if (chat?.id) chatIdRef.current = chat.id
      } catch { /* non-fatal — stream will fall back to in-memory */ }
    }

    await runStream(
      chatIdRef.current
        ? streamChat(model, chatIdRef.current, content)
        : streamChat(model, null, content),
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

  return { messages, isStreaming, sendMessage, triggerGreeting, chatIdRef }
}
