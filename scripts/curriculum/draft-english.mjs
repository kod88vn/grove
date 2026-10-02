import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { fitsGradeBand } from '../../packages/curriculum/src/engine/readability.js'

const PENDING_REVIEW = 'agent-draft:pending-parent-review'
const NORA_BASE = `${process.env.PLT_NORA_URL || 'http://localhost:3001'}/chat`

function validateRequest(skillId, grade) {
  if (!/^e(?:[1-9]|1[0-2])\.[a-z]+\.[a-z0-9-]+$/.test(skillId || '')) {
    throw new TypeError('skillId must be a valid English curriculum skill id')
  }
  const skillGrade = Number(/^e(\d+)/.exec(skillId)?.[1])
  if (!Number.isInteger(grade) || grade < 1 || grade > 12 || grade !== skillGrade) {
    throw new RangeError('grade must match the English skill id and be between 1 and 12')
  }
}

function validateCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('Nora returned a malformed English candidate')
  }
  for (const field of ['id', 'sentence', 'answer']) {
    if (typeof candidate[field] !== 'string' || !candidate[field].trim()) {
      throw new TypeError(`Nora candidate requires a non-empty ${field}`)
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id)) {
    throw new TypeError('Nora candidate id must be a lowercase slug')
  }
  if (candidate.source !== 'original' &&
      !(typeof candidate.source === 'string' && /^public-domain:.+/.test(candidate.source))) {
    throw new TypeError('Nora candidate requires explicit original or named public-domain source provenance')
  }
  return candidate
}

async function requestFromNora(instruction, selection) {
  const response = await fetch(`${NORA_BASE}/api/nora-homework/authoring`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...selection, instruction }),
  })
  if (!response.ok) {
    throw new Error(`Nora authoring request failed (${response.status}): ${await response.text()}`)
  }
  const result = await response.json()
  if (result.offline === true) throw new Error('Nora is offline; no draft was created')
  return result.candidate
}

async function saveDraft(path, content) {
  const absolute = resolve(path)
  await mkdir(resolve(absolute, '..'), { recursive: true })
  await writeFile(absolute, `${JSON.stringify(content, null, 2)}\n`, { flag: 'wx' })
}

export async function draftEnglish({ skillId, grade, request = requestFromNora, save = saveDraft }) {
  validateRequest(skillId, grade)
  const prompt = `Draft one original English item for skill ${skillId}, grade ${grade}. Return JSON with id, sentence, answer, and any skill-specific fields. This is an unreviewed candidate, not approved content.`
  const candidate = validateCandidate(await request(prompt, { skillId, grade }))
  const draft = {
    ...candidate,
    id: candidate.id,
    skillId,
    grade,
    source: candidate.source,
    reviewedBy: PENDING_REVIEW,
  }
  if (typeof draft.passage === 'string' && !fitsGradeBand(draft.passage, grade)) {
    throw new RangeError(`Nora passage is outside grade ${grade} readability band`)
  }
  await save(`scripts/curriculum/drafts/${skillId.replaceAll('.', '-')}-${draft.id}.json`, draft)
  return draft
}

function parseArguments(args) {
  const values = Object.fromEntries(args.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=')
    return [key, rest.join('=')]
  }))
  return { skillId: values.skill, grade: Number(values.grade) }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  draftEnglish(parseArguments(process.argv)).then((draft) => {
    process.stdout.write(`Draft saved for ${draft.skillId}, grade ${draft.grade}: ${draft.id}\n`)
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}