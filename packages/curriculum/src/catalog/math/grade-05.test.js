/**
 * P1.3 spec — the Grade 5 maths catalog (HOMEWORK_PROGRESS.md P1.3, HOMEWORK_PLAN.md §7
 * "Grade 5 (55) — Band B — **port the existing catalog**").
 *
 * All 55 skills in `apps/nora/lib/skills-catalog.js` move to `m5.*` with `legacyId` set to the
 * old id, so existing library rows can be migrated (§7, and D4 in HOMEWORK_PROGRESS.md).
 * Shape and id grammar come from §6.2: `{ id, grade, subject, strand, name, label, ccss,
 * prerequisites, legacyId }` with id `<m|e><grade>.<strand>.<slug>`, and "**Ids are never
 * reused**".
 *
 * This test file is the only place allowed to reach into `apps/`. The catalog module itself must
 * stay pure (§6.1 "Pure JS, no React, no DB, no network"), which `../catalog.purity.test.js`
 * enforces — the legacy names are copied into the catalog, never imported from it.
 *
 * ASSUMED — written down here because the plan does not settle them:
 *  1. Export name. §6.1 only says the file holds "strands + skills metadata"; this spec pins a
 *     named export `skills`.
 *  2. Per-skill strand for categories J, K and L. §7 gives only a pair per category ("g / md",
 *     "oa / md", "oa / g"), so the split below is this spec's reading of each skill's content:
 *     classify-shapes → g, perimeter/area/volume → md; number-patterns → oa,
 *     data-analysis/line-graphs → md; variables/equations → oa, coordinate-plane → g.
 *  3. `prerequisites` is not empty for every skill. §6.2 shows the field carrying real ids and
 *     §6.5 builds a ladder out of it, so a catalog where all 55 are `[]` would satisfy the letter
 *     of the shape and none of its purpose. This spec asks only that the field be used at all,
 *     resolve, not self-reference and not cycle — it does not dictate which skill needs which.
 *
 * The CCSS code list below is the full set of Grade 5 codes, read from
 * thecorestandards.org/Math/Content/5/{OA,NBT,NF,MD,G}. `roman-numerals` and `data-analysis` are
 * off-grade for CCSS, so §7 says to "keep them, tag `ccss: []`, and note it in the catalog".
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { skills } from './grade-05.js'
import { MATH_SKILLS_CATALOG } from '../../../../../apps/nora/lib/skills-catalog.js'

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

/** HOMEWORK_PLAN.md §7, "Old category → New strand". See ASSUMED note 2 for J, K and L. */
const STRAND_BY_LEGACY_ID = {
  // A. Place Values And Number Sense
  'place-value': 'nbt',
  rounding: 'nbt',
  'roman-numerals': 'nbt',
  // B. Addition And Subtraction
  'add-sub-whole': 'nbt',
  'estimate-sum-diff': 'nbt',
  'add-sub-word-problems': 'nbt',
  // C. Multiplication
  'long-multiplication': 'nbt',
  'multiply-powers-of-ten': 'nbt',
  'estimate-products': 'nbt',
  'multiply-word-problems': 'nbt',
  // D. Division
  'long-division': 'nbt',
  'divide-powers-of-ten': 'nbt',
  'estimate-quotients': 'nbt',
  'interpret-remainders': 'nbt',
  'divide-word-problems': 'nbt',
  // E. Fractions
  'equiv-fractions': 'nf',
  'simplify-fractions': 'nf',
  'compare-fractions': 'nf',
  'mixed-improper': 'nf',
  'add-fractions-unlike': 'nf',
  'subtract-fractions-unlike': 'nf',
  'add-mixed-numbers': 'nf',
  'subtract-mixed-numbers': 'nf',
  'multiply-fractions': 'nf',
  'divide-fractions': 'nf',
  'fractions-word-problems': 'nf',
  // F. Decimals
  'decimal-place-value': 'nbt',
  'compare-decimals': 'nbt',
  'round-decimals': 'nbt',
  'convert-fractions-decimals': 'nbt',
  'add-decimals': 'nbt',
  'subtract-decimals': 'nbt',
  'multiply-decimals': 'nbt',
  'divide-decimals': 'nbt',
  'decimals-word-problems': 'nbt',
  // G. Expressions And Order Of Operations
  'order-of-operations': 'oa',
  'numeric-expressions': 'oa',
  // H. Factors, Multiples And Number Theory
  'identify-factors': 'oa',
  'identify-multiples': 'oa',
  'prime-composite': 'oa',
  'divisibility-rules': 'oa',
  'lcm-gcd': 'oa',
  // I. Measurement
  'customary-units': 'md',
  'metric-units': 'md',
  'time-money': 'md',
  // J. Geometry — "g / md"
  'classify-shapes': 'g',
  perimeter: 'md',
  area: 'md',
  volume: 'md',
  // K. Data, Graphs And Patterns — "oa / md"
  'number-patterns': 'oa',
  'data-analysis': 'md',
  'line-graphs': 'md',
  // L. Algebra And Coordinate Plane — "oa / g"
  variables: 'oa',
  equations: 'oa',
  'coordinate-plane': 'g',
}

