/**
 * P1.5 review follow-up — the item bank's difficulty split is 7/7/6, exactly.
 *
 * PR #81 review thread on `context-clues.test.js:107`. That spec asserts only a floor:
 *
 *     assert.ok(count >= 5, `difficulty ${level} has only ${count} items; ...`)
 *
 * which was written to answer a different question — "does a template picking by difficulty
 * have a real choice, or will a child see the same item twice in a row?" Five is the answer
 * to that. But the PR description promises a 7/7/6 split, and a floor of five cannot hold
 * anyone to it: a later bank of 10/5/5 satisfies every assertion in that file while quietly
 * loading the easy end, and nothing would fail. A child would get a bank that says Grade 5
 * and behaves like Grade 4.
 *
 * So the split is written down here as a contract rather than left as a description in a pull
 * request that no one will read again. Changing the balance is a legitimate thing to want;
 * changing it by accident is not, and this file is the difference between the two.
 *
 * ── This one was green the moment it was written ──────────────────────────────────────────
 * Unlike the rest of the P1.5 follow-ups, no implementation change was needed: the bank is
 * already 7/7/6. That makes it a test-only hardening, and the honest risk with those is that
 * a test which never failed proves nothing. It was checked against a mutated copy of the bank
 * with the split rearranged to 10/5/5, which the existing `>= 5` assertion passes and this
 * file fails:
 *
 *     ✖ the bank is split 7/7/6 across the three difficulties
 *       difficulty 1 holds 10 items; the bank is 7/7/6
 *
 * ── Why the numbers are spelled out rather than computed ──────────────────────────────────
 * `Math.ceil(items.length / 3)` would pass for any bank of twenty and assert nothing about
 * the intent. The point of a contract is that it is a literal someone has to edit on purpose.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { items } from './context-clues.js'

/** difficulty → how many items sit at it. The promise in PR #81. */
const SPLIT = new Map([
  [1, 7],
  [2, 7],
  [3, 6],
])

test('the bank is split 7/7/6 across the three difficulties', () => {
  for (const [level, expected] of SPLIT) {
    const count = items.filter((item) => item.difficulty === level).length
    assert.equal(count, expected, `difficulty ${level} holds ${count} items; the bank is 7/7/6`)
  }
})

test('the split accounts for every item, so no difficulty is smuggled in', () => {
  const total = [...SPLIT.values()].reduce((sum, count) => sum + count, 0)
  assert.equal(total, 20, 'the declared split no longer adds up to a twenty-item bank')
  assert.equal(items.length, total, `the bank holds ${items.length} items but the split declares ${total}`)
  const levels = [...new Set(items.map((item) => item.difficulty))].sort()
  assert.deepEqual(levels, [...SPLIT.keys()], 'an item sits at a difficulty the split does not declare')
})
