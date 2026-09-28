/**
 * P1.8 part 1 of 4 — the answer widgets.
 *
 * Plan §6.3 gives one component per widget type; Phase 1 needs the four the shipped
 * templates actually use: `number`, `column`, `fraction` and `cloze`. This spec is driven
 * by `listProblems()`, so a template added later is covered the day it lands.
 *
 * Two things are being pinned, and only these two:
 *
 * 1. WHAT THE KID TYPES REACHES THE REAL CHECKER. The test drives the DOM the way a kid
 *    would, reads the draft value back out, runs it through `toResponse`, and hands the
 *    result to the shipped `check()` from @grove/curriculum against the real answer. No
 *    response shape is written down here as a literal — if the widget builds the wrong
 *    shape, `check` says `invalid` and the test fails. A perturbed entry must come back
 *    `wrong`, never `invalid`: `invalid` would mean the widget cannot express a wrong
 *    answer, which is the failure mode that makes a checker look right for the wrong
 *    reason.
 *
 * 2. NOTHING LEAKS. Plan §3 principle 5: the client receives the prompt, never the answer.
 *    The widget is handed a `toInstance()` payload — which carries no answer, no hints and
 *    no explanation — so the only way an answer reaches the DOM is if the widget invents
 *    it. Asserted per widget, using the same rule the P1.7 flow test uses: for `number`
 *    and `column` the answer must not appear as a standalone number; for `fraction` the
 *    `num/den` pair must not appear; for `cloze` the right word legitimately appears (it
 *    is one of the four choices — that is the exercise), so what is asserted instead is
 *    that no rendered attribute distinguishes it from the other three.
 */
import { describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import { check, getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const SEEDS = [12345, 7, 999_999]

/** The kid's draft lives in the page, not the widget — mirror that, and spy on it. */
function Harness({ instance, spy, disabled }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  spy.value = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={disabled} />
}

const mount = (instance, { disabled = false } = {}) => {
  const spy = { value: undefined }
  const view = render(<Harness instance={instance} spy={spy} disabled={disabled} />)
  return { spy, view }
}

const rendered = (id, seed) => renderProblem(getProblem(id), seed)

/** Type the right answer the way a kid would, per widget. */
function enterCorrect(instance, answer) {
  if (instance.widget === 'cloze') {
    for (let index = 0; index < answer.blanks.length; index++) {
      fireEvent.click(screen.getAllByRole('radio', { name: answer.blanks[index].accept[0] })[index])
    }
    return
  }
  const field = screen.getByLabelText('Your answer')
  const text = instance.widget === 'fraction' ? `${answer.num}/${answer.den}` : String(answer.value)
  fireEvent.change(field, { target: { value: text } })
}

/** Type something a kid could plausibly type that is simply not right. */
function enterWrong(instance, answer) {
  if (instance.widget === 'cloze') {
    const accepted = new Set(answer.blanks[0].accept.map((word) => word.toLowerCase()))
    const other = instance.visual.choices.find((choice) => !accepted.has(choice.toLowerCase()))
    fireEvent.click(screen.getAllByRole('radio', { name: other })[0])
    return
  }
  const field = screen.getByLabelText('Your answer')
  const text = instance.widget === 'fraction' ? `${answer.num + 1}/${answer.den}` : String(answer.value + 1)
  fireEvent.change(field, { target: { value: text } })
}

const problems = listProblems()

/** Everything the server sent, removed. What survives is the widget's own doing. */
function residueOf(text, instance) {
  const sent = [instance.prompt]
  const visual = instance.visual
  if (visual.kind === 'expression') sent.push(visual.expression)
  if (visual.kind === 'column') sent.push(visual.operator, ...visual.operands.map(String))
  if (visual.kind === 'fraction-sum') {
    sent.push(visual.operator)
    for (const addend of visual.addends) sent.push(`${addend.num}/${addend.den}`, String(addend.num), String(addend.den))
  }
  if (visual.kind === 'cloze') sent.push(visual.sentence, ...visual.choices)
  let residue = text
  for (const piece of sent.sort((a, b) => b.length - a.length)) residue = residue.split(piece).join(' ')
  return residue
}

describe('P1.8 — answer widgets', () => {
  it('covers every widget the shipped templates use, and nothing else', () => {
    expect(new Set(problems.map((problem) => problem.widget))).toEqual(
      new Set(['number', 'column', 'fraction', 'cloze']),
    )
    expect(problems.length).toBeGreaterThanOrEqual(12)
  })

  describe.each(problems.map((problem) => [problem.id, problem.widget]))('%s (%s)', (id, widget) => {
    it.each(SEEDS)('shows the prompt and its visual at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { view } = mount(instance)

      expect(screen.getByText(instance.prompt)).toBeInTheDocument()
      const text = view.container.textContent

      if (instance.visual.kind === 'expression') expect(text).toContain(instance.visual.expression)
      if (instance.visual.kind === 'cloze') {
        for (const choice of instance.visual.choices) {
          expect(screen.getAllByRole('radio', { name: choice }).length).toBeGreaterThan(0)
        }
      }
      if (instance.visual.kind === 'column') {
        for (const operand of instance.visual.operands) expect(text).toContain(String(operand))
        expect(text).toContain(instance.visual.operator)
      }
      if (instance.visual.kind === 'fraction-sum') {
        for (const addend of instance.visual.addends) expect(text).toContain(`${addend.num}/${addend.den}`)
        expect(text).toContain(instance.visual.operator)
      }
    })

    it.each(SEEDS)('builds a response the shipped checker accepts at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { spy } = mount(instance)

      enterCorrect(instance, full.answer)
      expect(check(widget, full.answer, toResponse(instance, spy.value))).toEqual({ correct: true, reason: null })
    })

    it.each(SEEDS)('a wrong entry is wrong, not unreadable, at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { spy } = mount(instance)

      enterWrong(instance, full.answer)
      const result = check(widget, full.answer, toResponse(instance, spy.value))
      expect(result.correct).toBe(false)
      expect(result.reason).toBe('wrong')
    })

    it.each(SEEDS)('an untouched widget is not a correct answer at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { spy } = mount(instance)

      expect(check(widget, full.answer, toResponse(instance, spy.value)).correct).toBe(false)
    })

    it.each(SEEDS)('never renders the answer, working or hints at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { view } = mount(instance)
      const text = view.container.textContent
      const html = view.container.innerHTML

      expect(text).not.toContain(full.explanation)
      for (const hint of full.hints) expect(text).not.toContain(hint)

      // Subtract everything the server legitimately sent. Whatever is left is the
      // widget's own invention, and it must not contain a single digit — a stronger
      // rule than hunting for the answer string, and one that cannot be passed by
      // coincidence when an operand happens to equal the answer.
      expect(residueOf(view.container.textContent, instance)).not.toMatch(/\d/)

      if (widget === 'cloze') {
        // The word is on screen by design. What must not be on screen is which one it is:
        // every choice must be rendered with the same markup but for its own text.
        const right = full.answer.blanks[0].accept[0]
        const wrongChoice = instance.visual.choices.find((choice) => choice !== right)
        const shapeOf = (choice) =>
          screen
            .getAllByRole('radio', { name: choice })[0]
            .closest('label')
            .outerHTML.split(choice)
            .join('«CHOICE»')
            .replaceAll(/(id|for|aria-labelledby)="[^"]*"/g, '$1="«ID»"')
        expect(shapeOf(right)).toBe(shapeOf(wrongChoice))
        expect(instance.visual.sentence).not.toContain(right)
      }

      expect(text).not.toMatch(/\bAI\b/)
      expect(html).not.toContain('correct')
    })

    it('does not accept input while disabled', () => {
      const full = rendered(id, SEEDS[0])
      const instance = toInstance(full)
      const { spy } = mount(instance, { disabled: true })
      const before = JSON.stringify(spy.value)

      if (widget === 'cloze') {
        for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
        fireEvent.click(screen.getAllByRole('radio')[0])
      } else {
        expect(screen.getByLabelText('Your answer')).toBeDisabled()
        fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '5' } })
      }

      expect(JSON.stringify(spy.value)).toBe(before)
    })
  })

  it('refuses a widget it does not know, the way check() does', () => {
    const instance = { ...toInstance(rendered(problems[0].id, 1)), widget: 'graph' }
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<AnswerWidget instance={instance} value={null} onChange={() => {}} />)).toThrow(
      /unknown widget: graph/,
    )
    expect(() => toResponse(instance, null)).toThrow(/unknown widget: graph/)
    quiet.mockRestore()
  })

  it('starts every widget empty rather than guessing for the kid', () => {
    for (const problem of problems) {
      const instance = toInstance(rendered(problem.id, SEEDS[0]))
      const value = emptyValue(instance)
      if (problem.widget === 'cloze') {
        expect(Array.isArray(value)).toBe(true)
        expect(value.every((entry) => entry === null)).toBe(true)
        expect(value.length).toBe(rendered(problem.id, SEEDS[0]).answer.blanks.length)
      } else {
        expect(value).toBe('')
      }
    }
  })
})
