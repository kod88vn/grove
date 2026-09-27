/**
 * P1.5 follow-up spec — an item may not contradict its own answer.
 *
 * Found by reading all twenty items in review: `storage-room` keyed `enormous` while its
 * sentence said "one tall shelf filled most of the space, leaving only a narrow path to the
 * door". That evidence supports the distractor `cramped`, so the item had two defensible
 * answers and the keyed one was the weaker. A kid who reasons correctly is marked wrong,
 * which is worse than no item at all.
 *
 * WHAT THIS CAN AND CANNOT DO. It cannot prove an item has exactly one answer — that needs a
 * person to read the sentence, and HOMEWORK_PLAN.md §6.8 is right to require one. What it can
 * do is catch the specific, mechanical half of the failure: the item's own sentence carrying a
 * word from the opposite end of the scale the answer sits on. The lexicon below is a spot
 * check, deliberately small, and growing it is the way to record future review findings so
 * they cannot come back.
 *
 * Grow it by adding a pair, never by exempting an item.
 *
 * Scope, and why it stops at the sentence. The hints and the explanation are allowed to name
 * the opposite word, because contrasting with it is how you explain a word to a ten-year-old
 * ("giving credit to others instead of bragging"). The sentence is different: a word there is
 * evidence the child is asked to reason from, so the opposite end of the scale has no business
 * in it. That also costs the item bank one legitimate clue type — the contrast clue that leans
 * on an antonym. That is a fair price, and the sibling spec already keeps distractors out of
 * the sentence for the same reason.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { items } from './context-clues.js'

/**
 * Opposed ends of one scale. If an item's answer sits at one end, its sentence must not
 * offer a word from the other end — that word is evidence against the answer.
 */
const SCALES = [
  { scale: 'size', a: ['enormous', 'huge', 'immense', 'vast', 'massive', 'spacious'], b: ['cramped', 'tiny', 'narrow', 'small', 'snug', 'tight', 'compact'] },
  { scale: 'amount', a: ['plentiful', 'abundant', 'ample'], b: ['scarce', 'sparse', 'meagre', 'meager'] },
  { scale: 'brightness', a: ['vivid', 'brilliant', 'radiant', 'luminous'], b: ['dull', 'faded', 'drab', 'murky'] },
  { scale: 'strength', a: ['sturdy', 'strong', 'solid', 'durable'], b: ['flimsy', 'fragile', 'feeble', 'brittle'] },
  { scale: 'care', a: ['cautious', 'careful', 'wary', 'meticulous'], b: ['careless', 'reckless', 'hasty', 'sloppy'] },
  { scale: 'willingness', a: ['eager', 'willing', 'keen'], b: ['reluctant', 'unwilling', 'hesitant'] },
  { scale: 'luck', a: ['fortunate', 'lucky'], b: ['unlucky', 'unfortunate'] },
  { scale: 'rigidity', a: ['flexible', 'pliable', 'bendable'], b: ['rigid', 'stiff', 'inflexible'] },
  { scale: 'complexity', a: ['elaborate', 'intricate', 'complicated', 'ornate'], b: ['simple', 'plain', 'bare'] },
  { scale: 'precision', a: ['precise', 'accurate', 'exact'], b: ['vague', 'approximate', 'imprecise'] },
  { scale: 'humility', a: ['modest', 'humble'], b: ['boastful', 'arrogant', 'bragging'] },
  { scale: 'certainty', a: ['certain', 'confident', 'convinced'], b: ['skeptical', 'sceptical', 'doubtful', 'unsure'] },
  { scale: 'necessity', a: ['essential', 'necessary', 'vital', 'crucial'], b: ['optional', 'unnecessary', 'needless'] },
]

/** The sentence with the blank taken out, so the blank itself never matches. */
const context = (sentence) => sentence.replace(/_+/g, ' ')

const mentions = (text, word) => new RegExp(`\\b${word}\\w*\\b`, 'i').test(text)

test('no item offers evidence for the end of the scale opposite its answer', () => {
  for (const item of items) {
    for (const { scale, a, b } of SCALES) {
      for (const [near, far] of [
        [a, b],
        [b, a],
      ]) {
        if (!near.includes(item.answer)) continue
        const contradiction = far.find((word) => mentions(context(item.sentence), word))
        assert.equal(
          contradiction,
          undefined,
          `${item.id}: the answer '${item.answer}' is at one end of the ${scale} scale, but its ` +
            `sentence says '${contradiction}' — that is evidence for a different answer. ` +
            `Sentence: ${item.sentence}`,
        )
      }
    }
  }
})
