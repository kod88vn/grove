/**
 * P2.6 — the `choice` widget: two labelled options, one tap, one id.
 *
 * WHY IT IS A RADIO GROUP AND NOT TWO BUTTONS. Plan §6.3 puts `choice` in Band A, the
 * band a seven-year-old meets first, and §5.2 asks every answer control to be reachable by
 * thumb and by screen reader. A radio group gives both for free: the label is the tap
 * target, the group is one stop in the tab order, and arrow keys move inside it. Two
 * buttons would give a screen reader no notion of "pick one of these".
 *
 * WHAT IT MAY NOT DO. Both options are on screen — they are the question. So the leak this
 * spec hunts is not the words but the *marking*: any attribute, class, order or extra node
 * that separates the right option from the wrong one turns a question into an answer. The
 * shape comparison below is the assertion that catches it, and it is deliberately run
 * against real rendered problems at several seeds rather than a fixture, so a widget that
 * only looks even-handed for one arrangement of the options is caught.
 *
 * THE CONTRACT WITH THE CHECKER. `check('choice', …)` grades `{ id }` against the answer's
 * id, never the label — so the draft the widget hands upward must be the option *id*. A
 * widget that reported the label would render perfectly and grade every answer `wrong`,
 * which is why every grading assertion here goes through the real `check()` and the real
 * `toResponse()` rather than reading the draft and declaring it good.
 *
 * NOTHING IS STUBBED. The problems, prompts, answers and options come from
 * `@grove/curriculum`; the only thing this file writes down is the seed.
 */
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'

