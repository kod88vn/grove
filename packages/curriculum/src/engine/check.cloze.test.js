/**
 * P1.5 spec — the `cloze` widget checker.
 *
 * HOMEWORK_PLAN.md §6.3 gives `cloze` exactly one line of contract: it is used for "grammar,
 * vocabulary in context" and its checker is a **per-blank accept list**. `e5.l.context-clues`
 * (§10 Phase 1) is the first skill to need it, and `check.js` today knows only `choice`,
 * `number`, `column` and `fraction`, so `check('cloze', …)` throws `unknown widget`.
 *
 * The shape pinned here follows the plan's wording literally:
 *
 *   answer   = { blanks: [ { accept: ['gregarious', 'sociable'] }, … ] }
 *   response = { blanks: ['Gregarious'] }
 *
 * One `accept` list per blank; a blank is right when the kid's text matches any entry in its
 * own list. Matching is forgiving about the things a kid on an iPad cannot control — leading
 * and trailing space, doubled spaces, and capitalisation — and about nothing else, because a
 * vocabulary answer that is spelled differently is a different word.
 *
 * Two rules mirror the checkers that already exist (`check.untrusted.test.js`):
 *   - a malformed *answer* is an authoring bug and throws `TypeError`, before the response is
 *     even read;
 *   - a malformed *response* is a kid with a stuck keyboard and is graded `invalid`, never
 *     thrown, because the response arrives over HTTP from a browser.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from './check.js'

const oneBlank = { blanks: [{ accept: ['gregarious'] }] }
const twoBlanks = { blanks: [{ accept: ['dense', 'thick'] }, { accept: ['summit'] }] }

test('cloze grades a response that matches the accept list correct', () => {
  assert.deepEqual(check('cloze', oneBlank, { blanks: ['gregarious'] }), {
    correct: true,
    reason: null,
  })
})

test('cloze accepts any entry in a blank’s accept list', () => {
  for (const word of ['dense', 'thick']) {
    assert.deepEqual(
      check('cloze', twoBlanks, { blanks: [word, 'summit'] }),
      { correct: true, reason: null },
      `${word} is in the first blank’s accept list`,
    )
  }
})

test('cloze ignores case and surrounding or doubled whitespace', () => {
  for (const typed of ['Gregarious', 'GREGARIOUS', '  gregarious  ', '\tgregarious\n']) {
    assert.deepEqual(
      check('cloze', oneBlank, { blanks: [typed] }),
      { correct: true, reason: null },
      `${JSON.stringify(typed)} is the same word`,
    )
  }
  assert.deepEqual(
    check('cloze', { blanks: [{ accept: ['set out'] }] }, { blanks: ['Set   out'] }),
    { correct: true, reason: null },
  )
})

test('cloze grades a different word wrong, not invalid', () => {
  assert.deepEqual(check('cloze', oneBlank, { blanks: ['shy'] }), {
    correct: false,
    reason: 'wrong',
  })
})

test('cloze does not accept a misspelling or a prefix of the answer', () => {
  for (const typed of ['gregarous', 'gregario', 'gregariousness']) {
    assert.deepEqual(
      check('cloze', oneBlank, { blanks: [typed] }),
      { correct: false, reason: 'wrong' },
      `${typed} is not the word`,
    )
  }
})

test('cloze is wrong unless every blank matches', () => {
  assert.deepEqual(check('cloze', twoBlanks, { blanks: ['dense', 'summit'] }), {
    correct: true,
    reason: null,
  })
  assert.deepEqual(check('cloze', twoBlanks, { blanks: ['dense', 'valley'] }), {
    correct: false,
    reason: 'wrong',
  })
  assert.deepEqual(check('cloze', twoBlanks, { blanks: ['sparse', 'summit'] }), {
    correct: false,
    reason: 'wrong',
  })
})

test('cloze grades a malformed response invalid without throwing', () => {
  const bad = [
    undefined,
    null,
    'gregarious',
    42,
    {},
    { blanks: 'gregarious' },
    { blanks: [] },
    { blanks: [null] },
    { blanks: [7] },
    { blanks: [['gregarious']] },
    { blanks: ['gregarious', 'extra'] },
    { blanks: [''] },
    { blanks: ['   '] },
  ]
  for (const response of bad) {
    assert.deepEqual(
      check('cloze', oneBlank, response),
      { correct: false, reason: 'invalid' },
      `${JSON.stringify(response) ?? String(response)} is not a usable response`,
    )
  }
})

test('cloze throws on a malformed answer before it reads the response', () => {
  const bad = [
    undefined,
    null,
    {},
    { blanks: [] },
    { blanks: {} },
    { blanks: [{}] },
    { blanks: [{ accept: [] }] },
    { blanks: [{ accept: 'gregarious' }] },
    { blanks: [{ accept: [''] }] },
    { blanks: [{ accept: ['  '] }] },
    { blanks: [{ accept: [null] }] },
    { blanks: [{ accept: ['ok'] }, { accept: [] }] },
  ]
  for (const answer of bad) {
    assert.throws(
      () => check('cloze', answer, { blanks: ['gregarious'] }),
      TypeError,
      `${JSON.stringify(answer) ?? String(answer)} is not a usable answer`,
    )
  }
})

test('cloze does not mutate the answer or the response', () => {
  const answer = { blanks: [{ accept: ['Gregarious'] }] }
  const response = { blanks: ['  GREGARIOUS '] }
  const answerBefore = JSON.stringify(answer)
  const responseBefore = JSON.stringify(response)
  assert.equal(check('cloze', answer, response).correct, true)
  assert.equal(JSON.stringify(answer), answerBefore, 'the answer was rewritten')
  assert.equal(JSON.stringify(response), responseBefore, 'the response was rewritten')
})
