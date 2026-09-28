/**
 * P2.9 part 1b of 2 — the first `match` template: join each written description to the
 * numeric expression it describes.
 *
 * HOMEWORK_PLAN.md §6.3 (line 190):
 *
 *   | `match` (pairs) | synonyms, word↔picture, fraction↔decimal | pair set equality | A |
 *
 * The skill is already in the catalog, in grade: `m5.oa.numeric-expressions`
 * (`src/catalog/math/grade-05.js`), CCSS 5.OA.A.2 — *"Write simple expressions that record
 * calculations with numbers, and interpret numerical expressions without evaluating them."*
 * Pairing a description with its expression IS that standard, not an application of it, so
 * nothing here is off-grade and `OFF_GRADE` in `grade-05.offgrade.test.js` is untouched.
 *
 * WHAT MAKES THIS THE RIGHT CONTENT, and each rule the generator must obey:
 *
 * 1. THE DIGITS MUST CARRY NO INFORMATION. Every expression on the board is built from the
 *    same three numbers `a`, `b`, `c`, written in that order, so all four right-hand cards
 *    show the IDENTICAL sequence of numerals and differ only in their operators and
 *    brackets. A child cannot match "the card with the 7 in it" to anything; they have to
 *    read `the sum of` and decide whether it is bracketed. That is the entire skill.
 *    This is asserted directly below, and it is the property that rules out the whole
 *    family of surface shortcuts (biggest number, first number, longest card, shared digit)
 *    in one stroke, rather than one assertion per shortcut.
 * 2. NEITHER COLUMN'S ORDER MAY REVEAL THE PAIRING. P2.8 shipped a generator that passed
 *    "the cards are not already grouped" by dealing them in strict alternation, which made
 *    the display position the answer. The lesson recorded there is that arrangement has to
 *    be MEASURED, not argued: below, every one of the sixteen (left position, right
 *    position) cells is pinned strictly inside 8–45% over a 400-seed sweep (chance is 25%),
 *    the permutation itself must take at least twelve of its twenty-four possible values,
 *    and the id suffixes are held to the same bound so that `left-2 ↔ right-2` is not a
 *    strategy either.
 * 3. THE NUMBERS ARE DISTINCT AND AT LEAST TWO, AND `b > c`. With `a = 1` or `b = 1` two of
 *    the five structures collapse onto the same value; with a repeat among `a`, `b`, `c` a
 *    description stops being unambiguous ("`a` times the sum of `b` and `c`" with `b = c`).
 *    `b > c` keeps every difference non-negative — a Grade 5 board must not produce one.
 * 4. FIVE STRUCTURES, FOUR SHOWN. The board must not be the same four forms every time, or
 *    a child memorises four sentences instead of reading them.
 * 5. THE ANSWER NEVER TRAVELS. `toInstance()` strips it; the leak test below also refuses
 *    each couple's ids rendered under any plausible separator.
 *
 * THE ORACLE IS SEMANTIC, NOT A COPY OF THE GENERATOR. Rather than re-listing the
 * generator's string templates, this file PARSES both columns back into a canonical
 * arithmetic tree — `+` and `×` normalised as commutative, `−` left ordered — and derives
 * the pairing from those trees alone. So a generator that emits the right sentences but the
 * wrong pairing fails here, and the two cannot agree with each other while both being
 * wrong. Note that `X more than Y times Z` is the phrase for BOTH `a × b + c` and
 * `a + b × c`; the two are told apart by where the numbers land, which is exactly why the
 * oracle canonicalises instead of pattern-matching a structure name.
 *
 * `toInstance()`'s allowlist gains `match` in `index.api.test.js` in the same commit.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'
import { templates } from './match-expressions.js'

const ID = 'm5.oa.numeric-expressions/match-expressions'
const SKILL = 'm5.oa.numeric-expressions'
const COUNT = 4
const SEEDS = [1, 2, 7, 42, 12_345, 999_999]
const SWEEP = Array.from({ length: 400 }, (unused, index) => index + 1)

// ------------------------------------------------------------------ the oracle
const mul = (x, y) => `*(${[x, y].sort().join('|')})`
const add = (x, y) => `+(${[x, y].sort().join('|')})`
const sub = (x, y) => `-(${x}|${y})`

/** `×` is U+00D7 and `−` is U+2212; a hyphen-minus is a different character and fails here. */
const EXPRESSION_FORMS = [
  [/^(\d+) × \((\d+) \+ (\d+)\)$/, (a, b, c) => mul(a, add(b, c))],
  [/^(\d+) × \((\d+) − (\d+)\)$/, (a, b, c) => mul(a, sub(b, c))],
  [/^(\d+) × (\d+) \+ (\d+)$/, (a, b, c) => add(mul(a, b), c)],
  [/^(\d+) × (\d+) − (\d+)$/, (a, b, c) => sub(mul(a, b), c)],
  [/^(\d+) \+ (\d+) × (\d+)$/, (a, b, c) => add(a, mul(b, c))],
]

