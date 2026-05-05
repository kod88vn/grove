/** Client-side fetch wrappers for the /api/chats REST endpoints. */

export async function fetchChats() {
  const res = await fetch('/api/chats')
  return res.ok ? res.json() : []
}

export async function createChat(title) {
  const res = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return res.ok ? res.json() : null
}

export async function fetchChatDetail(id) {
  const res = await fetch(`/api/chats/${id}`)
  return res.ok ? res.json() : null
}

export async function updateChat(id, updates) {
  return fetch(`/api/chats/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
}

export async function deleteChat(id) {
  return fetch(`/api/chats/${id}`, { method: 'DELETE' })
}
