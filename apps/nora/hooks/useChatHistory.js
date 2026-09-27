'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchChats, updateChat, deleteChat } from '@/lib/api/chats'

/**
 * Manages the chat history list shown in the sidebar.
 * Auto-fetches on mount and exposes helpers for pin/delete.
 */
export function useChatHistory() {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const refreshId = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = refreshId.current + 1
    refreshId.current = requestId
    setLoading(true)
    try {
      const data = await fetchChats()
      if (requestId === refreshId.current) {
        setChats(data)
        setError(null)
      }
    } catch (err) {
      console.error('Failed to load chats', err)
      if (requestId === refreshId.current) {
        setError("Couldn't load your chats. Please try again.")
      }
    } finally {
      if (requestId === refreshId.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const pin = useCallback(async (id, pinned) => {
    try {
      await updateChat(id, { pinned })
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, pinned } : c)))
      setError(null)
      return true
    } catch (err) {
      console.error('Failed to update chat', err)
      setError("Couldn't update the chat. Please try again.")
      return false
    }
  }, [])

  const remove = useCallback(async (id) => {
    try {
      await deleteChat(id)
      setChats((prev) => prev.filter((c) => c.id !== id))
      setError(null)
      return true
    } catch (err) {
      console.error('Failed to delete chat', err)
      setError("Couldn't delete the chat. Please try again.")
      return false
    }
  }, [])

  return { chats, loading, error, refresh, pin, remove }
}