const DESCRIPTION_FORMS = [
  [/^(\d+) times the sum of (\d+) and (\d+)$/, (a, b, c) => mul(a, add(b, c))],
  [/^(\d+) times the difference of (\d+) and (\d+)$/, (a, b, c) => mul(a, sub(b, c))],
  [/^(\d+) more than (\d+) times (\d+)$/, (x, y, z) => add(mul(y, z), x)],
  [/^(\d+) less than (\d+) times (\d+)$/, (x, y, z) => sub(mul(y, z), x)],
]

function canonical(label, forms, what) {
  for (const [pattern, build] of forms) {
    const found = pattern.exec(label)
    if (found !== null) return build(found[1], found[2], found[3])
  }
  throw new assert.AssertionError({ message: `${what} is not a form this row ships: ${JSON.stringify(label)}` })
}

/**
 * Which of the five expression structures a card is, by name rather than by tree. The
 * canonical tree is deliberately unusable for this: `a × b + c` and `a + b × c` both
 * normalise to `+(×(n,n), n)` once the digits are blanked out, which is the whole reason
 * the oracle above has to keep the digits.
 */
const STRUCTURE_NAMES = ['sum-grouped', 'diff-grouped', 'sum-loose', 'diff-loose', 'add-first']

function structureOf(label) {
  const index = EXPRESSION_FORMS.findIndex(([pattern]) => pattern.test(label))
  assert.ok(index >= 0, `not a form this row ships: ${JSON.stringify(label)}`)
  return STRUCTURE_NAMES[index]
}

/** The pairing re-derived from the rendered cards alone: leftId → rightId. */
function oraclePairing(visual) {
  const rightByForm = new Map()
  for (const card of visual.right) {
    const form = canonical(card.label, EXPRESSION_FORMS, 'an expression card')
    assert.equal(rightByForm.has(form), false, `two expression cards mean the same thing: ${card.label}`)
    rightByForm.set(form, card.id)
  }
  const pairing = new Map()
  for (const card of visual.left) {
    const form = canonical(card.label, DESCRIPTION_FORMS, 'a description card')
    const rightId = rightByForm.get(form)
    assert.ok(rightId !== undefined, `nothing on the board matches ${JSON.stringify(card.label)}`)
    pairing.set(card.id, rightId)
  }
  assert.equal(new Set(pairing.values()).size, visual.left.length, 'two descriptions claimed the same expression')
  return pairing
}

const numeralsOf = (text) => (text.match(/\d+/g) ?? []).join(',')
const answerMap = (answer) => new Map(answer.pairs.map((couple) => [couple.left, couple.right]))
const share = (count) => count / SWEEP.length

// ------------------------------------------------------------------ registration
test('the template is registered as a `match` problem on an in-grade skill', () => {
  assert.equal(templates.length, 1)
  const [template] = templates
  assert.equal(template.id, ID)
  assert.equal(template.skill, SKILL)
  assert.equal(template.widget, 'match')

  const listed = listProblems().find((problem) => problem.id === ID)
  assert.ok(listed, 'listProblems() does not know about the match template')
  assert.equal(listed.widget, 'match')
  assert.equal(listed.grade, 5)
  assert.equal(listed.subject, 'math')
  assert.ok(getProblem(ID), 'getProblem() does not know about the match template')
})

