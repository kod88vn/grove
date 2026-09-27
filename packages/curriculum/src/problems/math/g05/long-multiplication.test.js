/**
 * P1.4 spec — `m5.nbt.long-multiplication` templates (HOMEWORK_PLAN.md §10 Phase 1:
 * "implement templates for 3 skills: `m5.nbt.long-multiplication` (column) …").
 *
 * §9 "Definition of done" is the contract this file encodes:
 *   9.2  at least one template per difficulty 1, 2 and 3;
 *   9.3  every template yields >=2 hints and an explanation;
 *   9.4  a property test over 500 seeds: it renders; its own answer passes `check`; a
 *        perturbed answer fails; no `undefined` / `NaN` / `[object Object]` in any string;
 *        numbers within the skill's declared range.
 * §6.2 fixes the template shape and the `<skill-id>/<template-slug>` id form.
 * §6.8 requires the number range to be "per skill and asserted by tests".
 *
 * The answer is recomputed here with BigInt, independently of whatever arithmetic the template
 * used, so the test cannot be satisfied by repeating the template's own bug back to it.
 *
 * Declared range (ASSUMED — the plan fixes the widget and the CCSS code but not the digit
 * counts). The catalog names this skill "Long Multiplication (2-digit)" and cites 5.NBT.B.5
 * ("fluently multiply multi-digit whole numbers using the standard algorithm"), so the ladder
 * climbs to it: 2x1 digit, then 2x2, then 3x2. No factor is ever 0 or 1, because neither
 * exercises the algorithm.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { templates } from './long-multiplication.js'
import { render } from '../../../engine/render.js'
import { check } from '../../../engine/check.js'
import { skills } from '../../../catalog/math/grade-05.js'

const SKILL = 'm5.nbt.long-multiplication'
const WIDGET = 'column'
const SEEDS = Array.from({ length: 500 }, (_, index) => index)

/** difficulty -> [min, max] for each factor, in the order the column prints them. */
const BANDS = {
  1: { top: [10, 99], bottom: [2, 9] },
  2: { top: [10, 99], bottom: [10, 99] },
  3: { top: [100, 999], bottom: [10, 99] },
}

const within = (value, [min, max]) =>
  Number.isSafeInteger(value) && value >= min && value <= max

const strings = (problem) => [problem.prompt, ...problem.hints, problem.explanation]

test('the skill this file serves exists in the Grade 5 catalog', () => {
  const skill = skills.find((entry) => entry.id === SKILL)
  assert.ok(skill, `${SKILL} is not in catalog/math/grade-05.js`)
  assert.equal(skill.legacyId, 'long-multiplication')
})

test('every template declares the skill, the column widget and a version', () => {
  assert.ok(templates.length >= 3, 'fewer than three templates')
  for (const template of templates) {
    assert.equal(template.skill, SKILL, `${template.id} serves ${template.skill}`)
    assert.equal(template.widget, WIDGET, `${template.id} uses ${template.widget}`)
    assert.ok(Number.isInteger(template.version) && template.version >= 1, `${template.id} version`)
    assert.ok(typeof template.title === 'string' && template.title.length > 0, `${template.id} title`)
    assert.equal(typeof template.generate, 'function', `${template.id} generate`)
  }
})

// §6.2: "Problem id: `<skill-id>/<template-slug>`". §6.2: "Ids are never reused."
test('every id is <skill-id>/<template-slug>, and no two are the same', () => {
  const seen = new Set()
  for (const template of templates) {
    assert.match(template.id, /^m5\.nbt\.long-multiplication\/[a-z0-9]+(?:-[a-z0-9]+)*$/, template.id)
    assert.ok(!seen.has(template.id), `${template.id} is declared twice`)
    seen.add(template.id)
  }
})

// §9.2: "At least one template per difficulty 1, 2 and 3."
test('difficulties 1, 2 and 3 are all covered', () => {
  const covered = new Set(templates.map((template) => template.difficulty))
  for (const difficulty of [1, 2, 3]) {
    assert.ok(covered.has(difficulty), `no template at difficulty ${difficulty}`)
  }
  assert.deepEqual([...covered].sort(), [1, 2, 3], 'a difficulty outside 1-3 is declared')
})

// The server re-renders the problem from its seed to grade it (§6.6), so the same seed must
// produce a byte-identical problem every time, in any order, in any process.
test('the same seed always renders the same problem', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      assert.deepEqual(render(template, seed), render(template, seed), `${template.id} @ ${seed}`)
    }
  }
})

test('different seeds render different problems', () => {
  for (const template of templates) {
    const prompts = new Set(SEEDS.map((seed) => render(template, seed).prompt))
    assert.ok(prompts.size >= 20, `${template.id} produced only ${prompts.size} distinct prompts over 500 seeds`)
  }
})

