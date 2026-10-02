/** @jest-environment node */
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'
import { closeDb, getOwnedDecorations, getSunshineBalance, initDb, insertAttempt, insertStudent, purchaseDecoration } from './db.js'

function addStars(studentId, stars) {
  for (let remaining = stars, index = 0; remaining > 0; index += 1) {
    const award = Math.min(remaining, 3)
    insertAttempt({
      id: `earned-${studentId}-${index}`, session_id: null, student_id: studentId, subject: 'math', grade: 5,
      skill_id: 'm5.oa.order-of-operations', problem_id: 'm5.oa.order-of-operations/precedence',
      content_version: 1, seed: index + 1, difficulty: 1, shown: {}, response: {}, answer: {}, correct: true,
      tries: 1, hints_used: 0, revealed: 0, stars: award, rubric: null, duration_ms: 1, local_date: '2026-09-30',
    })
    remaining -= award
  }
}

beforeEach(() => {
  initDb(':memory:')
  insertStudent({ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5, settings: {} })
  insertStudent({ id: 'kid-b', display_name: 'Theo', avatar: '🐻', grade: 5, settings: {} })
})
afterAll(closeDb)

describe('cosmetic purchase persistence', () => {
  it('keeps owned items and Sunshine balances isolated while lifetime stars never decrease', () => {
    addStars('kid-a', 9)
    expect(getSunshineBalance('kid-a')).toBe(9)
    expect(purchaseDecoration({ studentId: 'kid-a', decorationId: 'lantern', price: 3 })).toBe('purchased')
    expect(getSunshineBalance('kid-a')).toBe(6)
    expect(getOwnedDecorations('kid-a')).toEqual([{ id: 'lantern', price: 3 }])
    expect(getSunshineBalance('kid-b')).toBe(0)
    expect(getOwnedDecorations('kid-b')).toEqual([])
    expect(purchaseDecoration({ studentId: 'kid-a', decorationId: 'bench', price: 7 })).toBe('insufficient-sunshine')
    expect(getSunshineBalance('kid-a')).toBe(6)
  })

  it('rejects duplicate ownership without charging twice and reports missing children', () => {
    addStars('kid-a', 3)
    expect(purchaseDecoration({ studentId: 'kid-a', decorationId: 'lantern', price: 3 })).toBe('purchased')
    expect(purchaseDecoration({ studentId: 'kid-a', decorationId: 'lantern', price: 3 })).toBe('already-owned')
    expect(purchaseDecoration({ studentId: 'missing', decorationId: 'lantern', price: 3 })).toBe('student-not-found')
    expect(getSunshineBalance('kid-a')).toBe(0)
  })
})
