import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fitsGradeBand, readabilityGrade } from './readability.js'

const gradeFourPassage = 'Mina planted beans beside the sunny fence. She watered the soil each morning. Soon green leaves reached toward the light, and tiny shoots appeared.'
const advancedPassage = 'Bioluminescent organisms transform chemical energy into visible radiation. Researchers investigate these adaptations across subterranean ecosystems.'

test('a realistic short passage receives a stable finite estimate in its target band', () => {
  const first = readabilityGrade(gradeFourPassage)
  assert.equal(readabilityGrade(gradeFourPassage), first)
  assert.ok(Number.isFinite(first))
  assert.equal(fitsGradeBand(gradeFourPassage, 4), true)
})

test('a difficult passage is rejected for early readers and has a higher estimate', () => {
  assert.equal(fitsGradeBand(advancedPassage, 1), false)
  assert.ok(readabilityGrade(advancedPassage) > readabilityGrade(gradeFourPassage) + 3)
})

test('empty, non-text, and punctuation-only passages are rejected', () => {
  for (const text of ['', '   ', '?!...']) assert.throws(() => readabilityGrade(text), /passage|text|words/i)
  assert.throws(() => readabilityGrade(null), /passage|text/i)
})

test('grade bounds are inclusive and invalid targets fail clearly', () => {
  assert.equal(fitsGradeBand(gradeFourPassage, 1), false)
  assert.throws(() => fitsGradeBand(gradeFourPassage, 0), /grade/i)
  assert.throws(() => fitsGradeBand(gradeFourPassage, 13), /grade/i)
})

test('grade-one estimates near the readability boundary are gated consistently', () => {
  const nearUpperBoundary = 'I see a small bird hop from the fence to a branch in the warm sun.'
  const beyondUpperBoundary = `${nearUpperBoundary.slice(0, -1)} today.`
  assert.ok(readabilityGrade(nearUpperBoundary) <= 2.5)
  assert.equal(fitsGradeBand(nearUpperBoundary, 1), true)
  assert.ok(readabilityGrade(beyondUpperBoundary) > 2.5)
  assert.equal(fitsGradeBand(beyondUpperBoundary, 1), false)
})
