import { getChat, setPinned, updateTitle, deleteChat } from '@/lib/db/chats'
import { getMessages } from '@/lib/db/messages'

function getUserId(request) {
  return (
    request.headers.get('tailscale-user-login') ||
    request.headers.get('x-forwarded-for') ||
    'anonymous'
  )
}

export async function GET(request, { params }) {
  const { id } = await params
  const userId = getUserId(request)
  const chat = getChat(id, userId)
  if (!chat) return Response.json({ error: 'Not found' }, { status: 404 })
  const messages = getMessages(id)
  return Response.json({ ...chat, messages })
}

export async function PATCH(request, { params }) {
  const { id } = await params
  const userId = getUserId(request)
  const chat = getChat(id, userId)
  if (!chat) return Response.json({ error: 'Not found' }, { status: 404 })

  const updates = await request.json()
  if (typeof updates.pinned === 'boolean') {
    setPinned(id, userId, updates.pinned)
  }
  if (typeof updates.title === 'string' && updates.title.trim()) {
    updateTitle(id, userId, updates.title)
  }
  return Response.json({ ok: true })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  const userId = getUserId(request)
  deleteChat(id, userId)
  return Response.json({ ok: true })
}
