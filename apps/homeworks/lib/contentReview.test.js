import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { listPendingDrafts, recordDraftDecision } from './contentReview'

const draft = {
  id: 'river-crossing',
  skillId: 'e5.l.context-clues',
  grade: 5,
  sentence: 'The bridge was ____ enough to carry the children safely across.',
  answer: 'sturdy',
  source: 'original',
  reviewedBy: 'agent-draft:pending-parent-review',
}

let directory

beforeEach(async () => {
  directory = await mkdtemp(resolve(process.cwd(), '../../tmp/u19-content-review-'))
  await writeFile(resolve(directory, 'draft.json'), JSON.stringify(draft))
})

afterEach(async () => rm(directory, { recursive: true, force: true }))

describe('pending English draft storage', () => {
  test('lists pending drafts but hides items with recorded decisions', async () => {
    expect(await listPendingDrafts(directory)).toHaveLength(1)
    await writeFile(resolve(directory, 'draft.json.decision.json'), JSON.stringify({ decision: 'rejected' }))
    expect(await listPendingDrafts(directory)).toEqual([])
  })

  test('approval writes a new source with the reviewer and preserves the pending draft', async () => {
    const save = jest.fn(async () => {})
    const result = await recordDraftDecision({ filename: 'draft.json', reviewer: 'Parent One', approved: true, directory, save })
    expect(result).toEqual({ id: draft.id, reviewer: 'Parent One', decision: 'approved' })
    expect(save).toHaveBeenCalledWith(expect.stringMatching(/^packages\/curriculum\/src\/content\/english\/items\/g05\//), expect.objectContaining({ reviewedBy: 'Parent One' }))
    expect(JSON.parse(await readFile(resolve(directory, 'draft.json'), 'utf8')).reviewedBy).toBe(draft.reviewedBy)
    expect(await listPendingDrafts(directory)).toEqual([])
    await expect(recordDraftDecision({ filename: 'draft.json', reviewer: 'Parent One', approved: true, directory, save })).rejects.toThrow(/already has a recorded decision/i)
  })

  test('rejection records the reviewer without promoting content', async () => {
    const save = jest.fn()
    const result = await recordDraftDecision({ filename: 'draft.json', reviewer: 'Parent Two', approved: false, directory, save })
    expect(result.decision).toBe('rejected')
    expect(save).not.toHaveBeenCalled()
    expect(JSON.parse(await readFile(resolve(directory, 'draft.json.decision.json'), 'utf8'))).toEqual(result)
  })

  test('blank reviewers, reviewed candidates, and out-of-band passages fail before writing', async () => {
    const save = jest.fn()
    for (const options of [
      { reviewer: '', approved: true },
      { reviewer: 'Parent', approved: true, candidate: { ...draft, reviewedBy: 'Parent' } },
      { reviewer: 'Parent', approved: true, candidate: { ...draft, source: 'unknown-source' } },
      { reviewer: 'Parent', approved: true, candidate: { ...draft, passage: 'Bioluminescent microorganisms demonstrate complex adaptations in subterranean ecosystems.' } },
    ]) {
      if (options.candidate) await writeFile(resolve(directory, 'draft.json'), JSON.stringify(options.candidate))
      await expect(recordDraftDecision({ filename: 'draft.json', reviewer: options.reviewer, approved: options.approved, directory, save })).rejects.toThrow()
      expect(save).not.toHaveBeenCalled()
      await rm(resolve(directory, 'draft.json.decision.json'), { force: true })
      await writeFile(resolve(directory, 'draft.json'), JSON.stringify(draft))
    }
  })

  test('version writer failures surface and do not record an approval decision', async () => {
    await expect(recordDraftDecision({
      filename: 'draft.json', reviewer: 'Parent', approved: true, directory,
      save: async () => { throw new Error('cannot write source') },
    })).rejects.toThrow(/cannot write source/)
    expect(await listPendingDrafts(directory)).toHaveLength(1)
  })
})