// ------------------------------------------------------------------ the board
test('every board is four descriptions, four expressions, and nothing else', () => {
  for (const seed of SEEDS) {
    const rendered = render(getProblem(ID), seed)
    assert.equal(rendered.widget, 'match')
    assert.equal(rendered.visual.kind, 'match')

    for (const [side, cards] of [['left', rendered.visual.left], ['right', rendered.visual.right]]) {
      assert.equal(cards.length, COUNT, `${side} at seed ${seed}`)
      assert.equal(new Set(cards.map((card) => card.id)).size, COUNT, `${side} ids at seed ${seed}`)
      assert.equal(new Set(cards.map((card) => card.label)).size, COUNT, `${side} labels at seed ${seed}`)
      for (const card of cards) {
        assert.equal(typeof card.id, 'string')
        assert.ok(card.id.length > 0)
        assert.equal(typeof card.label, 'string')
        assert.ok(card.label.trim().length > 0, `${side} card with a blank label at seed ${seed}`)
        assert.deepEqual(Object.keys(card).sort(), ['id', 'label'], `${side} card carries extra fields`)
      }
    }
    const leftIds = new Set(rendered.visual.left.map((card) => card.id))
    for (const card of rendered.visual.right) {
      assert.equal(leftIds.has(card.id), false, 'the two columns must use separate ids')
    }
  }
})

test('the numerals are the same on every expression card, so the digits give nothing away', () => {
  for (const seed of SWEEP) {
    const { visual } = render(getProblem(ID), seed)
    const numerals = visual.right.map((card) => numeralsOf(card.label))
    assert.equal(new Set(numerals).size, 1, `seed ${seed}: expression cards differ in their numerals — ${numerals.join(' / ')}`)

    const [a, b, c] = numerals[0].split(',').map(Number)
    assert.equal(new Set([a, b, c]).size, 3, `seed ${seed}: the three numbers must be distinct`)
    for (const value of [a, b, c]) assert.ok(value >= 2 && value <= 9, `seed ${seed}: ${value} is out of range`)
    assert.ok(b > c, `seed ${seed}: b must exceed c so no difference is negative (${b} vs ${c})`)

    // Every description card is built from the same three numbers, in some order.
    for (const card of visual.left) {
      const used = (card.label.match(/\d+/g) ?? []).map(Number).sort((x, y) => x - y)
      assert.deepEqual(used, [a, b, c].sort((x, y) => x - y), `seed ${seed}: ${card.label}`)
    }
  }
})

test('the answer is the pairing an independent reader derives from the cards', () => {
  for (const seed of SWEEP) {
    const rendered = render(getProblem(ID), seed)
    const expected = oraclePairing(rendered.visual)
    const actual = answerMap(rendered.answer)
    assert.equal(actual.size, COUNT, `seed ${seed}: the answer must join every card`)
    assert.deepEqual([...actual.entries()].sort(), [...expected.entries()].sort(), `seed ${seed}`)
  }
})

test('the shipped checker agrees, three ways, on every board', () => {
  for (const seed of SWEEP) {
    const rendered = render(getProblem(ID), seed)
    const pairing = oraclePairing(rendered.visual)
    const couples = [...pairing.entries()].map(([left, right]) => ({ left, right }))

    assert.deepEqual(check('match', rendered.answer, { pairs: couples }), { correct: true, reason: null }, `seed ${seed}`)

    // Rotate every right card one place along: a finished board, and not one couple right.
    const rotated = couples.map((couple, index) => ({
      left: couple.left,
      right: couples[(index + 1) % couples.length].right,
    }))
    assert.deepEqual(check('match', rendered.answer, { pairs: rotated }), { correct: false, reason: 'wrong' }, `seed ${seed}`)

    // One card still in the tray.
    assert.deepEqual(check('match', rendered.answer, { pairs: couples.slice(1) }), { correct: false, reason: 'invalid' }, `seed ${seed}`)
    assert.deepEqual(check('match', rendered.answer, { pairs: [] }), { correct: false, reason: 'invalid' }, `seed ${seed}`)
  }
})

