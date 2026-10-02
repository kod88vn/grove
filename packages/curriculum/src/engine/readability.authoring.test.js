import assert from 'node:assert/strict'
import { test } from 'node:test'

const simple = 'The cat sat. The dog ran. We went home. The sun is hot.'
const advanced = 'Bioluminescence illuminates subterranean ecosystems. Photosynthesis sustains microorganisms throughout evolutionary transitions.'

test('readability reports a finite grade and distinguishes elementary from advanced passages', async () => {
  const { readabilityGrade } = await import('./readability.js')
  const elementary = readabilityGrade(simple)
  const difficult = readabilityGrade(advanced)
  assert.ok(Number.isFinite(elementary), `elementary: ${elementary}`)
  assert.ok(Number.isFinite(difficult), `advanced: ${difficult}`)
  assert.ok(difficult > elementary + 3, `${difficult} must exceed ${elementary}`)
})

test('a grade-band gate rejects content too difficult for early readers', async () => {
  const { fitsGradeBand } = await import('./readability.js')
  assert.equal(fitsGradeBand(advanced, 1), false)
  assert.equal(fitsGradeBand(simple, 1), true)
  assert.throws(() => fitsGradeBand('', 1), /text|empty|passage/i)
})
