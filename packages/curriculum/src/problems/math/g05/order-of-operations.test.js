/**
 * P1.4 spec — `m5.oa.order-of-operations` templates (HOMEWORK_PLAN.md §10 Phase 1:
 * "implement templates for 3 skills: … `m5.oa.order-of-operations` (number)").
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
 * There is no expression evaluator in the engine, so this file carries its own — a
 * shunting-yard parser, below. It is what makes the check independent: the template publishes
 * the expression as a string, and the value is recomputed from that string here rather than
 * taken on trust from the template's own arithmetic.
 *
 * The same parser is also pointed at each line of the template's shown working, which is the
 * part that a naive property test misses: a template can produce the right total while
 * demonstrating the wrong method. Every step must evaluate to the same value and must be
 * strictly shorter than the one before, so the chain is real simplification and not decoration.
 *
 * Declared ranges (ASSUMED — the plan fixes the widget and 5.OA.A.1 but not the shape of the
 * expressions). The ladder is the one 5.OA.A.1 itself describes, "parentheses, brackets, or
 * braces … and evaluate expressions with these symbols":
 *   difficulty 1: three operands, no brackets      (12 + 3 × 4)   — precedence alone
 *   difficulty 2: one bracketed group              ((8 - 3) × 4)  — brackets override it
 *   difficulty 3: four or five operands, with division and brackets
 * Every operand and every intermediate result is a non-negative integer and every division is
 * exact: negative numbers are 6.NS, and non-integer quotients are a different Grade 5 skill.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { templates } from './order-of-operations.js'
import { render } from '../../../engine/render.js'
import { check } from '../../../engine/check.js'
import { skills } from '../../../catalog/math/grade-05.js'

const SKILL = 'm5.oa.order-of-operations'
const WIDGET = 'number'
const SEEDS = Array.from({ length: 500 }, (_, index) => index)

const PRECEDENCE = { '+': 1, '-': 1, '×': 2, '÷': 2 }
const TOKEN = /\d+|[+\-×÷()]/g

/** Tokenise, and refuse anything that is not a number, an operator or a bracket. */
function tokenize(expression) {
  const tokens = expression.match(TOKEN) ?? []
  assert.equal(
    tokens.join(''),
    expression.replaceAll(' ', ''),
    `expression ${JSON.stringify(expression)} contains something that is not a number, + - × ÷ or a bracket`,
  )
  return tokens
}

/**
 * Shunting-yard. Returns the value plus every intermediate result, so the caller can insist
 * that the arithmetic stayed inside Grade 5. Throws on an inexact division or a malformed
 * expression, which is the point: those must never be generated.
 */
function evaluate(expression) {
  const tokens = tokenize(expression)
  const values = []
  const operators = []
  const intermediates = []

  const apply = () => {
    const operator = operators.pop()
    const right = values.pop()
    const left = values.pop()
    assert.ok(left !== undefined && right !== undefined, `malformed expression: ${expression}`)
    let result
    if (operator === '+') result = left + right
    else if (operator === '-') result = left - right
    else if (operator === '×') result = left * right
    else {
      assert.ok(right !== 0 && left % right === 0, `inexact division ${left} ÷ ${right} in ${expression}`)
      result = left / right
    }
    intermediates.push(result)
    values.push(result)
  }

  for (const token of tokens) {
    if (/^\d+$/.test(token)) values.push(Number(token))
    else if (token === '(') operators.push(token)
    else if (token === ')') {
      while (operators.length > 0 && operators.at(-1) !== '(') apply()
      assert.equal(operators.pop(), '(', `unbalanced brackets in ${expression}`)
    } else {
      while (operators.length > 0 && PRECEDENCE[operators.at(-1)] >= PRECEDENCE[token]) apply()
      operators.push(token)
    }
  }
  while (operators.length > 0) {
    assert.notEqual(operators.at(-1), '(', `unbalanced brackets in ${expression}`)
    apply()
  }
  assert.equal(values.length, 1, `malformed expression: ${expression}`)
  return { value: values[0], intermediates }
}

const operands = (expression) => tokenize(expression).filter((token) => /^\d+$/.test(token)).map(Number)
const operators = (expression) => tokenize(expression).filter((token) => token in PRECEDENCE)
const brackets = (expression) => tokenize(expression).filter((token) => token === '(').length

