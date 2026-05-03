import { DEFAULT_MODEL } from './lib/constants'
import { streamResponse } from './lib/chatStream'

export async function POST(request) {
  const { model = DEFAULT_MODEL, messages } = await request.json()

  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: 'Invalid messages' }, { status: 400 })
  }

  return streamResponse(model, messages)
}
