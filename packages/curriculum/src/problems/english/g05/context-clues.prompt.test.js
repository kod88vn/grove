/**
 * P1.5 follow-up spec — the prompt must not do the child's work for them.
 *
 * Found in review: the first version of these templates rendered
 * "Choose the word that matches this clue: <the item's clue>." Handing over the clue is the
 * whole exercise. HOMEWORK_PLAN.md §8 puts this skill in the L strand as using context as a
 * clue to a word's meaning, so locating the clue inside the sentence is the thing being
 * assessed, and a prompt that points straight at it assesses nothing.
 *
 * The clue belongs in the hints, where a child reaches it only after asking, and in the
 * explanation, where it is the reveal. The sibling spec already requires a hint to quote it
 * verbatim, so nothing is lost by keeping it out of the prompt.
 *
 * Expressed as two properties a machine can hold down: the prompt is the same instruction for
 * every problem a template renders, and it never quotes the item.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { templates } from './context-clues.js'
import { items } from '../../../content/english/items/g05/context-clues.js'
import { render } from '../../../engine/render.js'

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 104729 + 29)

test('a template asks the same question however the item varies', () => {
  for (const template of templates) {
    const prompts = new Set(SEEDS.map((seed) => render(template, seed).prompt))
    assert.equal(
      prompts.size,
      1,
      `${template.id} renders ${prompts.size} different prompts, so the prompt is carrying item text: ${[...prompts].slice(0, 3).join(' | ')}`,
    )
  }
})

test('the prompt never quotes the clue, the sentence or the choices', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const item = items.find((candidate) => candidate.sentence === problem.visual.sentence)
      assert.ok(
        !problem.prompt.includes(item.clue),
        `${template.id}: the prompt gives away the clue for ${item.id}`,
      )
      assert.ok(
        !problem.prompt.includes(item.sentence),
        `${template.id}: the prompt repeats the sentence for ${item.id}`,
      )
      for (const choice of item.choices) {
        assert.doesNotMatch(
          problem.prompt,
          new RegExp(`\\b${choice}\\b`, 'i'),
          `${template.id}: the prompt names the choice '${choice}'`,
        )
      }
    }
  }
})

test('the prompt still tells the child what to do', () => {
  for (const template of templates) {
    const { prompt } = render(template, 91)
    assert.ok(prompt.trim().length >= 20, `${template.id}: prompt is too short to be an instruction`)
    assert.match(prompt, /[.!?]$/, `${template.id}: prompt does not end in punctuation`)
  }
})
