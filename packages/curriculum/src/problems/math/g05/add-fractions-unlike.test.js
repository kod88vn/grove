/**
 * P1.4 spec — `m5.nf.add-fractions-unlike` templates (HOMEWORK_PLAN.md §10 Phase 1:
 * "implement templates for 3 skills: … `m5.nf.add-fractions-unlike` (fraction) …").
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
 * The sum is recomputed here with `engine/fraction.js` (exact, BigInt-backed) from the addends
 * the template publishes, never from the template's own answer, so a template cannot satisfy
 * this file by repeating its own arithmetic bug back to it.
 *
 * Declared ranges (ASSUMED — the plan fixes the widget and 5.NF.A.1 but not the denominators).
 * The ladder is the one that actually makes finding a common denominator harder:
 *   difficulty 1: one denominator is a multiple of the other  (1/4 + 1/2)  — no new LCD to find
 *   difficulty 2: the denominators are coprime               (1/3 + 1/4)  — LCD is the product
 *   difficulty 3: they share a factor but neither divides    (5/6 + 3/8)  — LCD is neither
 * Sums above 1 are deliberately allowed: 5.NF.A.1 covers them, and `m5.nf.add-mixed-numbers`
 * is a different skill in the same catalog.
 *
 * Note a small theorem this file relies on: if both addends are in lowest terms and their
 * denominators differ, the sum can never be a whole number, so the answer always has a
 * denominator above 1 and always prints as `num/den`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { templates } from './add-fractions-unlike.js'
import { render } from '../../../engine/render.js'
import { check } from '../../../engine/check.js'
import { add, equals, reduce } from '../../../engine/fraction.js'
import { skills } from '../../../catalog/math/grade-05.js'

const SKILL = 'm5.nf.add-fractions-unlike'
const WIDGET = 'fraction'
const SEEDS = Array.from({ length: 500 }, (_, index) => index)

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b))
const lcm = (a, b) => (a / gcd(a, b)) * b

/** difficulty -> how the two denominators must relate, and the window they live in. */
const BANDS = {
  1: { window: [2, 12], relation: (a, b) => b % a === 0 || a % b === 0 },
  2: { window: [2, 10], relation: (a, b) => gcd(a, b) === 1 },
  3: { window: [4, 15], relation: (a, b) => gcd(a, b) > 1 && b % a !== 0 && a % b !== 0 },
}

const strings = (problem) => [problem.prompt, ...problem.hints, problem.explanation]

test('the skill this file serves exists in the Grade 5 catalog', () => {
  const skill = skills.find((entry) => entry.id === SKILL)
  assert.ok(skill, `${SKILL} is not in catalog/math/grade-05.js`)
  assert.equal(skill.legacyId, 'add-fractions-unlike')
})

test('every template declares the skill, the fraction widget and a version', () => {
  assert.ok(templates.length >= 3, 'fewer than three templates')
  for (const template of templates) {
    assert.equal(template.skill, SKILL, `${template.id} serves ${template.skill}`)
    assert.equal(template.widget, WIDGET, `${template.id} uses ${template.widget}`)
    assert.ok(Number.isInteger(template.version) && template.version >= 1, `${template.id} version`)
    assert.ok(typeof template.title === 'string' && template.title.length > 0, `${template.id} title`)
    assert.equal(typeof template.generate, 'function', `${template.id} generate`)
  }
})

test('every id is <skill-id>/<template-slug>, and no two are the same', () => {
  const seen = new Set()
  for (const template of templates) {
    assert.match(template.id, /^m5\.nf\.add-fractions-unlike\/[a-z0-9]+(?:-[a-z0-9]+)*$/, template.id)
    assert.ok(!seen.has(template.id), `${template.id} is declared twice`)
    seen.add(template.id)
  }
})

test('difficulties 1, 2 and 3 are all covered', () => {
  const covered = new Set(templates.map((template) => template.difficulty))
  for (const difficulty of [1, 2, 3]) {
    assert.ok(covered.has(difficulty), `no template at difficulty ${difficulty}`)
  }
  assert.deepEqual([...covered].sort(), [1, 2, 3], 'a difficulty outside 1-3 is declared')
})

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

// The `fraction` widget has to draw the two addends, so they survive rendering as numbers and
// not only inside the prompt string. (ASSUMED shape: the plan names the widget but not its
// `visual` payload; `render()` passes `visual` through untouched for exactly this purpose.)
test('every problem carries its addends and their lowest common denominator in visual', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const { visual } = render(template, seed)
      assert.ok(visual && typeof visual === 'object', `${template.id} @ ${seed} has no visual`)
      assert.equal(visual.kind, 'fraction-sum', `${template.id} @ ${seed} visual.kind`)
      assert.equal(visual.operator, '+', `${template.id} @ ${seed} visual.operator`)
      assert.ok(Array.isArray(visual.addends) && visual.addends.length === 2, `${template.id} @ ${seed} addends`)
      const [left, right] = visual.addends
      assert.equal(visual.lcd, lcm(left.den, right.den), `${template.id} @ ${seed} lcd`)
    }
  }
})

