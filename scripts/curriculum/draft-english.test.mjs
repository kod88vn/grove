import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const draftEnglish = async (options) => {
  const module = await import('./draft-english.mjs')
  return module.draftEnglish(options)
}

const candidate = {
  id: 'river-crossing',
  sentence: 'The bridge was ____ enough to carry the children safely across.',
  answer: 'sturdy',
  source: 'original',
}

test('a draft remains unreviewed, in the ignored draft area, and never enters the curriculum', async () => {
  const saved = []
  const result = await draftEnglish({
    skillId: 'e5.l.context-clues',
    grade: 5,
    request: async () => candidate,
    save: async (path, content) => { saved.push({ path, content }) },
  })

  assert.equal(saved.length, 1)
  assert.match(saved[0].path, /^scripts\/curriculum\/drafts\/[^/]+$/)
  assert.deepEqual(saved[0].content, result)
  assert.equal(result.reviewedBy, 'agent-draft:pending-parent-review')
  assert.equal(result.skillId, 'e5.l.context-clues')
  assert.equal(result.grade, 5)
  assert.equal(result.answer, candidate.answer)
  assert.match(readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8'), /^scripts\/curriculum\/drafts\/$/m)
})

test('the model request identifies the skill and grade without claiming approval', async () => {
  let prompt
  await draftEnglish({
    skillId: 'e3.l.context-clues',
    grade: 3,
    request: async (message) => { prompt = message; return candidate },
    save: async () => {},
  })
  assert.match(String(prompt), /e3\.l\.context-clues/)
  assert.match(String(prompt), /grade 3/i)
  assert.doesNotMatch(String(prompt), /already (?:approved|reviewed)/i)
})

test('Nora failure surfaces instead of writing a substitute draft', async () => {
  const saved = []
  await assert.rejects(
    draftEnglish({
      skillId: 'e5.l.context-clues',
      grade: 5,
      request: async () => { throw new Error('Nora unavailable') },
      save: async (...args) => { saved.push(args) },
    }),
    /Nora unavailable/,
  )
  assert.deepEqual(saved, [])
})

test('a malformed response is not stored as if it were reviewable content', async () => {
  const { draftEnglish: implementedDraft } = await import('./draft-english.mjs')
  assert.equal(typeof implementedDraft, 'function')
  const saved = []
  await assert.rejects(draftEnglish({
    skillId: 'e5.l.context-clues',
    grade: 5,
    request: async () => ({ sentence: 'missing item identity' }),
    save: async (...args) => { saved.push(args) },
  }))
  assert.deepEqual(saved, [])
})

test('a candidate missing source cannot be saved with invented provenance', async () => {
  const saved = []
  await assert.rejects(draftEnglish({
    skillId: 'e5.l.context-clues', grade: 5,
    request: async () => ({ ...candidate, source: undefined }),
    save: async (...args) => { saved.push(args) },
  }), /source/i)
  assert.deepEqual(saved, [])
})