/**
 * P1.5 spec — the reviewed item bank behind `e5.l.context-clues`.
 *
 * HOMEWORK_PLAN.md §10 Phase 1: "One English skill: `e5.l.context-clues` (cloze) with 20
 * reviewed items". §6.2: "Static (English) templates pick from a reviewed item bank with
 * `rng.pick(items)`; each item carries `reviewedBy` and `source: 'original' |
 * 'public-domain:<title>'`." §6.8: "every shipped English item has `reviewedBy`. A test fails
 * the build otherwise."
 *
 * ── On the word "reviewed" ────────────────────────────────────────────────────────────────
 * §3 says content is "drafted with Nora offline, reviewed by a parent, and committed", and
 * §6.8 says English text is "original text (Nora-drafted, parent-reviewed)". The reviewer is a
 * human. These twenty items were drafted by an agent and no parent has read them yet, so
 * `reviewedBy` records exactly that and nothing more:
 *
 *     reviewedBy: 'agent-draft:pending-parent-review'
 *
 * This spec pins that literal on every item. It is deliberately not a person's name: writing a
 * name here would make the field lie, and the field exists precisely so that nothing unread
 * reaches a kid. When a parent reads the bank, that value changes to their name in a later PR,
 * and HOMEWORK_PROGRESS.md's P1.5 box stays unticked until then.
 *
 * ── What a test can and cannot judge ──────────────────────────────────────────────────────
 * No assertion here can tell whether a sentence really pins its answer down to one word —
 * that is a human reading. What it *can* do is force each item to name the evidence it relies
 * on, in `clue`, and prove that evidence is really in the sentence. An item whose author
 * cannot point at the clue is not a context-clues item.
 *
 * The leak rules below matter beyond tidiness: §10 Phase 1's acceptance is that "the answer
 * never appears in the network payload before solving". The item `id` travels to the browser
 * inside the problem id (§6.2, `<skill-id>/<template-slug>`), so an id that is the answer word
 * would hand the answer over before the kid has typed anything.
 *
 * ASSUMED — this spec's choices, not the plan's:
 *  1. The bank lives under `src/content/`, which §6.1 reserves for reviewed English content,
 *     in an `items/` sibling of the `passages/` folder §6.1 names. §6.1 puts the *template*
 *     in `problems/english/g05/`, and templates "pick from a reviewed item bank" — the bank
 *     itself has no home in §6.1, so it gets one next to the other reviewed content.
 *  2. The blank is written `____` (exactly four underscores) and there is one per sentence.
 *  3. Four choices per item, and the 12–35 word band on the sentence. §6.8's readability rule
 *     and its 250–450 word target are written for *passages*; a one-sentence cloze prompt is
 *     not a passage, so no Flesch–Kincaid bound is asserted here. The word band is a floor on
 *     "enough context to infer from" and a ceiling on "still one readable sentence".
 *  4. Export name `items`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { items } from './context-clues.js'

const ITEM_KEYS = [
  'answer',
  'choices',
  'clue',
  'difficulty',
  'explanation',
  'hints',
  'id',
  'reviewedBy',
  'sentence',
  'source',
]

const BLANK = '____'
const REVIEWED_BY = 'agent-draft:pending-parent-review'

const words = (sentence) => sentence.split(/\s+/).filter(Boolean)
const strings = (item) => [item.id, item.sentence, item.answer, item.clue, item.explanation, ...item.choices, ...item.hints]

test('the bank holds exactly twenty items', () => {
  assert.ok(Array.isArray(items), 'items is not an array')
  assert.equal(items.length, 20, 'plan §10 Phase 1 asks for 20 items')
})

test('every item carries exactly the ten keys this bank defines', () => {
  for (const item of items) {
    assert.deepEqual(Object.keys(item).sort(), ITEM_KEYS, `${item.id} has the wrong keys`)
  }
})

test('ids are unique kebab-case slugs and answers are twenty different words', () => {
  const ids = items.map((item) => item.id)
  const answers = items.map((item) => item.answer)
  assert.equal(new Set(ids).size, 20, 'two items share an id')
  assert.equal(new Set(answers).size, 20, 'two items teach the same word')
  for (const item of items) {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${item.id} is not a kebab-case slug`)
    assert.match(item.answer, /^[a-z]+(?:-[a-z]+)?$/, `${item.answer} is not a single lower-case word`)
    assert.ok(item.answer.length >= 4, `${item.answer} is too short to be a Grade 5 target word`)
  }
})

test('an item id never gives the answer away, because it reaches the browser', () => {
  for (const { id, answer } of items) {
    assert.ok(!id.includes(answer), `id ${id} contains its own answer`)
    assert.ok(!answer.includes(id), `answer ${answer} contains its id ${id}`)
  }
})

test('every difficulty from 1 to 3 is stocked', () => {
  for (const item of items) {
    assert.ok([1, 2, 3].includes(item.difficulty), `${item.id} has difficulty ${item.difficulty}`)
  }
  for (const level of [1, 2, 3]) {
    const count = items.filter((item) => item.difficulty === level).length
    assert.ok(count >= 5, `difficulty ${level} has only ${count} items; a template needs a real choice`)
  }
})

test('every sentence has exactly one blank and reads as one sentence', () => {
  const seen = new Set()
  for (const item of items) {
    const occurrences = item.sentence.split(BLANK).length - 1
    assert.equal(occurrences, 1, `${item.id} has ${occurrences} blanks`)
    assert.doesNotMatch(item.sentence, /_____/, `${item.id} has a blank longer than ${BLANK}`)
    assert.match(item.sentence, /[.!?]$/, `${item.id} does not end in sentence punctuation`)
    const length = words(item.sentence).length
    assert.ok(length >= 12 && length <= 35, `${item.id} is ${length} words; the band is 12–35`)
    assert.ok(!seen.has(item.sentence), `${item.id} repeats another item's sentence`)
    seen.add(item.sentence)
  }
})

test('every item offers four distinct single-word choices, one of them the answer', () => {
  for (const item of items) {
    assert.equal(item.choices.length, 4, `${item.id} has ${item.choices.length} choices`)
    assert.equal(new Set(item.choices).size, 4, `${item.id} repeats a choice`)
    for (const choice of item.choices) {
      assert.match(choice, /^[a-z]+(?:-[a-z]+)?$/, `${item.id}: choice "${choice}" is not a single lower-case word`)
    }
    assert.ok(item.choices.includes(item.answer), `${item.id}: the answer is not among its choices`)
  }
})

test('the answer never appears in the sentence, the hints or a distractor', () => {
  for (const item of items) {
    const sentence = item.sentence.toLowerCase()
    assert.ok(!sentence.includes(item.answer), `${item.id}: the sentence already says "${item.answer}"`)
    for (const hint of item.hints) {
      assert.ok(!hint.toLowerCase().includes(item.answer), `${item.id}: a hint gives "${item.answer}" away`)
    }
    for (const choice of item.choices) {
      if (choice === item.answer) continue
      assert.ok(!sentence.includes(choice), `${item.id}: the sentence already says the distractor "${choice}"`)
    }
  }
})

test('every item points at the evidence in its own sentence', () => {
  for (const item of items) {
    assert.ok(item.clue.trim().length > 0, `${item.id} has an empty clue`)
    assert.ok(!item.clue.includes(BLANK), `${item.id}: the clue is the blank itself`)
    assert.ok(item.sentence.includes(item.clue), `${item.id}: the clue "${item.clue}" is not in the sentence`)
    assert.ok(
      words(item.clue).length >= 3,
      `${item.id}: a ${words(item.clue).length}-word clue is too thin to infer from`,
    )
    assert.ok(
      words(item.clue).length < words(item.sentence).length - 2,
      `${item.id}: the clue is the whole sentence, so it points at nothing`,
    )
  }
})

test('every item has at least two hints, one of which quotes the clue', () => {
  for (const item of items) {
    assert.ok(item.hints.length >= 2, `${item.id} has ${item.hints.length} hints; plan §9 wants at least 2`)
    assert.ok(
      item.hints.some((hint) => hint.includes(item.clue)),
      `${item.id}: no hint quotes the clue "${item.clue}"`,
    )
  }
})

test('every explanation names the answer and says more than the answer', () => {
  for (const item of items) {
    assert.ok(
      item.explanation.toLowerCase().includes(item.answer),
      `${item.id}: the explanation never says "${item.answer}"`,
    )
    assert.ok(item.explanation.length >= 40, `${item.id}: the explanation is a fragment`)
    assert.match(item.explanation, /[.!?]$/, `${item.id}: the explanation does not end in punctuation`)
  }
})

test('every item is marked with its true review status, and no human is credited', () => {
  for (const item of items) {
    assert.equal(
      item.reviewedBy,
      REVIEWED_BY,
      `${item.id}: reviewedBy must state the real status; no parent has read this bank yet`,
    )
  }
})

test('every item is original text, so nothing copyrighted ships', () => {
  for (const item of items) {
    assert.equal(item.source, 'original', `${item.id} is not original text`)
  }
})

test('no string is empty, padded, doubly spaced or a stringified accident', () => {
  for (const item of items) {
    for (const value of strings(item)) {
      assert.equal(typeof value, 'string', `${item.id} holds a non-string`)
      assert.ok(value.length > 0, `${item.id} holds an empty string`)
      assert.equal(value, value.trim(), `${item.id}: "${value}" has padding`)
      assert.ok(!value.includes('  '), `${item.id}: "${value}" has a double space`)
      for (const accident of ['undefined', 'NaN', '[object Object]', '™', '®']) {
        assert.ok(!value.includes(accident), `${item.id}: "${value}" contains ${accident}`)
      }
    }
  }
})

test('no item reaches for an unsafe context', () => {
  const unsafe = /\b(?:kill|killed|killing|gun|guns|blood|bloody|war|dead|death|hate|hated|stupid|dumb|idiot|weapon|weapons|drunk|drug|drugs)\b/i
  for (const item of items) {
    for (const value of strings(item)) {
      assert.doesNotMatch(value, unsafe, `${item.id}: "${value}" is not kid-safe (§6.8)`)
    }
  }
})
