/**
 * P1.5 spec — the Grade 5 English catalog, one skill wide.
 *
 * HOMEWORK_PLAN.md §10 Phase 1 asks for exactly "One English skill: `e5.l.context-clues`
 * (cloze) with 20 reviewed items". §8's Grade 5 table puts `context-clues` in the **L**
 * (language) strand, so the id is `e5.l.context-clues` under the §6.2 grammar
 * `<m|e><grade>.<strand>.<slug>`, and the shape is the same nine keys the maths catalog uses:
 * `{ id, grade, subject, strand, name, label, ccss, prerequisites, legacyId }`.
 *
 * The remaining 21 Grade 5 English skills in §8 are Phase 6 content work, so this file holds
 * one entry and this spec pins that — a catalog that quietly grew a second, untemplated skill
 * would report progress that no item bank backs.
 *
 * ASSUMED — written down because the plan does not settle them:
 *  1. CCSS code format for English. §6.2 shows only a maths code (`3.OA.C.7`, the official
 *     grade-first Math form) and D6 says "US Common Core (CCSS) for both subjects". CCSS ELA
 *     codes are strand-first — `CCSS.ELA-LITERACY.L.5.4.A`, "Use context (e.g., cause/effect
 *     relationships and comparisons in text) as a clue to the meaning of a word or phrase" —
 *     so this spec pins the shorthand `L.5.4.A`. Each subject keeps its own official form.
 *  2. `legacyId: null`. §7 told the maths port to carry the old ids across; there is no legacy
 *     English skills catalog in `apps/nora` to port from (`context clues` appears only inside a
 *     Nora prompt string), so there is nothing to migrate and the field is null.
 *  3. `prerequisites: []`. §6.2 carries real ids here and §6.5 builds a ladder from them, but a
 *     prerequisite must resolve inside the catalog, and this file has no other skill to point
 *     at. It fills in when §8's other Grade 5 skills land.
 *  4. Export name `skills`, matching `catalog/math/grade-05.js`.
 *
 * Purity is already covered: `../catalog.purity.test.js` walks the whole `src/catalog` tree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { skills } from './grade-05.js'

const SKILL_KEYS = [
  'ccss',
  'grade',
  'id',
  'label',
  'legacyId',
  'name',
  'prerequisites',
  'strand',
  'subject',
]

const source = readFileSync(new URL('./grade-05.js', import.meta.url), 'utf8')

test('the Grade 5 English catalog exports exactly one skill', () => {
  assert.ok(Array.isArray(skills), 'skills is not an array')
  assert.equal(skills.length, 1, 'Phase 1 catalogues one English skill, not more')
})

test('the one skill is e5.l.context-clues', () => {
  const [skill] = skills
  assert.equal(skill.id, 'e5.l.context-clues')
  assert.equal(skill.grade, 5)
  assert.equal(skill.subject, 'english')
  assert.equal(skill.strand, 'l', 'plan §8 puts context-clues in the L (language) strand')
})

test('every skill carries exactly the nine keys of plan §6.2', () => {
  for (const skill of skills) {
    assert.deepEqual(Object.keys(skill).sort(), SKILL_KEYS, `${skill.id} has the wrong keys`)
  }
})

test('the id follows the §6.2 grammar and agrees with its own grade and strand', () => {
  for (const skill of skills) {
    assert.match(skill.id, /^e5\.[a-z]+\.[a-z0-9]+(?:-[a-z0-9]+)*$/, `${skill.id} is malformed`)
    assert.equal(skill.id, `e${skill.grade}.${skill.strand}.context-clues`)
  }
})

test('name and label are kid-facing strings, and the label carries an emoji', () => {
  for (const skill of skills) {
    assert.ok(typeof skill.name === 'string' && skill.name.trim().length > 0, 'name is empty')
    assert.ok(typeof skill.label === 'string' && skill.label.trim().length > 0, 'label is empty')
    assert.doesNotMatch(skill.name, /[^\x20-\x7e]/, `${skill.id}: name should be plain text`)
    assert.match(skill.label, /\p{Extended_Pictographic}/u, `${skill.id}: label has no emoji`)
  }
})

test('ccss pins the CCSS ELA vocabulary-in-context standard', () => {
  assert.deepEqual(skills[0].ccss, ['L.5.4.A'])
})

test('legacyId is null and prerequisites is an empty array', () => {
  const [skill] = skills
  assert.equal(skill.legacyId, null, 'there is no legacy English catalog to migrate from')
  assert.deepEqual(skill.prerequisites, [], 'no other Grade 5 English skill exists to require')
})

test('the module explains its ELA code format rather than leaving it to be guessed', () => {
  assert.match(
    source,
    /(?:\/\/|\*).*ELA/,
    'grade-05.js has no comment explaining why the ccss code is strand-first',
  )
})