/** Every Grade 5 CCSS maths code. Nothing outside this set may appear in the catalog. */
const GRADE_5_CCSS = new Set([
  '5.OA.A.1',
  '5.OA.A.2',
  '5.OA.B.3',
  '5.NBT.A.1',
  '5.NBT.A.2',
  '5.NBT.A.3',
  '5.NBT.A.4',
  '5.NBT.B.5',
  '5.NBT.B.6',
  '5.NBT.B.7',
  '5.NF.A.1',
  '5.NF.A.2',
  '5.NF.B.3',
  '5.NF.B.4',
  '5.NF.B.5',
  '5.NF.B.6',
  '5.NF.B.7',
  '5.MD.A.1',
  '5.MD.B.2',
  '5.MD.C.3',
  '5.MD.C.4',
  '5.MD.C.5',
  '5.G.A.1',
  '5.G.A.2',
  '5.G.B.3',
  '5.G.B.4',
])

/** Off-grade for CCSS (§7): these two carry no code at all. */
const OFF_GRADE = ['roman-numerals', 'data-analysis']

/**
 * Codes pinned because the standard's own text names the skill. Each entry must be present; a
 * skill may carry further codes beyond these.
 */
const REQUIRED_CCSS = {
  // 5.NBT.A.1 "a digit in one place represents 10 times as much as it represents in the place to
  // its right"
  'place-value': ['5.NBT.A.1'],
  // 5.NBT.A.2 "patterns in the number of zeros of the product when multiplying a number by powers
  // of 10"
  'multiply-powers-of-ten': ['5.NBT.A.2'],
  'divide-powers-of-ten': ['5.NBT.A.2'],
  // 5.NBT.A.3 "read, write, and compare decimals to thousandths"
  'decimal-place-value': ['5.NBT.A.3'],
  'compare-decimals': ['5.NBT.A.3'],
  // 5.NBT.A.4 "use place value understanding to round decimals to any place"
  'round-decimals': ['5.NBT.A.4'],
  // 5.NBT.B.5 "fluently multiply multi-digit whole numbers using the standard algorithm"
  'long-multiplication': ['5.NBT.B.5'],
  // 5.NBT.B.6 "find whole-number quotients ... up to four-digit dividends and two-digit divisors"
  'long-division': ['5.NBT.B.6'],
  // 5.NBT.B.7 "add, subtract, multiply, and divide decimals to hundredths"
  'add-decimals': ['5.NBT.B.7'],
  'subtract-decimals': ['5.NBT.B.7'],
  'multiply-decimals': ['5.NBT.B.7'],
  'divide-decimals': ['5.NBT.B.7'],
  'decimals-word-problems': ['5.NBT.B.7'],
  // 5.NF.A.1 "add and subtract fractions with unlike denominators (including mixed numbers)"
  'add-fractions-unlike': ['5.NF.A.1'],
  'subtract-fractions-unlike': ['5.NF.A.1'],
  'add-mixed-numbers': ['5.NF.A.1'],
  'subtract-mixed-numbers': ['5.NF.A.1'],
  // 5.NF.A.2 "solve word problems involving addition and subtraction of fractions"
  'fractions-word-problems': ['5.NF.A.2'],
  // 5.NF.B.4 "multiply a fraction or whole number by a fraction"
  'multiply-fractions': ['5.NF.B.4'],
  // 5.NF.B.7 "divide unit fractions by whole numbers and whole numbers by unit fractions"
  'divide-fractions': ['5.NF.B.7'],
  // 5.OA.A.1 "use parentheses, brackets, or braces ... and evaluate expressions with these symbols"
  'order-of-operations': ['5.OA.A.1'],
  // 5.OA.A.2 "write simple expressions that record calculations with numbers"
  'numeric-expressions': ['5.OA.A.2'],
  // 5.OA.B.3 "generate two numerical patterns using two given rules"
  'number-patterns': ['5.OA.B.3'],
  // 5.MD.A.1 "convert among different-sized standard measurement units within a given system"
  'customary-units': ['5.MD.A.1'],
  'metric-units': ['5.MD.A.1'],
  // 5.G.A.1 defines the coordinate system, 5.G.A.2 graphs points in the first quadrant
  'coordinate-plane': ['5.G.A.1', '5.G.A.2'],
  // 5.G.B.4 "classify two-dimensional figures in a hierarchy based on properties"
  'classify-shapes': ['5.G.B.4'],
}

