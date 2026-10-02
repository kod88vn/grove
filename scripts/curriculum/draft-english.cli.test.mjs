import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { draftEnglish } from './draft-english.mjs'

const candidate = { id: 'river-clue', sentence: 'The bridge was sturdy.', answer: 'sturdy', source: 'original' }

test('drafting validates skill grade and stores only an unreviewed candidate', async () => {
  const writes = []
  const draft = await draftEnglish({
    skillId: 'e5.l.context-clues',
    grade: 5,
    request: async (prompt) => {
      assert.match(prompt, /e5\.l\.context-clues.*grade 5/i)
      assert.doesNotMatch(prompt, /already approved|already reviewed/i)
      return candidate
    },
    save: async (...args) => writes.push(args),
  })
  assert.equal(draft.reviewedBy, 'agent-draft:pending-parent-review')
  assert.match(writes[0][0], /^scripts\/curriculum\/drafts\//)
})

test('model, malformed content, and out-of-band passages never reach draft storage', async () => {
  for (const request of [
    async () => { throw new Error('Nora unavailable') },
    async () => ({ id: 'broken' }),
    async () => ({ ...candidate, id: 'bad-source', source: 'unknown-source' }),
    async () => ({ ...candidate, passage: 'Bioluminescent microorganisms demonstrate complex adaptations in subterranean ecosystems.', id: 'advanced-passage' }),
  ]) {
    const writes = []
    await assert.rejects(draftEnglish({ skillId: 'e1.l.context-clues', grade: 1, request, save: async (...args) => writes.push(args) }))
    assert.deepEqual(writes, [])
  }
})

test('the actual draft CLI rejects a mismatched grade before contacting Nora', () => {
  const script = fileURLToPath(new URL('./draft-english.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [script, '--skill=e5.l.context-clues', '--grade=4'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /grade must match/i)
})