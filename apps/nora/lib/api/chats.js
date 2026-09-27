import { apiPath } from './path.js'

/** Client-side fetch wrappers for the /api/chats REST endpoints. */

export async function fetchChats() {
  const res = await fetch(apiPath('/api/chats'))
  if (!res.ok) throw new Error(`Failed to load chats: ${res.status}`)
  return res.json()
}

export async function createChat(title) {
  const res = await fetch(apiPath('/api/chats'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return res.ok ? res.json() : null
}

export async function fetchChatDetail(id) {
  const res = await fetch(apiPath(`/api/chats/${id}`))
  if (!res.ok) throw new Error(`Failed to load chat: ${res.status}`)
  return res.json()
}

export async function updateChat(id, updates) {
  const res = await fetch(apiPath(`/api/chats/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`Failed to update chat: ${res.status}`)
  return res
}

export async function deleteChat(id) {
  const res = await fetch(apiPath(`/api/chats/${id}`), { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete chat: ${res.status}`)
  return res
}
