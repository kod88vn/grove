'use client'

import { apiPath } from './api/path.js'
import { useCallback, useRef, useEffect } from 'react'
import { DEFAULT_MODEL } from '../hooks/defaultModel.js'

export function useChat() {
  const messagesRef = useRef([])
  const [messages, setMessages] = require('react').useState([])
  const [isStreaming, setIsStreaming] = require('react').useState(false)
  const bottomRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || isStreaming) return

      const now = new Date().toISOString()
      const userMessage = { role: 'user', content, timestamp: now }
      const newMessages = [...messages, userMessage]

      messagesRef.current = newMessages
      setMessages([...newMessages, { role: 'assistant', content: '', timestamp: now }])
      setIsStreaming(true)

      try {
        const response = await fetch(apiPath('/api/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: newMessages,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to get response')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let done = false

        while (!done) {
          const { value, done: streamDone } = await reader.read()
          done = streamDone

          if (value) {
            buffer += decoder.decode(value, { stream: !done })
          }

          const messages = buffer.split('\n\n')
          buffer = messages.pop() || ''

          for (const message of messages) {
            const line = message.replace(/^data: /, '').trim()
            if (!line || line === '[DONE]') continue

            try {
              const parsed = JSON.parse(line)
              if (parsed.word) {
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: updated[updated.length - 1].content + parsed.word,
                  }
                  messagesRef.current = updated
                  return updated
                })
              }
            } catch {
              // Invalid JSON, skip
            }
          }
        }
      } catch (error) {
        setMessages((prev) => {
          const updated = [...prev]
          const existing = updated[updated.length - 1]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `Error: ${error.message}`,
            timestamp: existing?.timestamp || new Date().toISOString(),
          }
          return updated
        })
      } finally {
        setIsStreaming(false)
      }
    },
    [messages, isStreaming]
  )

  return {
    messages,
    isStreaming,
    sendMessage,
    bottomRef,
  }
}
