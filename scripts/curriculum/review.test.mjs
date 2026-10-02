import assert from 'node:assert/strict'
import { test } from 'node:test'

const draft = {
  id: 'river-crossing',
  skillId: 'e5.l.context-clues',
  grade: 5,
  sentence: 'The bridge was sturdy.',
  answer: 'sturdy',
  reviewedBy: 'agent-draft:pending-parent-review',
  source: 'original',
}

test('approval records the named reviewer and writes versioned content only after an explicit choice', async () => {
  const { approveDraft } = await import('./review.mjs')
  const saved = []
  const result = await approveDraft({
    draft,
    reviewer: 'parent@example.org',
    approved: true,
    save: async (path, content) => { saved.push({ path, content }) },
  })
  assert.equal(saved.length, 1)
  assert.match(saved[0].path, /^packages\/curriculum\/src\/content\/english\//)
  assert.equal(result.reviewedBy, 'parent@example.org')
  assert.equal(saved[0].content.reviewedBy, 'parent@example.org')
  assert.equal(result.id, draft.id)
  assert.equal(draft.reviewedBy, 'agent-draft:pending-parent-review')
})

test('no approval, blank reviewer, or pending marker cannot promote a draft', async () => {
  const { approveDraft } = await import('./review.mjs')
  const saved = []
  for (const options of [
    { approved: false, reviewer: 'parent@example.org' },
    { approved: true, reviewer: '' },
    { approved: true, reviewer: 'agent-draft:pending-parent-review' },
  ]) {
    await assert.rejects(approveDraft({
      draft,
      ...options,
      save: async (...args) => { saved.push(args) },
    }))
  }
  assert.deepEqual(saved, [])
})

test('a rejected draft never enters versioned content', async () => {
  const { rejectDraft } = await import('./review.mjs')
  const saved = []
  await rejectDraft({ draft, save: async (...args) => { saved.push(args) } })
  assert.deepEqual(saved, [])
})

test('approval rejects a present but non-string passage without writing reviewed content', async () => {
  const { approveDraft } = await import('./review.mjs')
  const saved = []
  await assert.rejects(approveDraft({
    draft: { ...draft, passage: { text: 'not a passage' } }, reviewer: 'Parent', approved: true,
    save: async (...args) => { saved.push(args) },
  }), /passage|draft/i)
  assert.deepEqual(saved, [])
})