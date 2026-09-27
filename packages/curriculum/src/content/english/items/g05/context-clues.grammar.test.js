/**
 * P1.5 review follow-up — the blank's grammatical slot must fit the keyed answer.
 *
 * PR #81 review thread on `content/english/items/g05/context-clues.js:35`. The item
 * `painted-wall` reads "Mia moved ____ near wet paint" and keys `cautious`. "Mia moved
 * cautious" is not English; the slot after an action verb wants `cautiously`, which is not
 * among the four choices. Every choice is an adjective, so there is no right answer to pick
 * and the child is marked against an ungrammatical sentence.
 *
 * Reading the other nineteen items for the same class turned up a second instance, of the
 * mirror-image kind. `beaded-costume` reads "had an ____ design": the article `an` is fixed
 * in the sentence, and of the four choices only `elaborate` begins with a vowel. A child who
 * knows nothing about context clues can score it from the article alone, and the three
 * distractors are not distractors at all. Measured before this spec was written:
 *
 *     beaded-costume  ARTICLE-LEAK "an ____" rules out: simple, sudden, narrow
 *
 * Both are the same defect: the sentence's grammar and the answer key disagree about what
 * kind of word goes in the hole. In one the answer does not fit the slot, in the other only
 * the answer fits it. A context-clues item is supposed to be decided by meaning, so grammar
 * must neither rule the answer out nor rule the distractors out.
 *
 * ── The rules ─────────────────────────────────────────────────────────────────────────────
 *  1. Every word offered as a choice is classified below. A new word must be classified
 *     deliberately, not inferred.
 *  2. All four choices share the answer's part of speech, so no choice can be eliminated
 *     without reading for meaning.
 *  3. An adjective answer sits in a slot that licenses an adjective: after a linking verb
 *     ("the bridge was ____"), after a determiner ("the ____ branch"), or after a degree
 *     word ("a very ____ design"). This is what `painted-wall` fails — `moved` is none of
 *     those.
 *  4. A base-form verb answer never directly follows a determiner or a linking verb.
 *  5. A noun answer never directly follows `to` or a modal.
 *  6. When the word immediately before the blank is `a` or `an`, every choice agrees with it.
 *
 * ── Limits, stated plainly ────────────────────────────────────────────────────────────────
 * This is a structural test, not a grammar checker, and it should not be mistaken for one:
 *
 *  - The lexicon is a hand-written table. It carries one part of speech per word, which is
 *    enough only because no word in this bank is used under two (checked: none is). A future
 *    item keying `polish` as a noun would need the table reshaped, not extended.
 *  - Rules 3–5 read exactly one token, the one before the blank, against closed lists. They
 *    catch the two defects above and the obvious shapes of them. They cannot see agreement,
 *    tense, or a wrong preposition further along the sentence ("grateful of" would pass).
 *  - Rules 4 and 5 are negative for that reason: there is no closed list of things that may
 *    precede a verb or a noun, so they forbid what is clearly wrong rather than requiring
 *    what is known to be right. Rule 3 can be positive because adjective slots are few.
 *  - Rule 6 tests the first letter, not the sound, so it would wave through "a hour". No
 *    word in this bank begins with a silent h or a consonantal u.
 *  - Nothing here can tell whether the sentence actually pins the answer to one word. That
 *    is the parent read that `reviewedBy` is still waiting for.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { items } from './context-clues.js'

const BLANK = '____'

/** Every word used as a choice in this bank, with the part of speech it is used as. */
const ADJECTIVES = [
  'ancient', 'boastful', 'careless', 'cautious', 'certain', 'cheerful', 'colorful', 'cramped',
  'curious', 'decorative', 'delicate', 'distant', 'dull', 'dusty', 'eager', 'elaborate',
  'enormous', 'essential', 'flexible', 'flimsy', 'fortunate', 'grateful', 'hurried', 'modest',
  'narrow', 'noisy', 'optional', 'ordinary', 'plentiful', 'precise', 'prepared', 'puzzled',
  'ready', 'reluctant', 'rigid', 'scarce', 'shallow', 'simple', 'skeptical', 'sleepy',
  'sturdy', 'sudden', 'unlucky', 'vivid',
]
const VERBS = [
  'absorb', 'avoid', 'collect', 'decorate', 'discover', 'forget', 'ignore', 'imitate',
  'invent', 'invite', 'measure', 'observe', 'polish', 'predict', 'release', 'remain',
  'remember', 'repair', 'scatter', 'soften', 'transform', 'wander', 'whisper', 'withstand',
]
const NOUNS = ['celebration', 'dilemma', 'promise', 'shortcut']