test('both addends are proper fractions in lowest terms with unlike denominators', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const [left, right] = render(template, seed).visual.addends
      for (const [label, value] of [['left', left], ['right', right]]) {
        assert.ok(Number.isSafeInteger(value.num) && Number.isSafeInteger(value.den), `${template.id} @ ${seed} ${label} parts`)
        assert.ok(value.num >= 1, `${template.id} @ ${seed} ${label} ${value.num}/${value.den} is not positive`)
        assert.ok(value.num < value.den, `${template.id} @ ${seed} ${label} ${value.num}/${value.den} is not proper`)
        assert.equal(gcd(value.num, value.den), 1, `${template.id} @ ${seed} ${label} ${value.num}/${value.den} is not in lowest terms`)
      }
      assert.notEqual(left.den, right.den, `${template.id} @ ${seed}: ${left.den} and ${right.den} are not unlike`)
    }
  }
})

// §9.4 "numbers within the skill's declared range" and §6.8 "Maths number ranges are per skill
// and asserted by tests".
test('the denominators relate the way the difficulty declares, inside its window', () => {
  for (const template of templates) {
    const band = BANDS[template.difficulty]
    const [min, max] = band.window
    for (const seed of SEEDS) {
      const [left, right] = render(template, seed).visual.addends
      for (const den of [left.den, right.den]) {
        assert.ok(den >= min && den <= max, `${template.id} @ ${seed}: denominator ${den} outside ${min}..${max}`)
      }
      assert.ok(
        band.relation(left.den, right.den),
        `${template.id} @ ${seed}: ${left.den} and ${right.den} are the wrong kind of pair for difficulty ${template.difficulty}`,
      )
    }
  }
})

test('each band is genuinely exercised, not pinned to one pair', () => {
  for (const template of templates) {
    const pairs = new Set()
    for (const seed of SEEDS) {
      const [left, right] = render(template, seed).visual.addends
      pairs.add(`${left.den}/${right.den}`)
    }
    assert.ok(pairs.size >= 4, `${template.id} uses only ${pairs.size} denominator pair(s)`)
  }
})

// Recomputed from the addends with the engine's exact fraction arithmetic.
test('the answer is the exact sum of the two addends, in lowest terms', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const [left, right] = problem.visual.addends
      const expected = reduce(add(left, right))
      assert.ok(equals(problem.answer, expected), `${template.id} @ ${seed}: ${JSON.stringify(problem.answer)} is not ${expected.num}/${expected.den}`)
      assert.equal(problem.answer.num, expected.num, `${template.id} @ ${seed} answer.num`)
      assert.equal(problem.answer.den, expected.den, `${template.id} @ ${seed} answer.den`)
      assert.ok(problem.answer.den > 1, `${template.id} @ ${seed}: the sum collapsed to a whole number`)
      assert.equal(problem.answer.simplest, true, `${template.id} @ ${seed}: the answer does not demand simplest form`)
    }
  }
})

test('the prompt states the same addition the visual does', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const [left, right] = problem.visual.addends
      const sum = `${left.num}/${left.den} + ${right.num}/${right.den}`
      assert.ok(problem.prompt.includes(sum), `${template.id} @ ${seed}: prompt ${JSON.stringify(problem.prompt)} omits ${sum}`)
    }
  }
})

// §9.4: "its own answer passes `check`; a perturbed answer fails".
test('check grades the right answer right and a perturbed one wrong', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const { num, den } = problem.answer
      assert.deepEqual(
        check(problem.widget, problem.answer, { text: `${num}/${den}` }),
        { correct: true, reason: null },
        `${template.id} @ ${seed} failed its own answer`,
      )
      for (const text of [`${num + 1}/${den}`, `${num}/${den + 1}`, `${den}/${num}`]) {
        assert.equal(
          check(problem.widget, problem.answer, { text }).correct,
          false,
          `${template.id} @ ${seed} accepted ${text} for ${num}/${den}`,
        )
      }
    }
  }
})

// Simplest form is the point of the skill's last step, so an equal but unreduced answer is
// told apart from a plain wrong one.
test('an equal but unreduced answer is reported as not-simplest, not wrong', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const { num, den } = problem.answer
      assert.deepEqual(
        check(problem.widget, problem.answer, { text: `${num * 2}/${den * 2}` }),
        { correct: false, reason: 'not-simplest' },
        `${template.id} @ ${seed}: ${num * 2}/${den * 2} was not reported as unreduced`,
      )
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

// A hint has to point at the common denominator — that is the whole difficulty of the skill —
// without handing over the sum. (ASSUMED: §6.8 does not state this. It is why hints exist.)
test('the hints name the common denominator and never the answer, which the explanation shows', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const { lcd } = problem.visual
      const answer = `${problem.answer.num}/${problem.answer.den}`
      const hintText = problem.hints.join(' ')
      assert.match(hintText, new RegExp(`(?<![0-9])${lcd}(?![0-9])`), `${template.id} @ ${seed}: no hint names the common denominator ${lcd}`)
      assert.ok(!hintText.includes(answer), `${template.id} @ ${seed} leaks the answer ${answer} in a hint`)
      assert.ok(problem.explanation.includes(answer), `${template.id} @ ${seed} explanation omits the answer ${answer}`)
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
