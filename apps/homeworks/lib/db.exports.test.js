/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals'
import * as db from './db.js'

// F3: getDailyStats called Statement.first(), which better-sqlite3 does not have
// (run/get/all/iterate), and divided milliseconds by 86400 as if they were seconds.
// Nothing calls it (git grep), so it is deleted rather than repaired.
describe('db module surface (F3)', () => {
  it('no longer exports the unreachable getDailyStats', () => {
    expect(Object.keys(db)).not.toContain('getDailyStats')
  })

  it('keeps every export that callers use', () => {
    expect(Object.keys(db).sort()).toEqual([
      '_getDatabase',
      'closeDb',
      'createDatabase',
      'getAllReadings',
      'getAllSubmissions',
      'getDatabase',
      'getReadingById',
      'getReadingsByDateRange',
      'getSubmissionById',
      'getSubmissionsByDateRange',
      'initDb',
      'insertReading',
      'insertSubmission',
      'resetDatabase',
    ])
  })
})
