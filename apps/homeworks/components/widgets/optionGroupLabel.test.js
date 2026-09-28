/**
 * PR #91 review — the option set must be a *labelled* group, not a bare stack of radios.
 *
 * WHAT WAS WRONG. `ChoiceWidget` and `ClozeWidget` both render their options into a plain
 * `<div>`. A sighted child reads the prompt above the options and the connection is obvious;
 * a screen-reader user moving focus onto an option hears only the option. Measured in real
 * Chromium against `/homeworks/q/m5.oa.prime-composite/prime-or-composite`, the accessibility
 * tree was:
 *
 *     - main:
 *       - text: Is 41 prime or composite?
 *       - radio "Prime"
 *       - radio "Composite"
 *
 * — two radios, zero grouping nodes, `getByRole('radiogroup')` = 0. "Prime" alone does not
 * say what it is an answer to, and neither does "fortunate" on the `cloze` route. Both
 * widgets have the same shape, so this spec holds both to the same bar.
 *
 * WHY IT IS LABELLED BY REFERENCE AND NOT BY A LEGEND. The obvious fix — a `<fieldset>` with
 * the prompt repeated in a `<legend>` — prints the question twice, and three shipped specs
 * forbid that: `ReadAloud.test.js` ("does not print the question a second time to have
 * something to read") and `SolveItem.test.js` ("the prompt is not repeated back at the kid")
 * both count occurrences in `textContent`, and `WidgetGallery.test.js` resolves the prompt
 * with `getByText`, which throws on a second match. So the group must point at the prompt
 * that is already on screen. This file asserts the *accessible name* that a screen reader
 * computes — not the attribute that produces it — so any correct mechanism passes.
 *
 * WHY THE ID MUST BE PER-MOUNT. The gallery and the play screen can put two cards on one
 * page. A label reference derived from the problem alone collides when the same problem is
 * mounted twice: two elements share one DOM id, and every reference to it resolves to the
 * first. The last test mounts one instance twice and requires two distinct, self-resolving
 * references.
 *
 * NOTHING IS STUBBED. Problems, prompts and options come from `@grove/curriculum`; the only
 * thing written down here is the seed.
 */
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue } from './response'

const SEEDS = [12345, 7, 999_999, 2505]
const WIDGETS = ['choice', 'cloze']

const metaFor = (widget) => listProblems().find((problem) => problem.widget === widget)
const instanceOf = (widget, seed) => toInstance(renderProblem(getProblem(metaFor(widget).id), seed))

const mount = (instance) =>
  render(<AnswerWidget instance={instance} value={emptyValue(instance)} onChange={() => {}} disabled={false} />)

const optionCount = (instance) => (instance.visual.options ?? instance.visual.choices).length

describe('the options of a choice are announced as one group, named by the prompt', () => {
  describe.each(WIDGETS)('%s', (widget) => {
    it('has a template to render at all, so the rest of this file is about real markup', () => {
      expect(metaFor(widget)).toBeDefined()
    })

    describe.each(SEEDS)('at seed %i', (seed) => {
      it('exposes exactly one radiogroup, and its accessible name is the prompt', () => {
        const instance = instanceOf(widget, seed)
        mount(instance)

        // The consequence, stated the way a screen reader would find it: ask for the group
        // *by the question it answers*. Before this spec, this query matched nothing.
        const group = screen.getByRole('radiogroup', { name: instance.prompt })
        expect(group).toBeInTheDocument()
        expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
      })

      it('puts every option inside that group, so no option is announced outside it', () => {
        const instance = instanceOf(widget, seed)
        mount(instance)

        const group = screen.getByRole('radiogroup', { name: instance.prompt })
        const inside = within(group).getAllByRole('radio')
        expect(inside).toHaveLength(optionCount(instance))
        expect(inside).toEqual(screen.getAllByRole('radio'))
      })

      it('still says the question exactly once, so nothing is read back twice', () => {
        const instance = instanceOf(widget, seed)
        const view = mount(instance)

        expect(view.container.textContent.split(instance.prompt).length - 1).toBe(1)
        expect(screen.getByText(instance.prompt)).toBeInTheDocument()
      })

      it('adds no control and changes no option name while doing it', () => {
        const instance = instanceOf(widget, seed)
        const view = mount(instance)

        const controls = view.container.querySelectorAll('input, textarea, select')
        expect(controls).toHaveLength(optionCount(instance))
        for (const control of controls) expect(control.type).toBe('radio')
        for (const radio of screen.getAllByRole('radio')) {
          expect(radio).toBeEnabled()
          expect(radio).not.toBeChecked()
        }
      })
    })

    it('keeps the two groups apart when the same problem is on the page twice', () => {
      const instance = instanceOf(widget, SEEDS[0])
      render(
        <div>
          <div data-testid="left">
            <AnswerWidget instance={instance} value={emptyValue(instance)} onChange={() => {}} disabled={false} />
          </div>
          <div data-testid="right">
            <AnswerWidget instance={instance} value={emptyValue(instance)} onChange={() => {}} disabled={false} />
          </div>
        </div>,
      )

      const groups = screen.getAllByRole('radiogroup', { name: instance.prompt })
      expect(groups).toHaveLength(2)

      // Each card must name itself from its own copy of the prompt. If both cards reused one
      // id, the two references would be equal and both would resolve into the left card.
      const references = groups.map((group) => group.getAttribute('aria-labelledby'))
      for (const reference of references) expect(reference).toBeTruthy()
      expect(new Set(references).size).toBe(2)

      for (const side of ['left', 'right']) {
        const card = screen.getByTestId(side)
        const group = within(card).getByRole('radiogroup', { name: instance.prompt })
        const target = document.getElementById(group.getAttribute('aria-labelledby'))
        expect(card).toContainElement(target)
        expect(target.textContent).toBe(instance.prompt)
      }
    })
  })
})
