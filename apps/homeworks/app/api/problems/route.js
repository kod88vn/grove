import { listProblems } from '@grove/curriculum'

const SUPPORTED_PARAMETERS = new Set(['subject', 'grade', 'skill', 'difficulty'])

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams

  for (const parameter of searchParams.keys()) {
    if (!SUPPORTED_PARAMETERS.has(parameter)) {
      return Response.json({ error: `Unsupported parameter: ${parameter}` }, { status: 400 })
    }
  }

  const filter = {}

  for (const parameter of ['subject', 'skill']) {
    if (searchParams.has(parameter)) filter[parameter] = searchParams.get(parameter)
  }

  for (const parameter of ['grade', 'difficulty']) {
    if (!searchParams.has(parameter)) continue
    const raw = searchParams.get(parameter)
    const value = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isInteger(value)) {
      return Response.json({ error: `${parameter} must be an integer` }, { status: 400 })
    }
    filter[parameter] = value
  }

  return Response.json({ problems: listProblems(filter) })
}
