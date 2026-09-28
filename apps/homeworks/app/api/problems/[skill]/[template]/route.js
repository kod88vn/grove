import { getProblem, render, toInstance } from '@grove/curriculum'

const MAX_SEED = 2147483647
const SUPPORTED_PARAMETERS = new Set(['seed'])

export async function GET(request, { params }) {
  const searchParams = new URL(request.url).searchParams

  for (const parameter of searchParams.keys()) {
    if (!SUPPORTED_PARAMETERS.has(parameter)) {
      return Response.json({ error: `Unsupported parameter: ${parameter}` }, { status: 400 })
    }
  }

  let seed
  if (searchParams.has('seed')) {
    const raw = searchParams.get('seed')
    const value = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value > MAX_SEED) {
      return Response.json({ error: 'seed must be an integer in range 0..2147483647' }, { status: 400 })
    }
    seed = value
  } else {
    seed = Math.floor(Math.random() * (MAX_SEED + 1))
  }

  const { skill, template } = await params
  const problem = getProblem(`${skill}/${template}`)
  if (!problem) return Response.json({ error: 'Problem not found' }, { status: 404 })

  return Response.json({ instance: toInstance(render(problem, seed)) })
}