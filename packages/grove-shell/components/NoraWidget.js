'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * NoraWidget — floating chatbot button + drawer.
 *
 * Renders a fixed chat-bubble button in the bottom-right corner.
 * On click, slides up a drawer containing Nora's chat UI in an iframe.
 *
 * Props:
 *   noraUrl  {string}  Base URL of the Nora app. Default: http://localhost:3000
 */
export function NoraWidget({ noraUrl = 'http://localhost:3000' }) {
  const [open, setOpen] = useState(false)
  const iframeRef = useRef(null)

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Nora chat' : 'Open Nora chat'}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-700 text-white shadow-lg transition hover:bg-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          data-testid="backdrop"
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Nora chat"
        aria-modal="true"
        className={[
          'fixed bottom-0 right-0 z-50 flex h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out sm:bottom-24 sm:right-6 sm:h-[600px] sm:w-[400px] sm:rounded-2xl',
          open ? 'translate-y-0' : 'translate-y-full sm:translate-y-[110%]',
        ].join(' ')}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">N</span>
            <span className="text-sm font-semibold text-slate-800">Nora</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Embedded Nora chat */}
        {open && (
          <iframe
            ref={iframeRef}
            src={`${noraUrl}/chat`}
            title="Nora chat"
            className="flex-1 border-none"
            allow="clipboard-write"
          />
        )}
      </div>
    </>
  )
}

function ChatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path
        fillRule="evenodd"
        d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25z"
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
        d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}
