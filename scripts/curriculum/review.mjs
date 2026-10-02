import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import { fitsGradeBand } from '../../packages/curriculum/src/engine/readability.js'

const PENDING_REVIEW = 'agent-draft:pending-parent-review'

function requirePendingDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft) ||
      !draft.id || !draft.skillId || !Number.isInteger(draft.grade) ||
      typeof draft.sentence !== 'string' || !draft.sentence.trim() ||
      typeof draft.answer !== 'string' || !draft.answer.trim() ||
      (draft.source !== 'original' && !(typeof draft.source === 'string' && /^public-domain:.+/.test(draft.source))) ||
      draft.reviewedBy !== PENDING_REVIEW) {
    throw new TypeError('Only a well-formed, unreviewed English draft can be reviewed')
  }
  if (typeof draft.passage === 'string' && !fitsGradeBand(draft.passage, draft.grade)) {
    throw new RangeError(`Draft passage is outside grade ${draft.grade} readability band`)
  }
  if (!/^e(?:[1-9]|1[0-2])\.[a-z]+\.[a-z0-9-]+$/.test(draft.skillId) ||
      Number(/^e(\d+)/.exec(draft.skillId)?.[1]) !== draft.grade) {
    throw new TypeError('Draft skill id and grade do not match')
  }
}

function requireReviewer(reviewer) {
  if (typeof reviewer !== 'string' || !reviewer.trim() || reviewer.trim() === PENDING_REVIEW) {
    throw new TypeError('A named human reviewer is required')
  }
  return reviewer.trim()
}

function safeSegment(value) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value)) throw new TypeError('Draft id is not a safe filename')
  return value
}

export async function approveDraft({ draft, reviewer, approved, save }) {
  requirePendingDraft(draft)
  const name = requireReviewer(reviewer)
  if (approved !== true) throw new Error('Approval must be explicitly selected')
  if (typeof save !== 'function') throw new TypeError('A versioned-content writer is required')
  const content = { ...draft, reviewedBy: name }
  const path = `packages/curriculum/src/content/english/items/g${String(draft.grade).padStart(2, '0')}/${draft.skillId.replaceAll('.', '-')}-${safeSegment(draft.id)}.js`
  await save(path, content)
  return content
}

export async function rejectDraft({ draft, reviewer }) {
  requirePendingDraft(draft)
  return { id: draft.id, skillId: draft.skillId, reviewer: typeof reviewer === 'string' ? reviewer.trim() : '', decision: 'rejected' }
}

async function readDraft(filename) {
  if (basename(filename) !== filename || !filename.endsWith('.json')) {
    throw new TypeError('Choose a JSON draft filename from the drafts directory')
  }
  try {
    await access(resolve('scripts/curriculum/drafts', `${filename}.decision.json`))
    throw new Error('This draft already has a recorded review decision')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return JSON.parse(await readFile(resolve('scripts/curriculum/drafts', filename), 'utf8'))
}

async function writeVersioned(path, content) {
  const absolute = resolve(path)
  await mkdir(resolve(absolute, '..'), { recursive: true })
  await writeFile(absolute, `export const items = ${JSON.stringify([content], null, 2)}\n`, { flag: 'wx' })
}

async function writeDecision(filename, decision) {
  const target = resolve('scripts/curriculum/drafts', `${filename}.decision.json`)
  await writeFile(target, `${JSON.stringify(decision, null, 2)}\n`, { flag: 'wx' })
}

async function cli(args) {
  const [decision, filename, ...reviewerArgs] = args
  const reviewerArg = reviewerArgs.find((arg) => arg.startsWith('--reviewer='))
  const reviewer = reviewerArg?.slice('--reviewer='.length)
  const draft = await readDraft(filename || '')
  if (decision === 'approve') {
    const result = await approveDraft({ draft, reviewer, approved: true, save: writeVersioned })
    await writeDecision(filename, { id: result.id, reviewer: result.reviewedBy, decision: 'approved' })
    process.stdout.write(`Approved ${result.id} by ${result.reviewedBy}\n`)
    return
  }
  if (decision === 'reject') {
    const name = requireReviewer(reviewer)
    const result = await rejectDraft({ draft, reviewer: name })
    await writeDecision(filename, { id: result.id, reviewer: result.reviewer, decision: 'rejected' })
    process.stdout.write(`Rejected ${result.id} by ${result.reviewer}; no curriculum source was written\n`)
    return
  }
  throw new TypeError('Usage: review.mjs <approve|reject> <draft.json> --reviewer="Name"')
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  cli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}