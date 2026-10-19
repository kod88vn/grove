/** @jest-environment node */
import { expect, it } from '@jest/globals'
import { wateringSummary } from './kidExperience.js'

const watered = (date) => ({ student_id: 'kid', local_date: date, correct: 1, revealed: 0 })

it('never awards a watering streak to a child with no watered days, even on a rain-day Monday or Tuesday', () => {
  for (const today of ['2026-09-28', '2026-09-29']) {
    const summary = wateringSummary({ attempts: [], studentId: 'kid', today })
    expect(summary.streak).toBe(0)
    expect(summary.wateredDays).toBe(0)
  }
})

it('does not resurrect a streak after a full week without watering just because the current week has two rain days', () => {
  const summary = wateringSummary({ attempts: [watered('2026-09-14')], studentId: 'kid', today: '2026-09-29' })
  expect(summary.streak).toBe(0)
})

it('still bridges up to two genuine missed days once a watered day anchors the streak', () => {
  const summary = wateringSummary({ attempts: [watered('2026-09-28')], studentId: 'kid', today: '2026-09-29' })
  expect(summary.streak).toBe(2)
})