/** Volume spans three codes (5.MD.C.3 attribute, C.4 counting cubes, C.5 formulas); any will do. */
const VOLUME_CODES = ['5.MD.C.3', '5.MD.C.4', '5.MD.C.5']

const legacySkills = new Map()
for (const group of Object.values(MATH_SKILLS_CATALOG)) {
  for (const skill of group.skills) legacySkills.set(skill.id, skill)
}

const byLegacyId = new Map(skills.map((skill) => [skill.legacyId, skill]))
const source = readFileSync(new URL('./grade-05.js', import.meta.url), 'utf8')

test('the catalog exports 55 Grade 5 maths skills', () => {
  assert.ok(Array.isArray(skills), 'grade-05.js must export a `skills` array')
  assert.equal(skills.length, 55)
})

test('every skill has exactly the nine keys §6.2 defines', () => {
  for (const skill of skills) {
    assert.deepEqual(
      Object.keys(skill).sort(),
      SKILL_KEYS,
      `${skill.id ?? JSON.stringify(skill)} has the wrong keys`,
    )
  }
})

test('every skill is grade 5, subject math', () => {
  for (const skill of skills) {
    assert.equal(skill.grade, 5, `${skill.id} grade`)
    assert.equal(skill.subject, 'math', `${skill.id} subject`)
  }
})

test('ids are unique and spelled m5.<strand>.<legacyId>', () => {
  const ids = skills.map((skill) => skill.id)
  assert.equal(new Set(ids).size, 55, 'ids must be unique')
  for (const skill of skills) {
    assert.equal(skill.id, `m5.${skill.strand}.${skill.legacyId}`, 'id grammar')
  }
})

test('legacyIds are exactly the ids of MATH_SKILLS_CATALOG, one each', () => {
  const ported = skills.map((skill) => skill.legacyId)
  assert.equal(new Set(ported).size, 55, 'legacyIds must be unique')
  assert.deepEqual([...ported].sort(), [...legacySkills.keys()].sort())
})

test('name and label are carried over verbatim from the legacy catalog', () => {
  for (const [legacyId, legacy] of legacySkills) {
    const skill = byLegacyId.get(legacyId)
    assert.ok(skill, `${legacyId} was not ported`)
    assert.equal(skill.name, legacy.name, `${legacyId} name`)
    assert.equal(skill.label, legacy.label, `${legacyId} label`)
  }
})

test('strands follow the §7 old-category to new-strand table', () => {
  for (const skill of skills) {
    assert.equal(
      skill.strand,
      STRAND_BY_LEGACY_ID[skill.legacyId],
      `${skill.legacyId} strand`,
    )
  }
})

test('ccss is an array of Grade 5 CCSS codes and nothing else', () => {
  for (const skill of skills) {
    assert.ok(Array.isArray(skill.ccss), `${skill.id} ccss must be an array`)
    assert.equal(new Set(skill.ccss).size, skill.ccss.length, `${skill.id} repeats a code`)
    for (const code of skill.ccss) {
      assert.ok(GRADE_5_CCSS.has(code), `${skill.id} cites ${code}, which is not a Grade 5 code`)
    }
  }
})

