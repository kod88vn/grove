/**
 * @jest-environment node
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { initDb, getSubmissionById, getReadingById } from './db.js'
import { recordSubmission, recordReading } from './progress.js'

// F2: ids were `${subject}-${Date.now()}` and `reading-${Date.now()}`, so two
// records saved inside one millisecond collided on the PRIMARY KEY.
const FROZEN_NOW = Date.UTC(2026, 4, 24, 12, 0, 0)

function saveSubmission() {
  return recordSubmission('public', 'math', 'problem-set', 'ex-1', 4, 5, { overallFeedback: 'ok' })
}

function saveReading() {
  return recordReading('public', 'A passage', [], 'LP1', 'science', 3, 5, { q1: 'a' })
}

describe('record ids are unique within one millisecond (F2)', () => {
  beforeEach(() => {
    initDb(':memory:')
    jest.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(() => {
    initDb(':memory:')
  })

  it('saves two same-subject submissions made in the same millisecond', () => {
    const first = saveSubmission()
    const second = saveSubmission()

    expect(second.id).not.toBe(first.id)
    expect(getSubmissionById(first.id)).toMatchObject({ subject: 'math', score: 4 })
    expect(getSubmissionById(second.id)).toMatchObject({ subject: 'math', score: 4 })
  })

  it('saves two readings made in the same millisecond', () => {
    const first = saveReading()
    const second = saveReading()

    expect(second).not.toBe(first)
    expect(getReadingById(first)).toMatchObject({ lesson_key_point: 'LP1' })
    expect(getReadingById(second)).toMatchObject({ lesson_key_point: 'LP1' })
  })

  it('keeps ids unique across many records while the clock does not move', () => {
    const submissionIds = Array.from({ length: 50 }, () => saveSubmission().id)
    const readingIds = Array.from({ length: 50 }, () => saveReading())

    expect(new Set(submissionIds).size).toBe(50)
    expect(new Set(readingIds).size).toBe(50)
  })
})
