/**
 * P1.5 spec, part 4 of 4 — the three cloze templates that turn the reviewed item bank into
 * renderable problems.
 *
 * HOMEWORK_PLAN.md §9 DoD #2 asks for one template at each difficulty. §6.2 fixes the
 * template shape, ../../../engine/render.js validates it, and ../../../engine/check.js now
 * grades the 'cloze' widget.
 *
 * The rule this file exists to hold down is §10 Phase 1's: the answer never reaches the
 * browser before the child has answered. A cloze problem carries its own answer in the
 * choices, so "not leaked" here means the answer never appears in the prompt, the sentence,
 * the hints or the problem id — the four things a child can read without answering. The
 * explanation is exempt; it is the reveal.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { templates } from './context-clues.js'
import { items } from '../../../content/english/items/g05/context-clues.js'
import { render } from '../../../engine/render.js'
import { check } from '../../../engine/check.js'

const TEMPLATE_KEYS = ['difficulty', 'generate', 'id', 'skill', 'title', 'version', 'widget']
const SKILL = 'e5.l.context-clues'
const SEEDS = Array.from({ length: 500 }, (_, index) => index * 7919 + 13)

const rendered = (template) => SEEDS.map((seed) => render(template, seed))
const byDifficulty = (level) => items.filter((item) => item.difficulty === level)

test('there is exactly one template for each of the three difficulties', () => {
  assert.equal(templates.length, 3)
  assert.deepEqual(
    templates.map((template) => template.difficulty).sort(),
    [1, 2, 3],
  )
})

test('every template has exactly the seven keys of the template shape', () => {
  for (const template of templates) {
    assert.deepEqual(Object.keys(template).sort(), TEMPLATE_KEYS, `${template.id} key set`)
  }
})

test('every template is a version 1 cloze template of the context-clues skill', () => {
  const ids = new Set()
  for (const template of templates) {
    assert.equal(template.skill, SKILL)
    assert.equal(template.widget, 'cloze')
    assert.equal(template.version, 1)
    assert.match(template.id, /^e5\.l\.context-clues\/[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(!ids.has(template.id), `duplicate template id ${template.id}`)
    ids.add(template.id)
    assert.equal(typeof template.title, 'string')
    assert.ok(template.title.trim().length > 0, `${template.id} has an empty title`)
    assert.equal(template.title, template.title.trim())
    assert.equal(typeof template.generate, 'function')
  }
})

test('rendering is deterministic: the same seed always gives the same problem', () => {
  for (const template of templates) {
    for (const seed of SEEDS.slice(0, 50)) {
      assert.deepEqual(render(template, seed), render(template, seed), `${template.id}@${seed}`)
    }
  }
})

test('every rendered problem comes from an item of the template difficulty', () => {
  for (const template of templates) {
    const sentences = new Set(byDifficulty(template.difficulty).map((item) => item.sentence))
    assert.ok(sentences.size >= 5, `difficulty ${template.difficulty} has too few items`)
    for (const problem of rendered(template)) {
      assert.ok(
        sentences.has(problem.visual.sentence),
        `${template.id} rendered a sentence that is not a difficulty ${template.difficulty} item: ${problem.visual.sentence}`,
      )
    }
  }
})

test('across many seeds every item of that difficulty is reachable', () => {
  for (const template of templates) {
    const seen = new Set(rendered(template).map((problem) => problem.visual.sentence))
    for (const item of byDifficulty(template.difficulty)) {
      assert.ok(seen.has(item.sentence), `${template.id} never renders ${item.id}`)
    }
  }
})

test('the visual carries the cloze sentence and four shuffled choices', () => {
  for (const template of templates) {
    for (const problem of rendered(template)) {
      const { visual } = problem
      assert.equal(visual.kind, 'cloze')
      assert.deepEqual(Object.keys(visual).sort(), ['choices', 'kind', 'sentence'])
      assert.equal((visual.sentence.match(/____/g) ?? []).length, 1, 'one blank per sentence')
      assert.doesNotMatch(visual.sentence, /_____/, 'the blank is exactly four underscores')
      assert.equal(visual.choices.length, 4)
      assert.equal(new Set(visual.choices).size, 4, 'choices are distinct')
      for (const choice of visual.choices) {
        assert.match(choice, /^[a-z]+(?:-[a-z]+)?$/, `${choice} is not a plain lower-case word`)
      }
      const item = items.find((candidate) => candidate.sentence === visual.sentence)
      assert.deepEqual(
        [...visual.choices].sort(),
        [...item.choices].sort(),
        `${item.id} rendered a different choice set`,
      )
    }
  }
})

test('the choices are shuffled, so the answer is not always in the same place', () => {
  for (const template of templates) {
    const positions = new Map()
    for (const problem of rendered(template)) {
      const item = items.find((candidate) => candidate.sentence === problem.visual.sentence)
      const where = problem.visual.choices.indexOf(item.answer)
      assert.notEqual(where, -1, `${item.id}: the answer is missing from the choices`)
      positions.set(item.id, (positions.get(item.id) ?? new Set()).add(where))
    }
    for (const [id, where] of positions) {
      assert.ok(where.size >= 2, `${id}: the answer sits at position ${[...where]} every time`)
    }
  }
})

test('the answer is a one-blank cloze answer that the engine grades correct', () => {
  for (const template of templates) {
    for (const problem of rendered(template)) {
      const item = items.find((candidate) => candidate.sentence === problem.visual.sentence)
      assert.deepEqual(Object.keys(problem.answer), ['blanks'])
      assert.equal(problem.answer.blanks.length, 1)
      assert.ok(problem.answer.blanks[0].accept.includes(item.answer))
      assert.deepEqual(check('cloze', problem.answer, { blanks: [item.answer] }), {
        correct: true,
        reason: null,
      })
      assert.deepEqual(check('cloze', problem.answer, { blanks: [item.answer.toUpperCase()] }), {
        correct: true,
        reason: null,
      })
    }
  }
})

test('every distractor is graded wrong', () => {
  for (const template of templates) {
    for (const problem of rendered(template)) {
      const item = items.find((candidate) => candidate.sentence === problem.visual.sentence)
      for (const choice of problem.visual.choices) {
        if (choice === item.answer) continue
        assert.deepEqual(
          check('cloze', problem.answer, { blanks: [choice] }),
          { correct: false, reason: 'wrong' },
          `${item.id}: '${choice}' was accepted`,
        )
      }
    }
  }
})

test('the answer never reaches the child before they answer', () => {
  for (const template of templates) {
    for (const problem of rendered(template)) {
      const item = items.find((candidate) => candidate.sentence === problem.visual.sentence)
      const word = new RegExp(`\\b${item.answer}\\b`, 'i')
      for (const [where, text] of [
        ['prompt', problem.prompt],
        ['sentence', problem.visual.sentence],
        ['problemId', problem.problemId],
        ...problem.hints.map((hint, index) => [`hint ${index}`, hint]),
      ]) {
        assert.doesNotMatch(text, word, `${item.id}: the answer leaks into the ${where}`)
      }
      assert.match(problem.explanation, word, `${item.id}: the explanation does not reveal it`)
    }
  }
})

test('the prompt, hints and explanation are real text', () => {
  for (const template of templates) {
    for (const problem of rendered(template)) {
      assert.ok(problem.prompt.trim().length >= 10, `${template.id}: prompt too short`)
      assert.ok(problem.hints.length >= 2, `${template.id}: fewer than two hints`)
      assert.ok(problem.explanation.length >= 40, `${template.id}: explanation too short`)
      const all = JSON.stringify(problem)
      for (const rubbish of ['undefined', 'NaN', '[object Object]', '  ']) {
        assert.ok(!all.includes(rubbish), `${template.id}: rendered output contains ${rubbish}`)
      }
    }
  }
})

test('rendering carries the skill, widget, version and difficulty through', () => {
  for (const template of templates) {
    const problem = render(template, 4242)
    assert.equal(problem.skill, SKILL)
    assert.equal(problem.widget, 'cloze')
    assert.equal(problem.version, 1)
    assert.equal(problem.difficulty, template.difficulty)
    assert.equal(problem.problemId, template.id)
    assert.equal(problem.seed, 4242)
  }
})

test('generate does not mutate the item bank', () => {
  const before = JSON.stringify(items)
  for (const template of templates) rendered(template)
  assert.equal(JSON.stringify(items), before)
})
