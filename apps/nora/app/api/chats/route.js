import { createChat, listChats } from '@/lib/db/chats'

function getUserId(request) {
  return (
    request.headers.get('tailscale-user-login') ||
    request.headers.get('x-forwarded-for') ||
    'anonymous'
  )
}

export async function GET(request) {
  try {
    const userId = getUserId(request)
    console.error(`[nora/api/chats] GET userId=${userId}`)
    const chats = listChats(userId)
    return Response.json(chats)
  } catch (err) {
    console.error(`[nora/api/chats] GET error:`, err.message)
    console.error(`[nora/api/chats] stack:`, err.stack)
    return Response.json(
      { error: 'Internal server error', detail: process.env.NODE_ENV === 'production' ? undefined : err.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const { title } = await request.json()
    const userId = getUserId(request)
    console.error(`[nora/api/chats] POST title=${title} userId=${userId}`)
    const chat = createChat(userId, title || 'New Chat')
    return Response.json(chat, { status: 201 })
  } catch (err) {
    console.error(`[nora/api/chats] POST error:`, err.message)
    console.error(`[nora/api/chats] stack:`, err.stack)
    return Response.json(
      { error: 'Internal server error', detail: process.env.NODE_ENV === 'production' ? undefined : err.message },
      { status: 500 }
    )
  }
}