'use client'

import { useCallback } from 'react'

/** Format a Unix timestamp (seconds) as a concise, human-readable date string. */
function formatDate(unixSec) {
  if (!unixSec) return ''
  const date = new Date(unixSec * 1000)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / 86_400_000)

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (diffMs < 60_000) return 'just now'
  if (diffDays === 0) return timeStr
  if (diffDays === 1) return `Yesterday ${timeStr}`

  const month = date.toLocaleString('default', { month: 'short' })
  const day = date.getDate()
  if (date.getFullYear() === now.getFullYear()) return `${month} ${day}`
  return `${month} ${day}, ${date.getFullYear()}`
}

/**
 * Sidebar listing past chats.
 *
 * @param {{ chats: object[], selectedId: string|null, onSelect: function,
 *           onNew: function, onPin: function, onRemove: function,
 *           error?: string|null,
 *           loading?: boolean,
 *           isMobileOpen?: boolean, onClose?: function }} props
 */
export function ChatSidebar({
  chats,
  selectedId,
  onSelect,
  onNew,
  onPin,
  onRemove,
  error = null,
  loading = false,
  isMobileOpen = false,
  onClose = () => {},
}) {
  const handlePin = useCallback((e, chat) => {
    e.stopPropagation()
    onPin(chat.id, !chat.pinned)
  }, [onPin])

  const handleRemove = useCallback((e, id) => {
    e.stopPropagation()
    onRemove(id)
  }, [onRemove])

  const content = (
    <>
      <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={onNew}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <span>+</span> New Chat
          </button>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="md:hidden px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mx-4 mt-2 text-xs text-red-600">{error}</p>}

      <div className="flex-1 overflow-y-auto py-2">
        {chats.length === 0 && loading && (
          <p role="status" className="text-xs text-gray-400 text-center mt-8 px-4">Loading chats…</p>
        )}
        {chats.length === 0 && !loading && !error && (
          <p className="text-xs text-gray-400 text-center mt-8 px-4">No chats yet</p>
        )}
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={[
              'group flex items-start gap-2 px-3 py-2.5 mx-2 rounded-lg transition-colors',
              selectedId === chat.id
                ? 'bg-blue-50 text-blue-800'
                : 'hover:bg-gray-100 text-gray-700',
            ].join(' ')}
          >
            {/* Pin indicator */}
            {chat.pinned ? (
              <span className="text-blue-400 mt-0.5 flex-shrink-0 text-xs">📌</span>
            ) : (
              <span className="w-3 flex-shrink-0" />
            )}

            <button
              type="button"
              onClick={() => onSelect(chat)}
              aria-current={selectedId === chat.id ? 'true' : undefined}
              className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="block text-sm font-medium truncate">{chat.title}</span>
              <span className="block text-xs text-gray-400 mt-0.5">{formatDate(chat.updated_at)}</span>
            </button>

            {/* Actions — revealed on hover or focus; always visible on touch */}
            <div className="flex-shrink-0 flex items-center gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                onClick={(e) => handlePin(e, chat)}
                title={chat.pinned ? 'Unpin' : 'Pin'}
                className="p-1 text-gray-400 hover:text-blue-500 rounded"
              >
                {chat.pinned ? '📌' : '🔖'}
              </button>
              <button
                onClick={(e) => handleRemove(e, chat.id)}
                title="Delete chat"
                className="p-1 text-gray-400 hover:text-red-500 rounded"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )

  return (
    <>
      <div
        data-testid="mobile-sidebar-overlay"
        className={[
          'md:hidden',
          isMobileOpen ? 'fixed inset-0 z-40' : 'hidden',
        ].join(' ')}
      >
        <button
          aria-label="Close history"
          onClick={onClose}
          className="absolute inset-0 bg-black/30"
        />

        <aside className="relative h-full w-full bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
          {content}
        </aside>
      </div>

      <aside
        data-testid="desktop-sidebar"
        className="hidden md:flex md:flex-col w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 h-screen overflow-hidden"
      >
        {content}
      </aside>
    </>
  )
}