// ------------------------------------------------------------------ arrangement
test('no display position, on either side, tells a child which card its partner is', () => {
  const cell = Array.from({ length: COUNT }, () => Array.from({ length: COUNT }, () => 0))
  for (const seed of SWEEP) {
    const { visual, answer } = render(getProblem(ID), seed)
    const pairing = answerMap(answer)
    visual.left.forEach((card, leftIndex) => {
      const rightIndex = visual.right.findIndex((entry) => entry.id === pairing.get(card.id))
      assert.ok(rightIndex >= 0, `seed ${seed}: the answer names a card that is not on the board`)
      cell[leftIndex][rightIndex]++
    })
  }
  for (let leftIndex = 0; leftIndex < COUNT; leftIndex++) {
    for (let rightIndex = 0; rightIndex < COUNT; rightIndex++) {
      const observed = share(cell[leftIndex][rightIndex])
      assert.ok(
        observed > 0.08 && observed < 0.45,
        `left position ${leftIndex} pairs with right position ${rightIndex} ${Math.round(observed * 100)}% of the time (want 8–45%, chance is 25%)`,
      )
    }
  }
})

test('the pairing is not one memorised permutation repeated', () => {
  const permutations = new Set()
  for (const seed of SWEEP) {
    const { visual, answer } = render(getProblem(ID), seed)
    const pairing = answerMap(answer)
    permutations.add(
      visual.left
        .map((card) => visual.right.findIndex((entry) => entry.id === pairing.get(card.id)))
        .join(''),
    )
  }
  assert.ok(permutations.size >= 12, `only ${permutations.size} distinct pairings over ${SWEEP.length} seeds`)
})

test('the ids do not spell out the pairing either', () => {
  let sameSuffix = 0
  let couples = 0
  for (const seed of SWEEP) {
    const { answer } = render(getProblem(ID), seed)
    for (const couple of answer.pairs) {
      couples++
      const left = /(\d+)$/.exec(couple.left)
      const right = /(\d+)$/.exec(couple.right)
      if (left !== null && right !== null && left[1] === right[1]) sameSuffix++
    }
  }
  const observed = sameSuffix / couples
  assert.ok(
    observed < 0.45,
    `the two ids end in the same number ${Math.round(observed * 100)}% of the time — the pairing is readable off the ids`,
  )
})

test('the board itself moves: the numbers, the four structures and the wording all vary', () => {
  const boards = new Set()
  const triples = new Set()
  const formSets = new Set()
  const formCounts = new Map()
  for (const seed of SWEEP) {
    const { visual } = render(getProblem(ID), seed)
    boards.add([...visual.left, ...visual.right].map((card) => card.label).join('|'))
    triples.add(numeralsOf(visual.right[0].label))
    const shapes = visual.right.map((card) => structureOf(card.label)).sort()
    assert.equal(new Set(shapes).size, COUNT, `seed ${seed}: a structure appears twice on one board`)
    formSets.add(shapes.join('|'))
    for (const shape of shapes) formCounts.set(shape, (formCounts.get(shape) ?? 0) + 1)
  }
  assert.ok(boards.size >= 380, `only ${boards.size} distinct boards over ${SWEEP.length} seeds`)
  assert.ok(triples.size >= 60, `only ${triples.size} distinct number triples over ${SWEEP.length} seeds`)
  assert.ok(formSets.size >= 4, `only ${formSets.size} distinct sets of four structures (five are defined)`)
  assert.equal(formCounts.size, 5, `${formCounts.size} structures ever appear; the row ships five`)
  for (const [shape, count] of formCounts) {
    assert.ok(share(count) > 0.3, `${shape} appears on only ${Math.round(share(count) * 100)}% of boards`)
  }
})

