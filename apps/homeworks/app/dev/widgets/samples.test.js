/**
 * P2.5 — the data behind the `/homeworks/dev/widgets` gallery.
 *
 * HOMEWORK_PLAN.md §10 Phase 2 acceptance: "a 'widget gallery' page at
 * `/homeworks/dev/widgets` (dev only) renders every widget with a sample problem".
 *
 * "A sample problem" means a REAL one: every sample must come out of
 * `@grove/curriculum`'s own `render()` at a fixed seed, so the gallery shows the same
 * thing on every load and cannot drift from what a kid actually sees. Invented
 * fixtures are exactly what this file exists to prevent — every sample is checked
 * against a fresh `render(getProblem(id), GALLERY_SEED)`.
 *
 * "Every widget" is scoped here to every widget that HAS a sample problem today. The
 * §6.3 catalogue lists eighteen; four have templates (number, column, fraction,
 * cloze). The set is DERIVED from `listProblems()` rather than hardcoded, so the day
 * a fifth template lands this test goes red until the gallery shows it too.
 *
 * The module must also supply, per sample, a right answer and a wrong one as WIDGET
 * VALUES — the shape the widget's own state holds — so the gallery drives the real
 * `toResponse()` → `check()` pipeline rather than a gallery-only imitation of it.
 */

import katex from 'katex'
import { check, getProblem, listProblems, render, toInstance } from '@grove/curriculum'

import { emptyValue, toResponse } from '@/components/widgets/response'

import {
  GALLERY_SEED,
  MATH_SAMPLE,
  correctValueFor,
  gallerySamples,
  wrongValueFor,
} from './samples'

const RIGHT = { correct: true, reason: null }

const samples = gallerySamples()

describe('the gallery covers every widget that has a sample problem', () => {
  test('the sample widgets are exactly the widgets curriculum can produce', () => {
    const covered = [...new Set(samples.map((sample) => sample.widget))].sort()
    const producible = [...new Set(listProblems().map((problem) => problem.widget))].sort()
    expect(covered).toEqual(producible)
  })

  test('today that is number, column, fraction, cloze, choice and order', () => {
    const covered = [...new Set(samples.map((sample) => sample.widget))].sort()
    expect(covered).toEqual(['choice', 'cloze', 'column', 'fraction', 'number', 'order'])
  })

  test('one sample per widget, each naming the widget it demonstrates', () => {
    const widgets = samples.map((sample) => sample.widget)
    expect(widgets).toHaveLength(new Set(widgets).size)
    for (const sample of samples) {
      expect(typeof sample.title).toBe('string')
      expect(sample.title.length).toBeGreaterThan(0)
    }
  })
})

describe('every sample is a real curriculum problem, not an invention', () => {
  test('the seed is a fixed integer, so the gallery does not change under the reader', () => {
    expect(Number.isInteger(GALLERY_SEED)).toBe(true)
  })

  test('each sample reproduces exactly from its own problem id and the fixed seed', () => {
    for (const sample of samples) {
      const template = getProblem(sample.problemId)
      expect(template).not.toBeNull()
      const rendered = render(template, GALLERY_SEED)
      expect(rendered.widget).toBe(sample.widget)
      expect(sample.instance).toEqual(toInstance(rendered))
      expect(sample.answer).toEqual(rendered.answer)
      expect(sample.explanation).toBe(rendered.explanation)
    }
  })

  test('two calls produce identical samples', () => {
    expect(gallerySamples()).toEqual(samples)
  })

  test('the instance carries no answer — it is the same leak-free shape a kid is sent', () => {
    for (const sample of samples) {
      expect(Object.keys(sample.instance)).not.toContain('answer')
      expect(JSON.stringify(sample.instance)).not.toContain('answer')
    }
  })
})

describe('right and wrong go through the real checker', () => {
  test('the correct value grades correct', () => {
    for (const sample of samples) {
      const response = toResponse(sample.instance, correctValueFor(sample))
      expect(check(sample.widget, sample.answer, response)).toEqual(RIGHT)
    }
  })

  test('the wrong value grades wrong — not merely invalid', () => {
    for (const sample of samples) {
      const response = toResponse(sample.instance, wrongValueFor(sample))
      const result = check(sample.widget, sample.answer, response)
      expect(result.correct).toBe(false)
      expect(result.reason).toBe('wrong')
    }
  })

  test('both values are the shape the widget itself holds, so they can be typed in', () => {
    for (const sample of samples) {
      const empty = emptyValue(sample.instance)
      for (const value of [correctValueFor(sample), wrongValueFor(sample)]) {
        expect(Array.isArray(value)).toBe(Array.isArray(empty))
        if (Array.isArray(empty)) {
          expect(value).toHaveLength(empty.length)
        } else {
          expect(typeof value).toBe('string')
          expect(value.length).toBeGreaterThan(0)
        }
      }
    }
  })

  test('a cloze wrong value is one of the choices the kid is actually offered', () => {
    const cloze = samples.find((sample) => sample.widget === 'cloze')
    expect(cloze.instance.visual.choices).toContain(wrongValueFor(cloze)[0])
    expect(cloze.instance.visual.choices).toContain(correctValueFor(cloze)[0])
  })
})

describe('the MathText sample', () => {
  test('is valid LaTeX — KaTeX renders it with throwOnError on', () => {
    expect(typeof MATH_SAMPLE.latex).toBe('string')
    expect(() => katex.renderToString(MATH_SAMPLE.latex, { throwOnError: true })).not.toThrow()
  })

  test('shows the three forms the number pad deferred to Band C: exponent, root and pi', () => {
    const html = katex.renderToString(MATH_SAMPLE.latex, {
      throwOnError: true,
      output: 'htmlAndMathml',
    })
    expect(html).toContain('msup')
    expect(html).toContain('msqrt')
    expect(html).toContain('π')
  })

  test('carries a caption so the gallery says what it is demonstrating', () => {
    expect(typeof MATH_SAMPLE.caption).toBe('string')
    expect(MATH_SAMPLE.caption.length).toBeGreaterThan(0)
  })
})

test('the gallery speaks of Nora, never of "AI"', () => {
  const prose = [
    MATH_SAMPLE.caption,
    ...samples.map((sample) => sample.title),
    ...samples.map((sample) => sample.instance.prompt),
  ].join(' ')
  expect(prose).not.toMatch(/\bAI\b/)
})
