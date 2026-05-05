'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { parseSseStream } from '@/lib/utils/sseStream'

const DEFAULT_MODEL = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'qwen3.5:9b'

/** Floating Nora chat drawer — shown on all pages except /chat */
export function FloatingChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
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
    if (!text || streaming) return

    setInput('')
    const userMsg = { role: 'user', content: text }
    const assistantMsg = { role: 'assistant', content: '' }
    const history = [...messages, userMsg]
    setMessages([...history, assistantMsg])
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: DEFAULT_MODEL, messages: history }),
      })
      if (!res.ok) throw new Error('Request failed')

      for await (const event of parseSseStream(res)) {
        if (event.word) {
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + event.word,
            }
            return updated
          })
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Something went wrong. Please try again.',
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
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
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-700 text-white shadow-lg transition hover:bg-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
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
          'fixed bottom-0 right-0 z-50 flex flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ease-out',
          'rounded-t-2xl',
          'h-[80vh] w-full',
          'sm:bottom-24 sm:right-6 sm:h-[520px] sm:w-[380px] sm:rounded-2xl',
          open ? 'translate-y-0' : 'translate-y-full sm:translate-y-[110%]',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">
              N
            </span>
            <span className="text-sm font-semibold text-slate-800">Ask Nora</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-400 mt-8">
              Ask me anything — weather, homework, family tasks…
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={[
                'max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-6',
                msg.role === 'user'
                  ? 'ml-auto bg-cyan-700 text-white'
                  : 'mr-auto bg-slate-100 text-slate-800',
              ].join(' ')}
            >
              {msg.content || (streaming && i === messages.length - 1 ? '…' : '')}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-3">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Nora…"
              disabled={streaming}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-800 disabled:opacity-40"
            >
              {streaming ? '…' : 'Send'}
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