/** difficulty -> the shape of expression it is allowed to produce. */
const BANDS = {
  1: { terms: [3, 3], groups: [0, 0], allowed: new Set(['+', '-', '×']), requires: null },
  2: { terms: [3, 4], groups: [1, 1], allowed: new Set(['+', '-', '×']), requires: null },
  3: { terms: [4, 5], groups: [1, 2], allowed: new Set(['+', '-', '×', '÷']), requires: '÷' },
}

const strings = (problem) => [problem.prompt, ...problem.hints, problem.explanation]

test('the skill this file serves exists in the Grade 5 catalog', () => {
  const skill = skills.find((entry) => entry.id === SKILL)
  assert.ok(skill, `${SKILL} is not in catalog/math/grade-05.js`)
  assert.equal(skill.legacyId, 'order-of-operations')
})

test('every template declares the skill, the number widget and a version', () => {
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
    assert.match(template.id, /^m5\.oa\.order-of-operations\/[a-z0-9]+(?:-[a-z0-9]+)*$/, template.id)
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

// The expression has to survive rendering as a parsable string, not only as English inside the
// prompt. (ASSUMED shape: the plan names the widget but not its `visual` payload; `render()`
// passes `visual` through untouched for exactly this purpose.)
test('every problem publishes its expression and its working in visual', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const { visual } = render(template, seed)
      assert.ok(visual && typeof visual === 'object', `${template.id} @ ${seed} has no visual`)
      assert.equal(visual.kind, 'expression', `${template.id} @ ${seed} visual.kind`)
      assert.equal(typeof visual.expression, 'string', `${template.id} @ ${seed} visual.expression`)
      assert.ok(Array.isArray(visual.steps), `${template.id} @ ${seed} visual.steps`)
    }
  }
})

test('the prompt states the same expression the visual publishes', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      assert.ok(
        problem.prompt.includes(problem.visual.expression),
        `${template.id} @ ${seed}: prompt ${JSON.stringify(problem.prompt)} omits ${problem.visual.expression}`,
      )
    }
  }
})

// §9.4 "numbers within the skill's declared range" and §6.8 "Maths number ranges are per skill
// and asserted by tests".
test('the expression has the shape its difficulty declares', () => {
  for (const template of templates) {
    const band = BANDS[template.difficulty]
    for (const seed of SEEDS) {
      const { expression } = render(template, seed).visual
      const terms = operands(expression)
      const groups = brackets(expression)
      assert.ok(
        terms.length >= band.terms[0] && terms.length <= band.terms[1],
        `${template.id} @ ${seed}: ${terms.length} operands in ${expression}, expected ${band.terms.join('..')}`,
      )
      assert.ok(
        groups >= band.groups[0] && groups <= band.groups[1],
        `${template.id} @ ${seed}: ${groups} bracket group(s) in ${expression}, expected ${band.groups.join('..')}`,
      )
      const used = operators(expression)
      for (const operator of used) {
        assert.ok(band.allowed.has(operator), `${template.id} @ ${seed}: ${operator} is not allowed at difficulty ${template.difficulty}`)
      }
      if (band.requires) {
        assert.ok(used.includes(band.requires), `${template.id} @ ${seed}: ${expression} never uses ${band.requires}`)
      }
      for (const term of terms) {
        assert.ok(term >= 1 && term <= 20, `${template.id} @ ${seed}: operand ${term} outside 1..20`)
      }
    }
  }
})

// A hint has to be able to quote an operation out of the expression without that quotation
// accidentally containing the total. Keeping the answer off the operand list is the cheap way
// to guarantee it, and it also stops the answer being readable straight off the page.
test('the total is never one of the numbers already written in the expression', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      assert.ok(
        !operands(problem.visual.expression).includes(problem.answer.value),
        `${template.id} @ ${seed}: the answer ${problem.answer.value} is already printed in ${problem.visual.expression}`,
      )
    }
  }
})

