'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/components/ChatMessage'
import { ChatInput } from '@/components/ChatInput'
import { UserBadge } from '@/components/UserBadge'
import { ModelSelector } from '@/components/ModelSelector'
import { GreetingTrigger } from '@/components/GreetingTrigger'
import { useChatMessages } from '@/hooks/useChatMessages'
import { useModels } from '@/hooks/useModels'

const IS_DEV_MODE = process.env.NODE_ENV !== 'production'

export default function ChatPage() {
  const { modelList, selectedModel, setSelectedModel } = useModels()
  const { messages, isStreaming, sendMessage, triggerGreeting } = useChatMessages({ model: selectedModel })
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input, messages)
    setInput('')
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <GreetingTrigger onGreet={triggerGreeting} />

      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-end">
          <div className="flex items-center gap-4">
            <UserBadge />
            <span className="text-xs text-gray-400 select-all" title="Deployed commit hash">
              {process.env.NEXT_PUBLIC_COMMIT_HASH}
            </span>
            {IS_DEV_MODE && (
              <ModelSelector
                modelList={modelList}
                selectedModel={selectedModel}
                onChange={setSelectedModel}
                disabled={isStreaming}
              />
            )}
          </div>
        </div>
      </header>

      {messages.length === 0 ? (
        /* Empty state: input vertically centred */
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <p className="text-gray-400 text-lg">What do you want to learn today?</p>
          <div className="w-full max-w-2xl">
            <ChatInput value={input} onChange={setInput} onSubmit={handleSend} isLoading={isStreaming} />
          </div>
        </div>
      ) : (
        /* Active chat: messages scroll, input pinned at bottom */
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
                        isGreeting={msg.isGreeting}
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
                        isGreeting={msg.isGreeting}
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
                        isGreeting={msg.isGreeting}
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
              <ChatInput value={input} onChange={setInput} onSubmit={handleSend} isLoading={isStreaming} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