// ------------------------------------------------------------------ the envelope
test('the prompt asks the question without answering any of it', () => {
  for (const seed of SEEDS) {
    const rendered = render(getProblem(ID), seed)
    assert.equal(typeof rendered.prompt, 'string')
    assert.ok(rendered.prompt.trim().length > 0)
    assert.equal(/\d/.test(rendered.prompt), false, `the prompt must not contain a numeral: ${rendered.prompt}`)
    for (const card of [...rendered.visual.left, ...rendered.visual.right]) {
      assert.equal(rendered.prompt.includes(card.label), false, `the prompt repeats a card: ${card.label}`)
    }
  }
})

test('nothing the client receives contains the pairing', () => {
  for (const seed of SEEDS) {
    const rendered = render(getProblem(ID), seed)
    const instance = toInstance(rendered)
    assert.equal(Object.hasOwn(instance, 'answer'), false)
    assert.equal(Object.hasOwn(instance, 'explanation'), false)
    assert.equal(Object.hasOwn(instance, 'hints'), false)
    assert.deepEqual(Object.keys(instance.visual).sort(), ['kind', 'left', 'right'])

    const envelope = JSON.stringify(instance)
    assert.equal(envelope.includes('pairs'), false, 'the envelope mentions the answer key')
    for (const couple of rendered.answer.pairs) {
      for (const separator of ['', ' ', ',', ', ', ':', '->', '"']) {
        assert.equal(
          envelope.includes(`${couple.left}${separator}${couple.right}`),
          false,
          `seed ${seed}: ${couple.left}${separator}${couple.right} is in the envelope`,
        )
      }
    }
  }
})

/**
 * The explanation is what a child reads AFTER getting it wrong, so "it mentions all eight
 * labels" is not enough: printing the two columns back in display order mentions all eight
 * and teaches nothing, because the reader still has to work out the pairing that they just
 * failed to work out. The test below is therefore positional — for each description, the
 * FIRST expression named after it must be its partner, and within a connector's distance,
 * so the text has to state the couples rather than list two columns.
 */
test('the explanation says which description goes with which expression', () => {
  for (const seed of SEEDS) {
    const rendered = render(getProblem(ID), seed)
    const pairing = answerMap(rendered.answer)
    const text = rendered.explanation
    assert.equal(typeof text, 'string')

    for (const card of rendered.visual.left) {
      const at = text.indexOf(card.label)
      assert.ok(at >= 0, `seed ${seed}: the explanation skips ${JSON.stringify(card.label)}`)
      assert.equal(text.indexOf(card.label, at + 1), -1, `seed ${seed}: ${JSON.stringify(card.label)} is stated twice`)

      const following = rendered.visual.right
        .map((entry) => ({ id: entry.id, label: entry.label, at: text.indexOf(entry.label, at + card.label.length) }))
        .filter((entry) => entry.at >= 0)
        .sort((x, y) => x.at - y.at)
      assert.ok(following.length > 0, `seed ${seed}: no expression follows ${JSON.stringify(card.label)}`)
      assert.equal(
        following[0].id,
        pairing.get(card.id),
        `seed ${seed}: the explanation puts ${JSON.stringify(following[0].label)} after ${JSON.stringify(card.label)}, which is not its partner`,
      )
      assert.ok(
        following[0].at - (at + card.label.length) <= 20,
        `seed ${seed}: ${JSON.stringify(card.label)} and its expression are ${following[0].at - (at + card.label.length)} characters apart — state the couple, do not print two columns`,
      )
    }
    for (const card of rendered.visual.right) {
      assert.ok(text.includes(card.label), `seed ${seed}: the explanation skips ${JSON.stringify(card.label)}`)
    }
  }
})

test('the hints teach the method without handing over a couple', () => {
  for (const seed of SEEDS) {
    const rendered = render(getProblem(ID), seed)
    assert.ok(rendered.hints.length >= 2, 'a Band A row ships at least two hints')
    for (const text of rendered.hints) {
      assert.equal(typeof text, 'string')
      assert.ok(text.trim().length > 0)
      for (const card of rendered.visual.right) {
        assert.equal(text.includes(card.label), false, `seed ${seed}: a hint hands over ${card.label}`)
      }
    }
  }
})

test('the same seed always renders the same board', () => {
  for (const seed of SEEDS) {
    assert.deepEqual(render(getProblem(ID), seed), render(getProblem(ID), seed))
  }
})