import { check, getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'
import { correctValueFor, gallerySamples, wrongValueFor } from '../../app/dev/widgets/samples'

const SEEDS = [12345, 7, 999_999, 2505]

const meta = listProblems().find((problem) => problem.widget === 'choice')
const full = (seed) => renderProblem(getProblem(meta.id), seed)
const instanceOf = (seed) => toInstance(full(seed))

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

const labelOf = (instance, id) => instance.visual.options.find((option) => option.id === id).label
const radioFor = (instance, id, scope = screen) => scope.getByRole('radio', { name: labelOf(instance, id) })
const otherThan = (instance, id) => instance.visual.options.find((option) => option.id !== id)

describe('P2.6 — the choice widget', () => {
  it('has a template to render at all, which is what makes it appear in the gallery', () => {
    expect(meta).toBeDefined()
    expect(meta.widget).toBe('choice')
    expect(gallerySamples().some((sample) => sample.widget === 'choice')).toBe(true)
  })

  describe.each(SEEDS)('at seed %i', (seed) => {
    it('offers every option as a radio a thumb and a screen reader can both reach', () => {
      const instance = instanceOf(seed)
      mount(instance)

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(instance.visual.options.length)
      expect(radios.length).toBeGreaterThan(1)

      for (const option of instance.visual.options) {
        const radio = radioFor(instance, option.id)
        // Associated, so the accessible name is the label and the whole label is the
        // tap target — a 7-year-old thumb must not have to find the dot.
        expect(screen.getByLabelText(option.label)).toBe(radio)
        const tapTarget = radio.closest('label')
        expect(tapTarget).not.toBeNull()
        expect(tapTarget.textContent).toContain(option.label)
        expect(radio).toBeEnabled()
        expect(radio).not.toBeChecked()
      }
    })

    it('lets the kid change their mind, and keeps exactly one option picked', () => {
      const instance = instanceOf(seed)
      const answer = full(seed).answer
      const wrong = otherThan(instance, answer.id)
      const { spy } = mount(instance)

      fireEvent.click(radioFor(instance, wrong.id))
      expect(spy.value).toBe(wrong.id)
      expect(radioFor(instance, wrong.id)).toBeChecked()
      expect(radioFor(instance, answer.id)).not.toBeChecked()

      fireEvent.click(radioFor(instance, answer.id))
      expect(spy.value).toBe(answer.id)
      expect(radioFor(instance, answer.id)).toBeChecked()
      expect(radioFor(instance, wrong.id)).not.toBeChecked()
    })

    it('hands upward the option id the checker grades, not the label it shows', () => {
      const instance = instanceOf(seed)
      const answer = full(seed).answer
      const { spy } = mount(instance)

      fireEvent.click(radioFor(instance, answer.id))
      expect(toResponse(instance, spy.value)).toEqual({ id: answer.id })
      expect(check('choice', answer, toResponse(instance, spy.value))).toEqual({ correct: true, reason: null })

      // The label would look identical on screen and grade wrong every time.
      expect(spy.value).not.toBe(labelOf(instance, answer.id))
    })

    it('grades the other option wrong, and an untouched widget not-correct', () => {
      const instance = instanceOf(seed)
      const answer = full(seed).answer
      const { spy } = mount(instance)

      expect(check('choice', answer, toResponse(instance, spy.value)).correct).toBe(false)

      fireEvent.click(radioFor(instance, otherThan(instance, answer.id).id))
      const verdict = check('choice', answer, toResponse(instance, spy.value))
      expect(verdict.correct).toBe(false)
      expect(verdict.reason).toBe('wrong')
    })

    it('renders both options with the same markup, so neither is marked as the answer', () => {
      const instance = instanceOf(seed)
      const solution = full(seed)
      const { view } = mount(instance)

      // Everything that legitimately differs between the two — the label, the id, and the
      // attributes that carry the problem id — is blanked. What is left must be equal.
      const shapeOf = (option) =>
        radioFor(instance, option.id)
          .closest('label')
          .outerHTML.replaceAll(/(id|for|name|aria-labelledby|aria-describedby)="[^"]*"/g, '$1="«ID»"')
          .split(option.label)
          .join('«OPTION»')
          .split(option.id)
          .join('«OPTION»')

      const [first, second] = instance.visual.options
      expect(shapeOf(first)).toBe(shapeOf(second))

      // And nothing else on the card names the answer either.
      const text = view.container.textContent
      expect(text).not.toContain(solution.explanation)
      for (const hint of solution.hints) expect(text).not.toContain(hint)
      expect(text).not.toMatch(/\bAI\b/)
      expect(view.container.innerHTML).not.toContain('correct')
    })

    it('invents no digits of its own beyond the prompt it was given', () => {
      const instance = instanceOf(seed)
      const { view } = mount(instance)

      const sent = [instance.prompt, ...instance.visual.options.map((option) => option.label)]
      let residue = view.container.textContent
      for (const piece of sent.sort((a, b) => b.length - a.length)) residue = residue.split(piece).join(' ')
      expect(residue).not.toMatch(/\d/)

      expect(screen.getByText(instance.prompt)).toBeInTheDocument()
    })

    it('ignores taps once the problem is solved', () => {
      const instance = instanceOf(seed)
      const { spy } = mount(instance, { disabled: true })

      for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
      fireEvent.click(screen.getAllByRole('radio')[0])
      expect(spy.value).toBe(emptyValue(instance))
      for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked()
    })
  })

  it('starts with no option picked, so an untouched card is never a lucky guess', () => {
    for (const seed of SEEDS) {
      const instance = instanceOf(seed)
      const view = render(<Harness instance={instance} spy={{}} />)
      expect(emptyValue(instance)).toBe('')
      for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked()
      view.unmount()
    }
  })

  it('keeps two cards on one page independent, the way the gallery shows them', () => {
    const left = instanceOf(SEEDS[0])
    const right = instanceOf(SEEDS[1])
    const spies = [{ value: undefined }, { value: undefined }]

    render(
      <div>
        <div data-testid="left">
          <Harness instance={left} spy={spies[0]} />
        </div>
        <div data-testid="right">
          <Harness instance={right} spy={spies[1]} />
        </div>
      </div>,
    )

    const leftScope = within(screen.getByTestId('left'))
    const rightScope = within(screen.getByTestId('right'))
    const picked = left.visual.options[0]

    fireEvent.click(radioFor(left, picked.id, leftScope))

    expect(spies[0].value).toBe(picked.id)
    expect(spies[1].value).toBe('')
    for (const radio of rightScope.getAllByRole('radio')) expect(radio).not.toBeChecked()
  })

  /**
   * A radio group is the whole interface. Any extra control is a trap: it is invisible to a
   * sighted kid but a screen reader still announces it and a keyboard still lands on it, so
   * it silently eats a turn. `cloze` already ships with none, which is the bar here.
   */
  it.each(SEEDS)('offers one control per option and nothing else, at seed %i', (seed) => {
    const instance = instanceOf(seed)
    const { view } = mount(instance)

    const controls = view.container.querySelectorAll('input, textarea, select')
    expect(controls).toHaveLength(instance.visual.options.length)
    for (const control of controls) expect(control.type).toBe('radio')

    expect(screen.queryByLabelText('Your answer')).toBeNull()
  })

  it('gives the gallery a right and a wrong value the real checker agrees with', () => {
    const sample = gallerySamples().find((entry) => entry.widget === 'choice')

    expect(check('choice', sample.answer, toResponse(sample.instance, correctValueFor(sample)))).toEqual({
      correct: true,
      reason: null,
    })
    const missed = check('choice', sample.answer, toResponse(sample.instance, wrongValueFor(sample)))
    expect(missed.correct).toBe(false)
    expect(missed.reason).toBe('wrong')
  })
})
