/**
 * GROVE-P13B — referee follow-up to P1.3.
 *
 * HOMEWORK_PLAN.md §7: "Some of these are off-grade for CCSS (e.g. `roman-numerals`,
 * `data-analysis`); keep them, tag `ccss: []`, and note it in the catalog."
 *
 * `grade-05.test.js` only asked that the words "off-grade" appear somewhere in the file, and the
 * catalog satisfied that with a single note attached to `data-analysis`. `roman-numerals` sits
 * about 540 lines earlier and carries a bare `ccss: []`, so a reader there sees an untagged skill
 * with no reason given — which is the thing §7 asked to prevent. The note has to travel with each
 * off-grade skill.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { skills } from './grade-05.js'

const OFF_GRADE = ['roman-numerals', 'data-analysis']
const source = readFileSync(new URL('./grade-05.js', import.meta.url), 'utf8')

/** The object literals in the exported array, split on the line that opens each one. */
const blocks = source.split(/\n\s*\{\n/)

test('each off-grade skill carries its own off-grade note', () => {
  for (const legacyId of OFF_GRADE) {
    const skill = skills.find((candidate) => candidate.legacyId === legacyId)
    assert.ok(skill, `${legacyId} is missing from the catalog`)
    assert.deepEqual(skill.ccss, [], `${skill.id} must stay untagged`)

    const block = blocks.find((candidate) => candidate.includes(`legacyId: '${legacyId}'`))
    assert.ok(block, `could not find the object literal for ${legacyId}`)
    assert.match(
      block,
      /off-grade/i,
      `${skill.id} has ccss: [] with no adjacent off-grade note (§7 asks for one)`,
    )
  }
})
