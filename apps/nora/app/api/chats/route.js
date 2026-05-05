import { createChat, listChats } from '@/lib/db/chats'

function getUserId(request) {
  return (
    request.headers.get('tailscale-user-login') ||
    request.headers.get('x-forwarded-for') ||
    'anonymous'
  )
}

export async function GET(request) {
  const userId = getUserId(request)
  const chats = listChats(userId)
  return Response.json(chats)
}

export async function POST(request) {
  const { title } = await request.json()
  const userId = getUserId(request)
  const chat = createChat(userId, title || 'New Chat')
  return Response.json(chat, { status: 201 })
}
