'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchChats, updateChat, deleteChat } from '@/lib/api/chats'

/**
 * Manages the chat history list shown in the sidebar.
 * Auto-fetches on mount and exposes helpers for pin/delete.
 */
export function useChatHistory() {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchChats()
      setChats(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const pin = useCallback(async (id, pinned) => {
    await updateChat(id, { pinned })
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, pinned } : c)))
  }, [])

  const remove = useCallback(async (id) => {
    await deleteChat(id)
    setChats((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { chats, loading, refresh, pin, remove }
}
