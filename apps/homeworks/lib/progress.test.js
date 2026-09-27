import { afterEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('./db.js', () => ({
  insertSubmission: jest.fn(),
  insertReading: jest.fn(),
  getAllSubmissions: jest.fn(() => []),
  getAllReadings: jest.fn(() => []),
}))

const { getAllSubmissions, getAllReadings } = jest.requireMock('./db.js')
const { getSubmissionsForDay, getReadingsForDay } = require('./progress.js')

describe('single-day lookups (F1)', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('queries the local day in the given zone', () => {
    getSubmissionsForDay('2026-05-24', 'America/New_York')
    getReadingsForDay('2026-05-24', 'America/New_York')

    const nyDay = [Date.UTC(2026, 4, 24, 4), Date.UTC(2026, 4, 25, 4)]
    expect(getAllSubmissions).toHaveBeenCalledWith(...nyDay)
    expect(getAllReadings).toHaveBeenCalledWith(...nyDay)
  })

  it('keeps UTC days when no zone is given', () => {
    getSubmissionsForDay('2026-05-24')

    expect(getAllSubmissions).toHaveBeenCalledWith(Date.UTC(2026, 4, 24), Date.UTC(2026, 4, 25))
  })
})
