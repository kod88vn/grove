import { RECENT_KEEP, ROLLING_WINDOW } from './constants'

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://grove:11434'

export async function callOllama(payload) {
  return fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function compressHistory(model, messages) {
  if (messages.length <= ROLLING_WINDOW) return messages

  const toSummarize = messages.slice(0, -RECENT_KEEP)
  const recent = messages.slice(-RECENT_KEEP)

  const transcript = toSummarize
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  try {
    const res = await callOllama({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following conversation in 3-5 concise sentences. Preserve all key facts, topics, decisions, and answers so the conversation can continue seamlessly.',
        },
        { role: 'user', content: transcript },
      ],
      stream: false,
    })

    if (!res.ok) return recent

    const json = await res.json()
    const summary = json.message?.content?.trim()
    if (!summary) return recent

    return [
      { role: 'system', content: `[Conversation so far]: ${summary}` },
      ...recent,
    ]
  } catch {
    return recent
  }
}
