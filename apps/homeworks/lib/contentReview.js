import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import { fitsGradeBand } from '../../../packages/curriculum/src/engine/readability.js'

const PENDING_REVIEW = 'agent-draft:pending-parent-review'

function defaultDraftsDirectory() {
  return resolve(process.cwd(), '../../scripts/curriculum/drafts')
}

function decisionPath(filename, directory) {
  return resolve(directory, `${filename}.decision.json`)
}

function validateFilename(filename) {
  if (typeof filename !== 'string' || !filename || basename(filename) !== filename ||
      !filename.endsWith('.json') || filename.endsWith('.decision.json')) {
    throw new TypeError('Invalid draft filename')
  }
}

function versionedWriter(path, content) {
  const target = resolve(process.cwd(), '../..', path)
  return mkdir(resolve(target, '..'), { recursive: true })
    .then(() => writeFile(target, `export const items = ${JSON.stringify([content], null, 2)}\n`, { flag: 'wx' }))
}

async function readDraft(filename, directory) {
  validateFilename(filename)
  const text = await readFile(resolve(directory, filename), 'utf8')
  return JSON.parse(text)
}

async function hasDecision(filename, directory) {
  validateFilename(filename)
  try {
    await readFile(decisionPath(filename, directory), 'utf8')
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

export async function listPendingDrafts(directory = defaultDraftsDirectory()) {
  let filenames
  try {
    filenames = await readdir(directory)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const drafts = []
  for (const filename of filenames.filter((name) => name.endsWith('.json') && !name.endsWith('.decision.json')).sort()) {
    if (!await hasDecision(filename, directory)) drafts.push({ filename, draft: await readDraft(filename, directory) })
  }
  return drafts
}

export async function recordDraftDecision({ filename, reviewer, approved, directory = defaultDraftsDirectory(), save = versionedWriter }) {
  validateFilename(filename)
  if (approved !== true && approved !== false) throw new TypeError('Choose approve or reject explicitly')
  if (typeof reviewer !== 'string' || !reviewer.trim() || reviewer.trim() === 'agent-draft:pending-parent-review') {
    throw new TypeError('A named human reviewer is required')
  }
  if (await hasDecision(filename, directory)) throw new Error('This draft already has a recorded decision')
  const draft = await readDraft(filename, directory)
  validateDraft(draft)
  const name = reviewer.trim()
  let content
  if (approved) {
    content = { ...draft, reviewedBy: name }
    const path = `packages/curriculum/src/content/english/items/g${String(draft.grade).padStart(2, '0')}/${draft.skillId.replaceAll('.', '-')}-${draft.id}.js`
    await save(path, content)
  } else {
    content = draft
  }
  const decision = { id: draft.id, reviewer: name, decision: approved ? 'approved' : 'rejected' }
  await writeFile(decisionPath(filename, directory), `${JSON.stringify(decision, null, 2)}\n`, { flag: 'wx' })
  return decision
}

function validateDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft) ||
      typeof draft.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(draft.id) ||
      typeof draft.skillId !== 'string' || !/^e(?:[1-9]|1[0-2])\.[a-z]+\.[a-z0-9-]+$/.test(draft.skillId) ||
      typeof draft.grade !== 'number' || Number(/^e(\d+)/.exec(draft.skillId)?.[1]) !== draft.grade ||
      typeof draft.sentence !== 'string' || !draft.sentence.trim() ||
      typeof draft.answer !== 'string' || !draft.answer.trim() ||
      (draft.passage !== undefined && typeof draft.passage !== 'string') ||
      (draft.source !== 'original' && !(typeof draft.source === 'string' && /^public-domain:.+/.test(draft.source))) ||
      draft.reviewedBy !== PENDING_REVIEW) {
    throw new TypeError('Only a well-formed, unreviewed English draft can be reviewed')
  }
  if (typeof draft.passage === 'string' && !fitsGradeBand(draft.passage, draft.grade)) {
    throw new RangeError(`Draft passage is outside grade ${draft.grade} readability band`)
  }
}