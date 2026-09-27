/**
 * P1.4 follow-up spec — the working shown for `m5.nbt.long-multiplication` must be a real
 * partial-products decomposition.
 *
 * The first P1.4 loop satisfied every assertion in long-multiplication.test.js and still
 * shipped this, which is why this file exists:
 *
 *   prompt      : Multiply: 33 × 2
 *   hints       : ["Split 33 into 30 and 3.", "Multiply each part by 2, then add …"]
 *   explanation : 33 × 2 = 66 and 33 × 0 = 0, and 66 + 0 = 66.
 *
 *   prompt      : Multiply: 110 × 15
 *   hints       : ["Split 110 into 110 and 0.", …]
 *
 * Three defects, none of which the earlier spec could see: the explanation multiplies by a
 * zero digit; it decomposes the *bottom* factor while the hint tells the kid to split the
 * *top*, so the method in the hint is never demonstrated; and a factor with a zero digit
 * produces a split into itself and nothing.
 *
 * §10 Phase 1 ships "How Nora solved it" off the explanation, and §9.3 requires hints, so
 * prose that teaches a different method than it shows is a content bug, not a cosmetic one.
 *
 * The method is pinned here, once, for all three templates: **split the top factor by place
 * value and multiply each part by the whole bottom factor** — the partial-products form of the
 * column algorithm, and the one the existing hint text already describes. To make that
 * checkable without parsing English, `visual` carries the decomposition as numbers and the
 * prose is required to name them.
 *
 * Both factors are also required to have no zero digit. That is what removes the `× 0` term at
 * the root, keeps every split into two or three real parts, and keeps `× 10`-style problems in
 * `m5.nbt.multiply-powers-of-ten`, which is a separate skill in the same catalog.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { templates } from './long-multiplication.js'
import { render } from '../../../engine/render.js'

const SEEDS = Array.from({ length: 500 }, (_, index) => index)

const digits = (value) => String(value).split('').map(Number)

/** The nonzero place-value components of a number, largest first: 339 -> [300, 30, 9]. */
const placeParts = (value) => {
  const parts = []
  const text = String(value)
  for (let index = 0; index < text.length; index += 1) {
    const digit = Number(text[index])
    if (digit !== 0) parts.push(digit * 10 ** (text.length - 1 - index))
  }
  return parts
}

/** `value` appears in `text` as a whole number, not as a run of digits inside a longer one. */
const names = (text, value) => new RegExp(`(?<![0-9])${value}(?![0-9])`).test(text)

const strings = (problem) => [problem.prompt, ...problem.hints, problem.explanation]

test('neither factor ever contains a zero digit', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const [top, bottom] = render(template, seed).visual.operands
      for (const [label, factor] of [['top', top], ['bottom', bottom]]) {
        assert.ok(
          digits(factor).every((digit) => digit !== 0),
          `${template.id} @ ${seed}: ${label} factor ${factor} has a zero digit`,
        )
      }
    }
  }
})

test('visual carries the split of the top factor and the partial products', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const { operands, parts, partials } = render(template, seed).visual
      const [top, bottom] = operands
      assert.ok(Array.isArray(parts), `${template.id} @ ${seed}: visual.parts is not an array`)
      assert.ok(Array.isArray(partials), `${template.id} @ ${seed}: visual.partials is not an array`)
      assert.deepEqual(parts, placeParts(top), `${template.id} @ ${seed}: parts do not split ${top} by place value`)
      assert.deepEqual(
        partials,
        parts.map((part) => part * bottom),
        `${template.id} @ ${seed}: partials are not each part × ${bottom}`,
      )
    }
  }
})

test('the split and its partial products are arithmetically sound', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const { operands, parts, partials } = problem.visual
      const [top] = operands
      assert.ok(parts.length >= 2, `${template.id} @ ${seed}: ${top} split into ${parts.length} part(s)`)
      assert.ok(parts.every((part) => part > 0), `${template.id} @ ${seed}: a part is not positive`)
      assert.ok(partials.every((partial) => partial > 0), `${template.id} @ ${seed}: a partial is not positive`)
      const sum = (values) => values.reduce((total, value) => total + BigInt(value), 0n)
      assert.equal(sum(parts), BigInt(top), `${template.id} @ ${seed}: parts do not sum to ${top}`)
      assert.equal(
        sum(partials),
        BigInt(problem.answer.value),
        `${template.id} @ ${seed}: partials do not sum to ${problem.answer.value}`,
      )
    }
  }
})

test('the hints name every part the kid is told to split the top into', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      const text = problem.hints.join(' ')
      for (const part of problem.visual.parts) {
        assert.ok(names(text, part), `${template.id} @ ${seed}: no hint names the part ${part}`)
      }
    }
  }
})

test('the explanation shows every partial product and the total', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      for (const partial of problem.visual.partials) {
        assert.ok(
          names(problem.explanation, partial),
          `${template.id} @ ${seed}: explanation omits the partial product ${partial}`,
        )
      }
      assert.ok(
        names(problem.explanation, problem.answer.value),
        `${template.id} @ ${seed}: explanation omits the total ${problem.answer.value}`,
      )
    }
  }
})

test('no rendered string multiplies or adds a bare zero', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      for (const text of strings(render(template, seed))) {
        assert.doesNotMatch(
          text,
          /(?<![0-9])0(?![0-9])/,
          `${template.id} @ ${seed}: a standalone zero appears in ${JSON.stringify(text)}`,
        )
      }
    }
  }
})