// The entire content of the difficulty-1 rung is "do not just go left to right". An expression
// that gives the same total either way does not teach it, so none are allowed.
test('every difficulty-1 expression punishes left-to-right evaluation', () => {
  for (const template of templates) {
    if (template.difficulty !== 1) continue
    for (const seed of SEEDS) {
      const { expression } = render(template, seed).visual
      const [a, b, c] = operands(expression)
      const [first, second] = operators(expression)
      const step = (left, operator, right) => {
        if (operator === '+') return left + right
        if (operator === '-') return left - right
        if (operator === '×') return left * right
        return left / right
      }
      // what a child who has not learned the rule does
      const naive = step(step(a, first, b), second, c)
      assert.notEqual(
        naive,
        evaluate(expression).value,
        `${template.id} @ ${seed}: ${expression} comes out the same left to right, so it teaches nothing`,
      )
    }
  }
})

// Recomputed from the published expression by the parser at the top of this file.
test('the answer is what the expression actually evaluates to', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const { value, intermediates } = evaluate(problem.visual.expression)
      assert.equal(problem.answer.value, value, `${template.id} @ ${seed}: ${problem.visual.expression}`)
      assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= 1000, `${template.id} @ ${seed}: answer ${value} outside 0..1000`)
      for (const step of intermediates) {
        assert.ok(Number.isSafeInteger(step) && step >= 0 && step <= 1000, `${template.id} @ ${seed}: intermediate ${step} outside 0..1000 in ${problem.visual.expression}`)
      }
    }
  }
})

// The finding that re-armed the long-multiplication loop: a correct total is not a correct
// method. Every line of the shown working must be the same value, spelled shorter.
test('the shown working is a real chain of simplifications', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const { steps, expression } = problem.visual
      assert.ok(steps.length >= 3, `${template.id} @ ${seed}: ${steps.length} step(s) of working`)
      assert.equal(steps[0], expression, `${template.id} @ ${seed}: working does not start at the expression`)
      assert.equal(steps.at(-1), String(problem.answer.value), `${template.id} @ ${seed}: working does not end at the answer`)
      for (const [index, step] of steps.entries()) {
        assert.equal(evaluate(step).value, problem.answer.value, `${template.id} @ ${seed}: step ${JSON.stringify(step)} is not worth ${problem.answer.value}`)
        if (index > 0) {
          assert.ok(step.length < steps[index - 1].length, `${template.id} @ ${seed}: step ${JSON.stringify(step)} is no simpler than ${JSON.stringify(steps[index - 1])}`)
        }
      }
    }
  }
})

// §9.4: "its own answer passes `check`; a perturbed answer fails".
test('check grades the right answer right and a perturbed one wrong', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const { value } = problem.answer
      for (const response of [{ value }, { value: String(value) }]) {
        assert.deepEqual(
          check(problem.widget, problem.answer, response),
          { correct: true, reason: null },
          `${template.id} @ ${seed} failed its own answer as ${JSON.stringify(response)}`,
        )
      }
      for (const wrong of [value + 1, value - 1, value * 2 + 1]) {
        assert.equal(
          check(problem.widget, problem.answer, { value: wrong }).correct,
          false,
          `${template.id} @ ${seed} accepted ${wrong} for ${value}`,
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

// A hint points at which operation goes first — the whole content of the skill — without
// handing over the total. (ASSUMED: §6.8 does not state this. It is why hints exist.)
test('a hint names the operation to do first, and no hint gives the total away', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const { expression } = problem.visual
      const answer = new RegExp(`(?<![0-9])${problem.answer.value}(?![0-9])`)
      const named = problem.hints.some((hint) => {
        const operation = hint.match(/\d+ [+\-×÷] \d+/)
        return operation !== null && expression.includes(operation[0])
      })
      assert.ok(named, `${template.id} @ ${seed}: no hint names an operation from ${expression} — ${JSON.stringify(problem.hints)}`)
      for (const hint of problem.hints) {
        assert.doesNotMatch(hint, answer, `${template.id} @ ${seed} leaks the answer ${problem.answer.value} in a hint`)
      }
    }
  }
})

test('the explanation shows the whole chain, ending on the answer', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const chain = problem.visual.steps.join(' = ')
      assert.ok(
        problem.explanation.includes(chain),
        `${template.id} @ ${seed}: explanation ${JSON.stringify(problem.explanation)} does not contain ${JSON.stringify(chain)}`,
      )
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
