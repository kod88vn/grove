import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const reviewScript = fileURLToPath(new URL('./review.mjs', import.meta.url))
const pendingDraft = {
  id: 'river-crossing',
  skillId: 'e5.l.context-clues',
  grade: 5,
  sentence: 'The bridge was sturdy.',
  answer: 'sturdy',
  source: 'original',
  reviewedBy: 'agent-draft:pending-parent-review',
}

async function createSandbox() {
  const root = await mkdtemp(resolve('tmp/u19-review-cli-'))
  const drafts = resolve(root, 'scripts/curriculum/drafts')
  await mkdir(drafts, { recursive: true })
  await writeFile(resolve(drafts, 'candidate.json'), JSON.stringify(pendingDraft))
  return { root, drafts }
}

function runReview(root, decision) {
  return spawnSync(process.execPath, [reviewScript, decision, 'candidate.json', '--reviewer=Parent Reviewer'], {
    cwd: root,
    encoding: 'utf8',
  })
}

test('the review CLI promotes only after explicit approval and preserves the original pending draft', async () => {
  const { root, drafts } = await createSandbox()
  try {
    const result = runReview(root, 'approve')
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Approved river-crossing by Parent Reviewer/)
    const modulePath = resolve(root, 'packages/curriculum/src/content/english/items/g05/e5-l-context-clues-river-crossing.js')
    const module = await readFile(modulePath, 'utf8')
    assert.match(module, /Parent Reviewer/)
    assert.equal(JSON.parse(await readFile(resolve(drafts, 'candidate.json'), 'utf8')).reviewedBy, pendingDraft.reviewedBy)
    assert.equal(JSON.parse(await readFile(resolve(drafts, 'candidate.json.decision.json'), 'utf8')).decision, 'approved')
    assert.notEqual(runReview(root, 'approve').status, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the review CLI records rejection without writing versioned curriculum content', async () => {
  const { root, drafts } = await createSandbox()
  try {
    const result = runReview(root, 'reject')
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /no curriculum source was written/)
    assert.equal(JSON.parse(await readFile(resolve(drafts, 'candidate.json.decision.json'), 'utf8')).decision, 'rejected')
    await assert.rejects(readFile(resolve(root, 'packages/curriculum/src/content/english/items/g05/e5-l-context-clues-river-crossing.js')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})