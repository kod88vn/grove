import { callAI } from '@/app/api/chat/lib/callAI'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

const CANDIDATE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'english_candidate',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        sentence: { type: 'string' },
        answer: { type: 'string' },
        source: { type: 'string', enum: ['original'] },
      },
      required: ['id', 'sentence', 'answer', 'source'],
      additionalProperties: true,
    },
  },
}

function validSelection(skillId, grade) {
  const match = /^e(\d+)\.[a-z]+\.[a-z0-9-]+$/.exec(skillId || '')
  return match && Number(match[1]) === grade && Number.isInteger(grade) && grade >= 1 && grade <= 12
}

function parseCandidate(content) {
  if (content && typeof content === 'object') return content
  if (typeof content !== 'string') return null
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { skillId, grade } = body || {}
  if (!validSelection(skillId, grade)) {
    return Response.json({ error: 'A matching English skill id and grade are required' }, { status: 400 })
  }

  try {
    const response = await callAI({
      model: process.env.HOMEWORKS_OLLAMA_MODEL || DEFAULT_MODEL,
      messages: [{
        role: 'user',
        content: `Create one original English curriculum item for ${skillId}, grade ${grade}. Return a JSON object with a lowercase hyphenated id, one sentence with a single blank represented by ____ when appropriate, a concise answer, source set to original, and any skill-specific fields. This is an unreviewed draft only. Never claim that a person reviewed or approved it.`,
      }],
      stream: false,
      options: { num_predict: 700, temperature: 0.3, think: false, response_format: CANDIDATE_FORMAT },
    })
    if (response.headers.get('X-AI-Offline') === 'true') {
      return Response.json({ error: 'Nora is offline; no draft was created' }, { status: 503 })
    }
    if (!response.ok) throw new Error(`Nora model returned ${response.status}`)
    const payload = await response.json()
    const candidate = parseCandidate(payload?.message?.content)
    if (!candidate || typeof candidate.id !== 'string' || typeof candidate.sentence !== 'string' || typeof candidate.answer !== 'string') {
      throw new Error('Nora returned a malformed authoring candidate')
    }
    return Response.json({ candidate })
  } catch (error) {
    return Response.json({ error: error.message || 'Nora authoring failed' }, { status: 502 })
  }
}