// The `column` widget draws a grid, so the operands have to survive rendering as numbers, not
// only inside the prompt string. (ASSUMED shape: the plan names the widget but not its
// `visual` payload; `render()` passes `visual` through untouched for exactly this purpose.)
test('every problem carries its column layout in visual', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const visual = problem.visual
      assert.ok(visual && typeof visual === 'object', `${template.id} @ ${seed} has no visual`)
      assert.equal(visual.kind, 'column', `${template.id} @ ${seed} visual.kind`)
      assert.equal(visual.operator, '×', `${template.id} @ ${seed} visual.operator`)
      assert.ok(Array.isArray(visual.operands) && visual.operands.length === 2, `${template.id} @ ${seed} operands`)
    }
  }
})

// §9.4 "numbers within the skill's declared range" and §6.8 "Maths number ranges are per skill
// and asserted by tests".
test('every factor sits in the band its difficulty declares', () => {
  for (const template of templates) {
    const band = BANDS[template.difficulty]
    for (const seed of SEEDS) {
      const [top, bottom] = render(template, seed).visual.operands
      assert.ok(within(top, band.top), `${template.id} @ ${seed}: top factor ${top} outside ${band.top}`)
      assert.ok(within(bottom, band.bottom), `${template.id} @ ${seed}: bottom factor ${bottom} outside ${band.bottom}`)
    }
  }
})

test('each band is genuinely exercised, not pinned to one pair', () => {
  for (const template of templates) {
    const tops = new Set()
    const bottoms = new Set()
    for (const seed of SEEDS) {
      const [top, bottom] = render(template, seed).visual.operands
      tops.add(top)
      bottoms.add(bottom)
    }
    assert.ok(tops.size >= 5, `${template.id} varies the top factor over only ${tops.size} values`)
    assert.ok(bottoms.size >= 5, `${template.id} varies the bottom factor over only ${bottoms.size} values`)
  }
})

// Recomputed with BigInt, so a float rounding bug in the template cannot hide behind itself.
test('the answer is the product of the two factors', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const [top, bottom] = problem.visual.operands
      assert.equal(typeof problem.answer.value, 'number', `${template.id} @ ${seed} answer.value`)
      assert.equal(
        BigInt(problem.answer.value),
        BigInt(top) * BigInt(bottom),
        `${template.id} @ ${seed}: ${top} x ${bottom}`,
      )
    }
  }
})

test('the prompt states the same multiplication the visual does', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const [top, bottom] = problem.visual.operands
      assert.ok(
        problem.prompt.includes(`${top} × ${bottom}`),
        `${template.id} @ ${seed}: prompt ${JSON.stringify(problem.prompt)} omits ${top} × ${bottom}`,
      )
    }
  }
})

// §9.4: "its own answer passes `check`; a perturbed answer fails".
test('check grades the right answer right and a perturbed one wrong', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const value = problem.answer.value
      assert.deepEqual(
        check(problem.widget, problem.answer, { value }),
        { correct: true, reason: null },
        `${template.id} @ ${seed} failed its own answer`,
      )
      for (const perturbed of [value + 1, value - 1, value * 10, -value]) {
        assert.equal(
          check(problem.widget, problem.answer, { value: perturbed }).correct,
          false,
          `${template.id} @ ${seed} accepted ${perturbed} for ${value}`,
        )
      }
    }
  }
})

// §9.3: "Every template yields >=2 hints and an explanation."
test('every problem has at least two hints and an explanation', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      assert.ok(problem.hints.length >= 2, `${template.id} @ ${seed} has ${problem.hints.length} hints`)
      for (const hint of problem.hints) {
        assert.ok(hint.trim().length > 0, `${template.id} @ ${seed} has a blank hint`)
      }
      assert.ok(problem.explanation.trim().length > 0, `${template.id} @ ${seed} has a blank explanation`)
    }
  }
})

// A hint that hands over the product is not a hint; the kid taps it and the check means
// nothing. (ASSUMED: §6.8 does not state this. It is the reason hints exist.)
test('no hint contains the final product, but the explanation does', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const answer = String(problem.answer.value)
      const token = new RegExp(`(?<![0-9])${answer}(?![0-9])`)
      for (const hint of problem.hints) {
        assert.doesNotMatch(hint, token, `${template.id} @ ${seed} leaks ${answer} in a hint`)
      }
      assert.match(problem.explanation, token, `${template.id} @ ${seed} explanation omits ${answer}`)
    }
  }
})

// §9.4: "no `undefined` / `NaN` / `[object Object]` in any string".
test('no rendered string leaks undefined, NaN or [object Object]', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      for (const text of strings(render(template, seed))) {
        for (const leak of ['undefined', 'NaN', '[object Object]', 'null']) {
          assert.ok(!text.includes(leak), `${template.id} @ ${seed} leaks ${leak}: ${text}`)
        }
      }
    }
  }
})
