'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ChatMessage } from '@/components/ChatMessage'
import { GreetingTrigger } from '@/components/GreetingTrigger'
import { useChatMessages } from '@/hooks/useChatMessages'

const DEFAULT_MODEL = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'qwen3.5:9b'

/** Floating Nora chat drawer — shown on all pages except /chat */
export function FloatingChat({ enableGreeting = true } = {}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const { messages, isStreaming, sendMessage, triggerGreeting } = useChatMessages({
    model: DEFAULT_MODEL,
    initialMessages: [],
    initialChatId: null,
  })
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // All hooks must be declared before any conditional return
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Hide on /chat — the full workspace is already there
  if (pathname === '/chat') return null

  async function send() {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    await sendMessage(text)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Nora chat' : 'Ask Nora'}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-700 text-white shadow-xl ring-2 ring-cyan-300/40 hover:bg-cyan-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400"
        style={{ boxShadow: '0 8px 32px 0 rgba(14, 165, 233, 0.18)' }}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Ask Nora"
        aria-modal="true"
        className={[
          'fixed z-50 flex flex-col overflow-hidden bg-white/95 shadow-2xl border border-cyan-100 transition-all duration-300 ease-out backdrop-blur',
          'bottom-0 right-0 rounded-t-2xl h-[80vh] w-full',
          'sm:bottom-24 sm:right-6 sm:h-[520px] sm:w-[380px] sm:rounded-2xl',
          open
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none sm:translate-y-[120%]',
        ].join(' ')}
        style={{ boxShadow: '0 8px 32px 0 rgba(14, 165, 233, 0.18), 0 2px 8px 0 rgba(0,0,0,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-100 px-4 py-3 bg-gradient-to-r from-cyan-50/80 to-white/60">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-200 text-base font-bold text-cyan-700 shadow-sm">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#06b6d4"/><text x="10" y="15" textAnchor="middle" fontSize="12" fill="#fff" fontFamily="sans-serif">N</text></svg>
            </span>
            <span className="text-base font-semibold text-cyan-900">Ask Nora</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-md p-1 text-cyan-400 transition hover:bg-cyan-100 hover:text-cyan-600"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {enableGreeting ? <GreetingTrigger onGreet={triggerGreeting} /> : null}
          {messages.length === 0 && !isStreaming && (
            <p className="text-center text-base text-cyan-400 mt-10">
              Ask me anything — weather, homework, family tasks…
            </p>
          )}
          {messages.map((msg, i) => (
            <ChatMessage key={i} {...msg} isStreaming={isStreaming && i === messages.length - 1} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-cyan-100 bg-white/90 p-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Nora…"
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-cyan-200 px-3 py-2 text-base focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:opacity-50 shadow"
              style={{ minHeight: 40 }}
            />
            <button
              onClick={send}
              disabled={isStreaming || !input.trim()}
              className="rounded-full bg-cyan-700 p-0.5 w-10 h-10 flex items-center justify-center text-white shadow-lg transition hover:bg-cyan-800 disabled:opacity-40"
              aria-label="Send message"
            >
              {isStreaming ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              ) : (
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function ChatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path
        fillRule="evenodd"
        d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  )
}