test('the off-grade skills carry ccss: [] and are noted in the catalog', () => {
  for (const legacyId of OFF_GRADE) {
    assert.deepEqual(byLegacyId.get(legacyId).ccss, [], `${legacyId} must have no CCSS code`)
  }
  assert.match(source, /off-grade/i, 'the catalog must note why those skills have no code')
})

/**
 * GROVE-P13C — review follow-up on PR #79, thread on `grade-05.js` line 584 (`line-graphs`,
 * which shipped with `ccss: []`).
 *
 * Its legacy description is "Read and create line plots, bar graphs, line graphs", and 5.MD.B.2
 * reads "Make a line plot to display a data set of measurements in fractions of a unit (1/2, 1/4,
 * 1/8). Use operations on fractions for this grade to solve problems involving information
 * presented in line plots." The skill is therefore on-grade, and leaving it untagged both reads as
 * unaligned and drops the code for catalog consumers.
 *
 * The pin is derived from the legacy descriptions rather than written against one id, so a skill
 * added later that also teaches line plots cannot slip through untagged. It is deliberately not an
 * entry in REQUIRED_CCSS: that table pins codes whose own *standard text* names the skill, this
 * one is pinned by what the *legacy catalog* says the skill teaches.
 */
const LINE_PLOT_CODE = '5.MD.B.2'

test('every skill whose legacy description names line plots cites 5.MD.B.2', () => {
  const namedByDescription = [...legacySkills.values()].filter((legacy) =>
    /line plot/i.test(legacy.description ?? ''),
  )
  assert.ok(
    namedByDescription.length > 0,
    'no legacy description mentions line plots, so this test would pass vacuously',
  )
  for (const legacy of namedByDescription) {
    const skill = byLegacyId.get(legacy.id)
    assert.ok(skill, `${legacy.id} was not ported`)
    assert.ok(
      skill.ccss.includes(LINE_PLOT_CODE),
      `${skill.id} ("${legacy.description}") must cite ${LINE_PLOT_CODE}`,
    )
  }
})

test('skills named by the standard text carry the matching code', () => {
  for (const [legacyId, codes] of Object.entries(REQUIRED_CCSS)) {
    const { id, ccss } = byLegacyId.get(legacyId)
    for (const code of codes) {
      assert.ok(ccss.includes(code), `${id} must cite ${code}`)
    }
  }
  const volume = byLegacyId.get('volume')
  assert.ok(
    volume.ccss.some((code) => VOLUME_CODES.includes(code)),
    `${volume.id} must cite one of ${VOLUME_CODES.join(', ')}`,
  )
})

test('prerequisites are catalog ids, never the skill itself', () => {
  const ids = new Set(skills.map((skill) => skill.id))
  for (const skill of skills) {
    assert.ok(Array.isArray(skill.prerequisites), `${skill.id} prerequisites must be an array`)
    for (const required of skill.prerequisites) {
      assert.ok(ids.has(required), `${skill.id} requires ${required}, which is not in the catalog`)
      assert.notEqual(required, skill.id, `${skill.id} requires itself`)
    }
  }
})

test('the prerequisite graph is acyclic', () => {
  const edges = new Map(skills.map((skill) => [skill.id, skill.prerequisites]))
  const state = new Map()
  const walk = (id, trail) => {
    if (state.get(id) === 'done') return
    assert.notEqual(state.get(id), 'open', `prerequisite cycle: ${[...trail, id].join(' -> ')}`)
    state.set(id, 'open')
    for (const next of edges.get(id)) walk(next, [...trail, id])
    state.set(id, 'done')
  }
  for (const id of edges.keys()) walk(id, [])
})

test('the prerequisite field is actually used', () => {
  const withPrerequisites = skills.filter((skill) => skill.prerequisites.length > 0)
  assert.ok(
    withPrerequisites.length > 0,
    'no skill declares a prerequisite, so the ladder in §6.5 has nothing to walk',
  )
})