const PART_OF_SPEECH = new Map([
  ...ADJECTIVES.map((word) => [word, 'adjective']),
  ...VERBS.map((word) => [word, 'verb']),
  ...NOUNS.map((word) => [word, 'noun']),
])

/** Slots an adjective may sit in. */
const LINKING_VERBS = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'become', 'becomes', 'became',
  'seem', 'seems', 'seemed', 'remain', 'remains', 'remained', 'feel', 'feels', 'felt',
  'look', 'looks', 'looked', 'grow', 'grows', 'grew', 'stay', 'stays', 'stayed',
  'sound', 'sounds', 'sounded', 'appear', 'appears', 'appeared', 'smell', 'smells', 'smelled',
  'taste', 'tastes', 'tasted', 'turn', 'turns', 'turned',
])
const DETERMINERS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'its', 'her', 'his', 'their',
  'our', 'my', 'your', 'one', 'each', 'every', 'another',
])
const DEGREE_WORDS = new Set([
  'very', 'so', 'too', 'quite', 'rather', 'really', 'more', 'most', 'less', 'least',
  'fairly', 'extremely', 'unusually', 'especially',
])
const MODALS = new Set(['can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must'])

const bare = (token) => token.replace(/[^A-Za-z'-]/g, '').toLowerCase()

/** The word immediately before the blank, stripped of punctuation; '' if the blank leads. */
const wordBefore = (item) => {
  const tokens = item.sentence.split(/\s+/).filter(Boolean)
  const index = tokens.findIndex((token) => token.includes(BLANK))
  return index > 0 ? bare(tokens[index - 1]) : ''
}

const partOfSpeech = (word) => PART_OF_SPEECH.get(word)
const answersOfKind = (kind) => items.filter((item) => partOfSpeech(item.answer) === kind)

test('every word offered as a choice is classified', () => {
  for (const item of items) {
    for (const choice of item.choices) {
      assert.ok(
        PART_OF_SPEECH.has(choice),
        `${item.id}: "${choice}" is not in this spec's lexicon; classify it before using it`,
      )
    }
  }
})

test('all four choices share the answer’s part of speech', () => {
  for (const item of items) {
    const kind = partOfSpeech(item.answer)
    for (const choice of item.choices) {
      assert.equal(
        partOfSpeech(choice),
        kind,
        `${item.id}: "${choice}" is a ${partOfSpeech(choice)} among ${kind} choices, so grammar alone rules it out`,
      )
    }
  }
})

test('an adjective answer sits in a slot that licenses an adjective', () => {
  const adjectives = answersOfKind('adjective')
  assert.ok(adjectives.length > 0, 'no adjective items; the lexicon or the bank is wrong')
  for (const item of adjectives) {
    const before = wordBefore(item)
    assert.ok(
      LINKING_VERBS.has(before) || DETERMINERS.has(before) || DEGREE_WORDS.has(before),
      `${item.id}: "${before} ____" does not license the adjective "${item.answer}"; use a linking verb, a determiner or a degree word before the blank`,
    )
  }
})

test('a verb answer never follows a determiner or a linking verb', () => {
  const verbs = answersOfKind('verb')
  assert.ok(verbs.length > 0, 'no verb items; the lexicon or the bank is wrong')
  for (const item of verbs) {
    const before = wordBefore(item)
    assert.ok(!DETERMINERS.has(before), `${item.id}: "${before} ____" puts a determiner before the verb "${item.answer}"`)
    assert.ok(!LINKING_VERBS.has(before), `${item.id}: "${before} ____" puts a linking verb before the verb "${item.answer}"`)
  }
})

test('a noun answer never follows `to` or a modal', () => {
  const nouns = answersOfKind('noun')
  assert.ok(nouns.length > 0, 'no noun items; the lexicon or the bank is wrong')
  for (const item of nouns) {
    const before = wordBefore(item)
    assert.ok(before !== 'to', `${item.id}: "to ____" reads as a verb slot, but "${item.answer}" is a noun`)
    assert.ok(!MODALS.has(before), `${item.id}: "${before} ____" reads as a verb slot, but "${item.answer}" is a noun`)
  }
})

test('an article before the blank does not rule the distractors out', () => {
  for (const item of items) {
    const before = wordBefore(item)
    if (before !== 'a' && before !== 'an') continue
    for (const choice of item.choices) {
      const vowel = /^[aeiou]/.test(choice)
      assert.equal(
        vowel,
        before === 'an',
        `${item.id}: "${before} ____" fits "${item.answer}" but not "${choice}", so the article gives the answer away`,
      )
    }
  }
})
